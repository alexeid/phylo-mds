// ccd/dissonance.js - Calculate dissonance between tree sets

import { CCD1 } from './ccd1';

/**
 * Calculate dissonance between multiple tree sets
 * Dissonance = Entropy(combined) - Average(Entropy(individual sets))
 * 
 * @param {Array<Array<Tree>>} treeSets - Array of tree arrays (each representing a chain or subset)
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Object} Dissonance statistics and per-tree measurements
 */
export async function calculateDissonance(treeSets, progressCallback = null) {
    if (treeSets.length === 0) {
        throw new Error('No tree sets provided');
    }
    
    const numChains = treeSets.length;
    const numTrees = Math.min(...treeSets.map(set => set.length));
    
    if (numTrees === 0) {
        throw new Error('Empty tree sets provided');
    }
    
    // First, collect all unique taxa across all trees
    const allTaxa = new Set();
    treeSets.forEach(treeSet => {
        treeSet.forEach(tree => {
            const leafList = tree.leafList;
            leafList.forEach(leaf => {
                const label = leaf.label || leaf.id.toString();
                allTaxa.add(label);
            });
        });
    });
    
    const numLeaves = allTaxa.size;
    console.log(`Calculating dissonance for ${numLeaves} unique taxa`);
    
    // Create taxon mapping
    const sortedTaxa = Array.from(allTaxa).sort();
    const taxonMapping = new Map();
    sortedTaxa.forEach((taxon, index) => {
        taxonMapping.set(taxon, index);
    });
    
    // Initialize CCDs for each chain and one for combined
    const ccds = [];
    for (let i = 0; i < numChains; i++) {
        const ccd = new CCD1(numLeaves, false);
        ccd.taxonNames = sortedTaxa;
        ccd.taxonMapping = taxonMapping;
        ccds.push(ccd);
    }
    
    const combinedCCD = new CCD1(numLeaves, false);
    combinedCCD.taxonNames = sortedTaxa;
    combinedCCD.taxonMapping = taxonMapping;
    
    // Arrays to store entropy values over time
    const entropies = Array(numChains + 1).fill(null).map(() => []);
    const dissonanceValues = [];
    
    // Process trees incrementally
    for (let i = 0; i < numTrees; i++) {
        if (progressCallback) {
            const percent = Math.round((i / numTrees) * 100);
            await progressCallback(`Computing dissonance: ${percent}% (tree ${i + 1} of ${numTrees})`);
        }
        
        let weightedEntropySum = 0;
        
        // Add tree from each chain to its respective CCD
        for (let j = 0; j < numChains; j++) {
            const tree = treeSets[j][i];
            ccds[j].addTree(tree);
            ccds[j].initialize(); // Update CCPs
            const entropy = ccds[j].getEntropy();
            entropies[j].push(entropy);
            weightedEntropySum += entropy / numChains;
            
            // Also add to combined CCD
            combinedCCD.addTree(tree);
        }
        
        // Update combined CCD and calculate entropy
        combinedCCD.initialize();
        const combinedEntropy = combinedCCD.getEntropy();
        entropies[numChains].push(combinedEntropy);
        
        // Calculate dissonance
        const dissonance = combinedEntropy - weightedEntropySum;
        dissonanceValues.push(dissonance);
        
        // Allow UI update periodically
        if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    // Calculate summary statistics
    const finalDissonance = dissonanceValues[dissonanceValues.length - 1];
    const meanDissonance = dissonanceValues.reduce((a, b) => a + b, 0) / dissonanceValues.length;
    const maxDissonance = Math.max(...dissonanceValues);
    const minDissonance = Math.min(...dissonanceValues);
    
    // Calculate average final entropy for relative dissonance
    let avgFinalEntropy = 0;
    for (let i = 0; i < numChains; i++) {
        avgFinalEntropy += entropies[i][entropies[i].length - 1] / numChains;
    }
    const relativeDissonance = avgFinalEntropy > 0 ? finalDissonance / avgFinalEntropy : 0;
    
    return {
        numChains,
        numTrees,
        finalDissonance,
        meanDissonance,
        maxDissonance,
        minDissonance,
        relativeDissonance,
        avgFinalEntropy,
        dissonanceValues,
        entropies,
        chainCCDs: ccds,
        combinedCCD
    };
}

/**
 * Calculate within-chain dissonance by splitting a single tree set
 * Useful for assessing mixing within a single MCMC chain
 * 
 * @param {Array<Tree>} trees - Array of trees from a single chain
 * @param {number} numSplits - Number of ways to split the chain (default 2 for first/second half)
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Object} Within-chain dissonance statistics
 */
export async function calculateWithinChainDissonance(trees, numSplits = 2, progressCallback = null) {
    if (trees.length < numSplits * 2) {
        throw new Error(`Not enough trees (${trees.length}) to split into ${numSplits} parts`);
    }
    
    // Split trees into equal parts
    const splitSize = Math.floor(trees.length / numSplits);
    const treeSets = [];
    
    for (let i = 0; i < numSplits; i++) {
        const start = i * splitSize;
        const end = (i === numSplits - 1) ? trees.length : (i + 1) * splitSize;
        treeSets.push(trees.slice(start, end));
    }
    
    if (progressCallback) {
        await progressCallback(`Calculating within-chain dissonance with ${numSplits} splits...`);
    }
    
    // Use the general dissonance calculator
    const result = await calculateDissonance(treeSets, progressCallback);
    
    // Add split-specific information
    result.splitSize = splitSize;
    result.numSplits = numSplits;
    result.interpretation = interpretWithinChainDissonance(result.finalDissonance, result.avgFinalEntropy);
    
    return result;
}

/**
 * Interpret within-chain dissonance value
 * @param {number} dissonance - The dissonance value
 * @param {number} averageEntropy - The average entropy of individual chains
 * @returns {string} Interpretation of the dissonance
 */
function interpretWithinChainDissonance(dissonance, averageEntropy) {
    // Use relative dissonance for interpretation
    const relativeDissonance = averageEntropy > 0 ? dissonance / averageEntropy : dissonance;
    
    if (relativeDissonance < 0.001) {
        return "Exceptional mixing - chains are virtually identical";
    } else if (relativeDissonance < 0.01) {
        return "Excellent mixing - chain appears well converged";
    } else if (relativeDissonance < 0.02) {
        return "Very good mixing - chain is converged";
    } else if (relativeDissonance < 0.05) {
        return "Good mixing - chain is likely converged";
    } else if (relativeDissonance < 0.10) {
        return "Moderate mixing - consider running chain longer";
    } else if (relativeDissonance < 0.20) {
        return "Poor mixing - chain may not be converged";
    } else {
        return "Very poor mixing - chain is likely not converged";
    }
}

/**
 * Calculate dissonance between two specific CCDs
 * @param {CCD1} ccd1 - First CCD
 * @param {CCD1} ccd2 - Second CCD
 * @returns {number} Dissonance value
 */
export function calculateCCDDissonance(ccd1, ccd2) {
    const entropy1 = ccd1.getEntropy();
    const entropy2 = ccd2.getEntropy();
    
    // Create combined CCD
    // Note: This is a simplified version - in practice you might want to
    // combine the actual tree sets
    const averageEntropy = (entropy1 + entropy2) / 2;
    
    // For a proper implementation, you would need to:
    // 1. Get the original trees from both CCDs
    // 2. Create a new combined CCD
    // 3. Calculate its entropy
    // For now, we'll return the difference between entropies as a proxy
    
    return Math.abs(entropy1 - entropy2);
}

/**
 * Format dissonance results for display
 * @param {Object} results - Results from calculateDissonance
 * @returns {string} Formatted HTML string
 */
export function formatDissonanceResults(results) {
    let html = '<div class="dissonance-results">';
    html += '<h4>Dissonance Analysis</h4>';
    
    html += '<div class="stats-grid">';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Number of Chains/Splits:</div>';
    html += `<div class="stat-value">${results.numChains}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Trees per Chain:</div>';
    html += `<div class="stat-value">${results.numTrees}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Final Dissonance:</div>';
    html += `<div class="stat-value">${results.finalDissonance.toFixed(6)}</div>`;
    html += '</div>';
    
    if (results.relativeDissonance !== undefined) {
        html += '<div class="stat-item">';
        html += '<div class="stat-label">Relative Dissonance:</div>';
        html += `<div class="stat-value">${(results.relativeDissonance * 100).toFixed(3)}%</div>`;
        html += '</div>';
    }
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Mean Dissonance:</div>';
    html += `<div class="stat-value">${results.meanDissonance.toFixed(6)}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Min Dissonance:</div>';
    html += `<div class="stat-value">${results.minDissonance.toFixed(6)}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Max Dissonance:</div>';
    html += `<div class="stat-value">${results.maxDissonance.toFixed(6)}</div>`;
    html += '</div>';
    
    html += '</div>'; // end stats-grid
    
    if (results.interpretation) {
        html += `<p class="interpretation"><strong>Interpretation:</strong> ${results.interpretation}</p>`;
    }
    
    // Final entropies for each chain
    html += '<h5>Final Entropy Values</h5>';
    html += '<table class="clades-table">';
    html += '<tr><th>Chain/Split</th><th>Final Entropy</th></tr>';
    
    for (let i = 0; i < results.numChains; i++) {
        const finalEntropy = results.entropies[i][results.entropies[i].length - 1];
        html += `<tr><td>Chain ${i + 1}</td><td>${finalEntropy.toFixed(6)}</td></tr>`;
    }
    
    const combinedFinalEntropy = results.entropies[results.numChains][results.entropies[results.numChains].length - 1];
    html += `<tr><td><strong>Combined</strong></td><td><strong>${combinedFinalEntropy.toFixed(6)}</strong></td></tr>`;
    
    html += '</table>';
    html += '</div>';
    
    return html;
}