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
    
    // Add CCD probability comparison for hard problems
    if (numSplits === 2 && result.chainCCDs.length === 2 && result.avgFinalEntropy > 10) {
        if (progressCallback) {
            await progressCallback(`Comparing CCD probabilities for sampled trees...`);
        }
        
        const ccdComparison = await compareCCDTreeProbabilities(
            treeSets[0], 
            treeSets[1], 
            result.chainCCDs[0], 
            result.chainCCDs[1],
            progressCallback
        );
        
        result.ccdProbabilityComparison = ccdComparison;
    }
    
    // Add split-specific information
    result.splitSize = splitSize;
    result.numSplits = numSplits;
    result.interpretation = interpretWithinChainDissonance(result.finalDissonance, result.avgFinalEntropy);
    
    // For hard problems, add a note about tree uniqueness
    if (result.avgFinalEntropy > 20) {
        result.hardProblemNote = "For problems of this complexity, each sampled tree is unique. " +
                                "The dissonance measures how differently the two halves explore tree space.";
    }
    
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
        return "Exceptional mixing - chains are exploring tree space identically";
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
 * Compare CCD probabilities for trees sampled from both sets
 * @param {Array<Tree>} trees1 - Trees from first set
 * @param {Array<Tree>} trees2 - Trees from second set
 * @param {CCD1} ccd1 - CCD built from first set
 * @param {CCD1} ccd2 - CCD built from second set
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Object} Comparison statistics
 */
async function compareCCDTreeProbabilities(trees1, trees2, ccd1, ccd2, progressCallback) {
    const results = {
        numTreesCompared: 0,
        logProbDifferences: [],
        relativeDifferences: [],
        ratios: [],
        trees1BetterCount: 0,
        trees2BetterCount: 0,
        infiniteDifferenceCount: 0
    };
    
    // Sample trees from both sets (use all if not too many)
    const maxTrees = 1000;
    const trees1Sample = trees1.length <= maxTrees ? trees1 : 
        trees1.filter((_, i) => i % Math.ceil(trees1.length / maxTrees) === 0);
    const trees2Sample = trees2.length <= maxTrees ? trees2 : 
        trees2.filter((_, i) => i % Math.ceil(trees2.length / maxTrees) === 0);
    
    const allTrees = [...trees1Sample, ...trees2Sample];
    const totalTrees = allTrees.length;
    
    // Compare probabilities
    for (let i = 0; i < allTrees.length; i++) {
        if (progressCallback && i % 100 === 0) {
            await progressCallback(`Comparing tree probabilities: ${i}/${totalTrees}...`);
        }
        
        const tree = allTrees[i];
        const logProb1 = ccd1.getTreeLogProbability(tree);
        const logProb2 = ccd2.getTreeLogProbability(tree);
        
        if (logProb1 === -Infinity && logProb2 === -Infinity) {
            // Tree has probability 0 in both CCDs - skip
            continue;
        }
        
        results.numTreesCompared++;
        
        if (logProb1 === -Infinity || logProb2 === -Infinity) {
            results.infiniteDifferenceCount++;
            continue;
        }
        
        const logDiff = logProb1 - logProb2;
        results.logProbDifferences.push(logDiff);
        
        if (logDiff > 0) results.trees1BetterCount++;
        else if (logDiff < 0) results.trees2BetterCount++;
        
        // Relative difference in probability space
        const prob1 = Math.exp(logProb1);
        const prob2 = Math.exp(logProb2);
        const avgProb = (prob1 + prob2) / 2;
        if (avgProb > 0) {
            results.relativeDifferences.push(Math.abs(prob1 - prob2) / avgProb);
        }
        
        results.ratios.push(Math.exp(logDiff));
        
        // Allow UI update
        if (i % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
    
    // Calculate summary statistics
    if (results.logProbDifferences.length > 0) {
        results.meanLogDifference = mean(results.logProbDifferences);
        results.rmsLogDifference = Math.sqrt(mean(results.logProbDifferences.map(d => d * d)));
        results.maxAbsLogDifference = Math.max(...results.logProbDifferences.map(Math.abs));
        
        if (results.relativeDifferences.length > 0) {
            results.meanRelativeDifference = mean(results.relativeDifferences);
            results.rmsRelativeDifference = Math.sqrt(mean(results.relativeDifferences.map(d => d * d)));
        }
    }
    
    return results;
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
    html += '<div class="stat-label">Average Entropy:</div>';
    html += `<div class="stat-value">${results.avgFinalEntropy.toFixed(2)}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Final Dissonance:</div>';
    html += `<div class="stat-value">${results.finalDissonance.toFixed(4)}</div>`;
    html += '</div>';
    
    if (results.relativeDissonance !== undefined) {
        html += '<div class="stat-item">';
        html += '<div class="stat-label">Relative Dissonance:</div>';
        html += `<div class="stat-value">${(results.relativeDissonance * 100).toFixed(2)}%</div>`;
        html += '</div>';
    }
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Mean Dissonance:</div>';
    html += `<div class="stat-value">${results.meanDissonance.toFixed(4)}</div>`;
    html += '</div>';
    
    html += '</div>'; // end stats-grid
    
    if (results.interpretation) {
        html += `<p class="interpretation"><strong>Interpretation:</strong> ${results.interpretation}</p>`;
    }
    
    if (results.hardProblemNote) {
        html += `<p class="hard-problem-note"><strong>Note:</strong> ${results.hardProblemNote}</p>`;
    }
    
    // Final entropies for each chain
    html += '<h5>Final Entropy Values</h5>';
    html += '<table class="clades-table">';
    html += '<tr><th>Chain/Split</th><th>Final Entropy</th></tr>';
    
    for (let i = 0; i < results.numChains; i++) {
        const finalEntropy = results.entropies[i][results.entropies[i].length - 1];
        html += `<tr><td>Chain ${i + 1}</td><td>${finalEntropy.toFixed(4)}</td></tr>`;
    }
    
    const combinedFinalEntropy = results.entropies[results.numChains][results.entropies[results.numChains].length - 1];
    html += `<tr><td><strong>Combined</strong></td><td><strong>${combinedFinalEntropy.toFixed(4)}</strong></td></tr>`;
    
    html += '</table>';
    
    // Add CCD probability comparison if available
    if (results.ccdProbabilityComparison) {
        html += '<h5>CCD Tree Probability Comparison</h5>';
        html += '<div class="ccd-comparison">';
        
        const comp = results.ccdProbabilityComparison;
        html += '<div class="stats-grid">';
        
        html += '<div class="stat-item">';
        html += '<div class="stat-label">Trees Compared:</div>';
        html += `<div class="stat-value">${comp.numTreesCompared}</div>`;
        html += '</div>';
        
        if (comp.rmsRelativeDifference !== undefined) {
            html += '<div class="stat-item">';
            html += '<div class="stat-label">RMS Relative Difference:</div>';
            html += `<div class="stat-value">${(comp.rmsRelativeDifference * 100).toFixed(1)}%</div>`;
            html += '</div>';
        }
        
        if (comp.rmsLogDifference !== undefined) {
            html += '<div class="stat-item">';
            html += '<div class="stat-label">RMS Log Difference:</div>';
            html += `<div class="stat-value">${comp.rmsLogDifference.toFixed(3)}</div>`;
            html += '</div>';
        }
        
        html += '<div class="stat-item">';
        html += '<div class="stat-label">Trees Better in Split 1:</div>';
        html += `<div class="stat-value">${comp.trees1BetterCount} (${(comp.trees1BetterCount/comp.numTreesCompared*100).toFixed(0)}%)</div>`;
        html += '</div>';
        
        html += '<div class="stat-item">';
        html += '<div class="stat-label">Trees Better in Split 2:</div>';
        html += `<div class="stat-value">${comp.trees2BetterCount} (${(comp.trees2BetterCount/comp.numTreesCompared*100).toFixed(0)}%)</div>`;
        html += '</div>';
        
        if (comp.infiniteDifferenceCount > 0) {
            html += '<div class="stat-item">';
            html += '<div class="stat-label">Trees in One CCD Only:</div>';
            html += `<div class="stat-value">${comp.infiniteDifferenceCount}</div>`;
            html += '</div>';
        }
        
        html += '</div>';
        
        // Compare to theoretical prediction
        if (results.relativeDissonance !== undefined && comp.rmsRelativeDifference !== undefined) {
            const theoretical = 2 * Math.sqrt(results.relativeDissonance);
            html += `<p class="empirical-note">`;
            html += `<strong>Theoretical vs CCD-based:</strong> `;
            html += `The 2√δ rule predicts ${(theoretical * 100).toFixed(0)}% typical difference, `;
            html += `CCD probabilities show ${(comp.rmsRelativeDifference * 100).toFixed(0)}% RMS difference for sampled trees.`;
            html += `</p>`;
        }
        
        html += '</div>';
    }
    
    html += '</div>';
    
    return html;
}

/**
 * Calculate median of an array
 */
function median(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate mean of an array
 */
function mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}