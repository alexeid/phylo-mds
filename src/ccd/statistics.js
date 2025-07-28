// ccd/statistics.js - Helper functions for computing CCD statistics

/**
 * Helper function to compute CCD statistics
 */
export function computeCCDStatistics(ccd) {
    const stats = {
        numberOfTrees: ccd.getNumberOfBaseTrees(),
        numberOfClades: ccd.getNumberOfClades(),
        numberOfLeaves: ccd.getNumberOfLeaves(),
        entropy: ccd.getEntropy(),
        entropyLewis: ccd.getEntropyLewis((message) => console.log(message)),
        maxLogTreeProbability: ccd.getMaxLogTreeProbability((message) => console.log(message)),
        maxTreeProbability: ccd.getMaxTreeProbability()
    };
    
    // Get clade probabilities
    ccd.computeCladeProbabilitiesIfDirty();
    
    // Find most probable clades
    const clades = Array.from(ccd.getClades());
    const nonTrivialClades = clades.filter(c => !c.isLeaf() && !c.isRoot());
    nonTrivialClades.sort((a, b) => b.getProbability() - a.getProbability());
    
    stats.topClades = nonTrivialClades.slice(0, 10).map(clade => ({
        size: clade.size(),
        probability: clade.getProbability(),
        occurrences: clade.getNumberOfOccurrences()
    }));
    
    return stats;
}

/**
 * Helper function to compute CCD statistics with progress reporting
 */
export async function computeCCDStatisticsAsync(ccd, progressCallback = null) {
    const stats = {
        numberOfTrees: ccd.getNumberOfBaseTrees(),
        numberOfClades: ccd.getNumberOfClades(),
        numberOfLeaves: ccd.getNumberOfLeaves()
    };
    
    if (progressCallback) {
        progressCallback('Computing clade probabilities...');
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Get clade probabilities
    ccd.computeCladeProbabilitiesIfDirty();
    
    if (progressCallback) {
        progressCallback('Computing entropy (standard method)...');
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Compute entropy
    stats.entropy = ccd.getEntropy();
    
    if (progressCallback) {
        progressCallback('Computing entropy (Lewis method)...');
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Compute Lewis entropy with progress callback
    const lewisProgressCallback = async (message) => {
        if (progressCallback) {
            progressCallback(message);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    };
    
    stats.entropyLewis = ccd.getEntropyLewis(lewisProgressCallback);
    
    if (progressCallback) {
        progressCallback('Computing maximum tree probability...');
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Compute max tree probability with progress callback
    const maxProbProgressCallback = async (message) => {
        if (progressCallback) {
            progressCallback(message);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    };
    
    stats.maxLogTreeProbability = ccd.getMaxLogTreeProbability(maxProbProgressCallback);
    stats.maxTreeProbability = ccd.getMaxTreeProbability();
    
    if (progressCallback) {
        progressCallback('Finding most probable clades...');
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Find most probable clades
    const clades = Array.from(ccd.getClades());
    const nonTrivialClades = clades.filter(c => !c.isLeaf() && !c.isRoot());
    nonTrivialClades.sort((a, b) => b.getProbability() - a.getProbability());
    
    stats.topClades = nonTrivialClades.slice(0, 10).map(clade => ({
        size: clade.size(),
        probability: clade.getProbability(),
        occurrences: clade.getNumberOfOccurrences()
    }));
    
    return stats;
}