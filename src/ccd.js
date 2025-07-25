// ccd.js - Optimized Conditional Clade Distribution implementation

import { BitSet } from './bitset';

/**
 * Represents a clade in the CCD graph
 */
export class Clade {
    constructor(cladeInBits, ccd) {
        this.cladeInBits = cladeInBits;
        this.ccd = ccd;
        this.partitions = [];
        this.parentClades = new Set();
        this.childClades = new Set();
        this.occurrenceCount = 0;
        this.sumOfOccurredHeights = 0;
        this.probability = -1;
        this.entropy = -1;
        this.maxSubtreeCCP = -Infinity;
        this.maxSubtreeCCPPartition = null;
        this.commonAncestorHeight = 0;
        this.sumCladeCredibility = -1;
        // Add visited flag for traversal algorithms
        this._visited = false;
    }

    isLeaf() {
        return this.cladeInBits.cardinality() === 1;
    }

    isRoot() {
        return this === this.ccd.rootClade;
    }

    isCherry() {
        return this.cladeInBits.cardinality() === 2;
    }

    isMonophyletic() {
        return this.partitions.length === 1;
    }

    size() {
        return this.cladeInBits.cardinality();
    }

    increaseOccurrenceCount(height) {
        this.occurrenceCount++;
        this.sumOfOccurredHeights += height || 0;
    }

    decreaseOccurrenceCount(height) {
        this.occurrenceCount--;
        this.sumOfOccurredHeights -= height || 0;
    }

    getMeanOccurredHeight() {
        return this.occurrenceCount > 0 ? this.sumOfOccurredHeights / this.occurrenceCount : 0;
    }

    getNumberOfOccurrences() {
        return this.occurrenceCount;
    }

    getNumberOfPartitions() {
        return this.partitions.length;
    }

    getPartitions() {
        return this.partitions;
    }

    createCladePartition(firstChild, secondChild) {
        const partition = new CladePartition(this, firstChild, secondChild);
        this.partitions.push(partition);
        
        this.childClades.add(firstChild);
        this.childClades.add(secondChild);
        firstChild.parentClades.add(this);
        secondChild.parentClades.add(this);
        
        return partition;
    }

    getCladePartition(firstChild, secondChild) {
        for (const partition of this.partitions) {
            if (partition.containsChildClades(firstChild, secondChild)) {
                return partition;
            }
        }
        return null;
    }

    removePartition(partition) {
        const index = this.partitions.indexOf(partition);
        if (index > -1) {
            this.partitions.splice(index, 1);
        }
    }

    normalizeCCPs() {
        let sum = 0;
        for (const partition of this.partitions) {
            sum += partition.ccp;
        }
        if (sum > 0) {
            for (const partition of this.partitions) {
                partition.ccp /= sum;
                partition.logCCP = Math.log(partition.ccp);
            }
        }
    }

    getProbability() {
        return this.probability;
    }

    setProbability(prob) {
        this.probability = prob;
    }

    getEntropy() {
        if (this.entropy < 0) {
            this.computeEntropy();
        }
        return this.entropy;
    }

    computeEntropy() {
        if (this.isLeaf()) {
            this.entropy = 0;
            return;
        }

        this.entropy = 0;
        for (const partition of this.partitions) {
            const ccp = partition.getCCP();
            if (ccp > 0) {
                const child1Entropy = partition.childClades[0].getEntropy();
                const child2Entropy = partition.childClades[1].getEntropy();
                this.entropy += ccp * (child1Entropy + child2Entropy - Math.log(ccp));
            }
        }
    }

    getMaxSubtreeCCPPartition() {
        return this.maxSubtreeCCPPartition;
    }

    getMaxSubtreeLogCCP() {
        return this.maxSubtreeCCP;
    }

    resetCachedValues() {
        this.probability = -1;
        this.entropy = -1;
        this.maxSubtreeCCP = -Infinity;
        this.maxSubtreeCCPPartition = null;
        this.sumCladeCredibility = -1;
        this._visited = false;
    }

    toString() {
        return `Clade[${this.cladeInBits.toString()}]`;
    }
}

/**
 * Represents a clade partition (split) in the CCD graph
 */
export class CladePartition {
    constructor(parentClade, firstChild, secondChild) {
        this.parentClade = parentClade;
        this.childClades = [firstChild, secondChild];
        this.occurrenceCount = 0;
        this.sumOfOccurredHeights = 0;
        this.ccp = -1; // Conditional Clade Probability
        this.logCCP = -Infinity;
    }

    containsChildClades(child1, child2) {
        return (this.childClades[0] === child1 && this.childClades[1] === child2) ||
               (this.childClades[0] === child2 && this.childClades[1] === child1);
    }

    containsChildClade(child) {
        return this.childClades[0] === child || this.childClades[1] === child;
    }

    getOtherChildClade(child) {
        if (this.childClades[0] === child) return this.childClades[1];
        if (this.childClades[1] === child) return this.childClades[0];
        return null;
    }

    increaseOccurrenceCount(height) {
        this.occurrenceCount++;
        this.sumOfOccurredHeights += height || 0;
    }

    decreaseOccurrenceCount(height) {
        this.occurrenceCount--;
        this.sumOfOccurredHeights -= height || 0;
    }

    getNumberOfOccurrences() {
        return this.occurrenceCount;
    }

    getMeanOccurredHeight() {
        return this.occurrenceCount > 0 ? this.sumOfOccurredHeights / this.occurrenceCount : 0;
    }

    getCCP() {
        return this.ccp;
    }

    getLogCCP() {
        return this.logCCP;
    }

    setCCP(value) {
        this.ccp = value;
        this.logCCP = value > 0 ? Math.log(value) : -Infinity;
    }

    getProbability() {
        return this.parentClade.getProbability() * this.ccp;
    }

    toString() {
        return `Partition[${this.childClades[0].cladeInBits.toString()}, ${this.childClades[1].cladeInBits.toString()}]`;
    }
}

/**
 * Abstract base class for Conditional Clade Distribution
 */
export class AbstractCCD {
    constructor(numLeaves, storeBaseTrees = false) {
        this.leafArraySize = numLeaves;
        this.storeBaseTrees = storeBaseTrees;
        this.baseTrees = [];
        this.numBaseTrees = 0;
        this.cladeMapping = new Map();
        this.rootClade = null;
        this.taxonNames = null;
        this.taxonMapping = null;
        
        // Cache state
        this.probabilitiesDirty = false;
        this.entropyDirty = false;
        this.numberOfTopologiesDirty = false;
        
        this.initializeRootClade(numLeaves);
    }

    initializeRootClade(numLeaves) {
        const rootBitSet = new BitSet(numLeaves);
        rootBitSet.setRange(0, numLeaves);
        
        this.rootClade = new Clade(rootBitSet, this);
        this.cladeMapping.set(rootBitSet.toString(), this.rootClade);
    }

    addTree(tree) {
        this.numBaseTrees++;
        this.cladifyTree(tree);
        this.setCacheAsDirty();
    }

    cladifyTree(tree) {
        if (this.storeBaseTrees) {
            this.baseTrees.push(tree);
        } else if (this.baseTrees.length === 0) {
            this.baseTrees.push(tree);
        }
        this.cladifyVertex(tree.root);
    }

    cladifyVertex(vertex) {
        const cladeInBits = new BitSet(this.leafArraySize);
        let firstChildClade = null;
        let secondChildClade = null;

        if (vertex.isLeaf()) {
            // For leaves, we need to find their index in the taxon mapping
            const label = vertex.label || vertex.id.toString();
            let index = -1;
            
            if (this.taxonMapping) {
                index = this.taxonMapping.get(label);
            }
            
            if (index === -1 || index === undefined) {
                throw new Error(`Taxon "${label}" not found in taxon mapping`);
            }
            
            cladeInBits.set(index);
        } else {
            firstChildClade = this.cladifyVertex(vertex.children[0]);
            secondChildClade = this.cladifyVertex(vertex.children[1]);

            cladeInBits.or(firstChildClade.cladeInBits);
            cladeInBits.or(secondChildClade.cladeInBits);
        }

        let currentClade = this.cladeMapping.get(cladeInBits.toString());
        if (!currentClade) {
            currentClade = this.addNewClade(cladeInBits);
        }
        currentClade.increaseOccurrenceCount(vertex.height || 0);

        if (!vertex.isLeaf()) {
            let currentPartition = currentClade.getCladePartition(firstChildClade, secondChildClade);
            if (!currentPartition) {
                currentPartition = currentClade.createCladePartition(firstChildClade, secondChildClade);
            }
            currentPartition.increaseOccurrenceCount(vertex.height || 0);
        }

        return currentClade;
    }

    addNewClade(cladeInBits) {
        const clade = new Clade(cladeInBits, this);
        this.cladeMapping.set(cladeInBits.toString(), clade);
        return clade;
    }

    getClade(cladeInBits) {
        return this.cladeMapping.get(cladeInBits.toString());
    }

    getNumberOfClades() {
        return this.cladeMapping.size;
    }

    getClades() {
        return Array.from(this.cladeMapping.values());
    }

    getNumberOfLeaves() {
        return this.leafArraySize;
    }

    getNumberOfBaseTrees() {
        return this.numBaseTrees;
    }

    getRootClade() {
        return this.rootClade;
    }

    setCacheAsDirty() {
        this.probabilitiesDirty = true;
        this.entropyDirty = true;
        this.numberOfTopologiesDirty = true;
    }

    resetCache() {
        for (const clade of this.cladeMapping.values()) {
            clade.resetCachedValues();
        }
        this.probabilitiesDirty = false;
        this.entropyDirty = false;
        this.numberOfTopologiesDirty = false;
    }

    resetCacheIfProbabilitiesDirty() {
        if (this.probabilitiesDirty) {
            this.resetCache();
        }
    }

    computeCladeProbabilities() {
        this.resetCacheIfProbabilitiesDirty();

        // Reset all clade probabilities
        for (const clade of this.getClades()) {
            clade.setProbability(-1);
        }

        // BFS traversal to compute probabilities
        const queue = [];
        const visitCountMap = new Map();

        this.rootClade.setProbability(1);
        queue.push(this.rootClade);
        visitCountMap.set(this.rootClade, 0);

        while (queue.length > 0) {
            const clade = queue.shift();
            const count = visitCountMap.get(clade);
            
            if (count !== clade.parentClades.size) {
                continue;
            }

            const parentProbability = clade.getProbability();

            for (const partition of clade.getPartitions()) {
                for (const childClade of partition.childClades) {
                    let childProbability = Math.max(0, childClade.getProbability());
                    childProbability += parentProbability * partition.getCCP();
                    
                    // Rounding correction
                    if (childProbability > 1 && childProbability < 1.00001) {
                        childProbability = 1.0;
                    }
                    
                    childClade.setProbability(childProbability);

                    const childCount = (visitCountMap.get(childClade) || 0) + 1;
                    visitCountMap.set(childClade, childCount);
                    queue.push(childClade);
                }
            }

            visitCountMap.set(clade, -1);
        }
    }

    getEntropy() {
        this.computeCladeProbabilitiesIfDirty();
        let entropy = 0;
        
        for (const clade of this.getClades()) {
            for (const partition of clade.getPartitions()) {
                const logCCP = partition.getLogCCP();
                if (logCCP > -Infinity) {
                    entropy += partition.getProbability() * logCCP;
                }
            }
        }
        
        return -entropy;
    }

    getEntropyLewis(progressCallback = null) {
        if (this.entropyDirty) {
            // Only reset entropy values, not all cached values
            for (const clade of this.cladeMapping.values()) {
                clade.entropy = -1;
            }
            this.entropyDirty = false;
        }
        
        const startTime = Date.now();
        console.log(`Starting Lewis entropy computation for ${this.cladeMapping.size} clades...`);
        
        // Compute entropy in post-order traversal to ensure children are computed first
        const computedClades = new Set();
        const stack = [];
        
        // Initialize with leaf clades (they have entropy = 0)
        for (const clade of this.cladeMapping.values()) {
            if (clade.isLeaf()) {
                clade.entropy = 0;
                computedClades.add(clade);
            }
        }
        
        // Build dependency graph and compute in topological order
        const computeCladeEntropy = (clade) => {
            if (computedClades.has(clade)) {
                return clade.entropy;
            }
            
            if (clade.isLeaf()) {
                clade.entropy = 0;
                computedClades.add(clade);
                return 0;
            }
            
            // Ensure all children are computed first
            for (const partition of clade.partitions) {
                for (const child of partition.childClades) {
                    if (!computedClades.has(child)) {
                        computeCladeEntropy(child);
                    }
                }
            }
            
            // Now compute this clade's entropy
            clade.computeEntropy();
            computedClades.add(clade);
            
            // Progress reporting
            if (progressCallback && computedClades.size % 100 === 0) {
                const percent = Math.round((computedClades.size / this.cladeMapping.size) * 100);
                progressCallback(`Computing Lewis entropy: ${percent}% complete (${computedClades.size}/${this.cladeMapping.size} clades)`);
            }
            
            return clade.entropy;
        };
        
        // Start from root
        const result = computeCladeEntropy(this.rootClade);
        
        const elapsed = Date.now() - startTime;
        console.log(`Lewis entropy computed in ${elapsed}ms`);
        
        return result;
    }

    computeCladeProbabilitiesIfDirty() {
        this.resetCacheIfProbabilitiesDirty();
        if (this.rootClade.getProbability() < 0) {
            this.computeCladeProbabilities();
        }
    }

    getMaxLogTreeProbability(progressCallback = null) {
        this.tidyUpCacheIfDirty();
        
        const startTime = Date.now();
        console.log(`Starting max tree probability computation for ${this.cladeMapping.size} clades...`);
        
        // Reset all max CCP values
        for (const clade of this.cladeMapping.values()) {
            clade.maxSubtreeCCP = -Infinity;  // Use -Infinity instead of -1
            clade.maxSubtreeCCPPartition = null;
        }
        
        // Use iterative approach with topological sort
        const clades = Array.from(this.cladeMapping.values());
        
        // First pass: compute for all leaf clades
        let computed = 0;
        for (const clade of clades) {
            if (clade.isLeaf()) {
                clade.maxSubtreeCCP = 0; // log(1) = 0
                computed++;
            }
        }
        
        console.log(`Initialized ${computed} leaf clades`);
        
        // Debug: Check CCP values
        let totalPartitions = 0;
        let validPartitions = 0;
        for (const clade of clades) {
            for (const partition of clade.partitions) {
                totalPartitions++;
                if (partition.ccp > 0 && partition.ccp <= 1) {
                    validPartitions++;
                }
            }
        }
        console.log(`Total partitions: ${totalPartitions}, valid CCPs: ${validPartitions}`);
        
        // Iterative passes until all clades are computed
        let changed = true;
        let iterations = 0;
        const maxIterations = clades.length; // Safety check
        
        while (changed && iterations < maxIterations) {
            changed = false;
            iterations++;
            
            for (const clade of clades) {
                if (clade.maxSubtreeCCP > -Infinity) {
                    continue; // Already computed
                }
                
                // Skip leaves as they're already initialized
                if (clade.isLeaf()) {
                    continue;
                }
                
                // Check if all children have been computed
                let allChildrenComputed = true;
                for (const partition of clade.partitions) {
                    for (const child of partition.childClades) {
                        if (child.maxSubtreeCCP === -Infinity) {
                            allChildrenComputed = false;
                            break;
                        }
                    }
                    if (!allChildrenComputed) break;
                }
                
                if (allChildrenComputed && clade.partitions.length > 0) {
                    // Compute max CCP for this clade
                    let maxLogCCP = -Infinity;
                    let maxPartition = null;
                    
                    for (const partition of clade.partitions) {
                        const child1MaxLogCCP = partition.childClades[0].maxSubtreeCCP;
                        const child2MaxLogCCP = partition.childClades[1].maxSubtreeCCP;
                        const partitionCCP = partition.getCCP();
                        const partitionLogCCP = partition.getLogCCP();
                        
                        // Debug first few computations
                        if (computed < 5 && clade.partitions.length === 1) {
                            console.log(`Clade ${clade.cladeInBits.toString()}: partition CCP=${partitionCCP}, logCCP=${partitionLogCCP}`);
                        }
                        
                        // Check for invalid values
                        if (isNaN(partitionLogCCP) || partitionLogCCP === -Infinity || partitionCCP <= 0) {
                            continue;
                        }
                        
                        const totalLogCCP = partitionLogCCP + child1MaxLogCCP + child2MaxLogCCP;
                        
                        if (totalLogCCP > maxLogCCP) {
                            maxLogCCP = totalLogCCP;
                            maxPartition = partition;
                        }
                    }
                    
                    // If no valid partition found, this clade can't form a valid tree
                    if (maxLogCCP === -Infinity) {
                        console.warn(`No valid partition found for clade ${clade.cladeInBits.toString()}`);
                        clade.maxSubtreeCCP = -Infinity;
                    } else {
                        clade.maxSubtreeCCP = maxLogCCP;
                        clade.maxSubtreeCCPPartition = maxPartition;
                    }
                    
                    computed++;
                    changed = true;
                    
                    // Progress reporting
                    if (progressCallback && computed % 100 === 0) {
                        const percent = Math.round((computed / clades.length) * 100);
                        progressCallback(`Computing maximum tree probability: ${percent}% complete (${computed}/${clades.length} clades)`);
                    }
                }
            }
            
            console.log(`Iteration ${iterations}: computed ${computed}/${clades.length} clades`);
        }
        
        if (iterations >= maxIterations) {
            console.warn('Max iterations reached in max tree probability computation');
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`Max tree probability computed in ${elapsed}ms (${iterations} iterations)`);
        console.log(`Root clade max log CCP: ${this.rootClade.maxSubtreeCCP}`);
        
        // Return root clade's max log CCP
        return this.rootClade.maxSubtreeCCP;
    }

    getMaxTreeProbability(progressCallback = null) {
        return Math.exp(this.getMaxLogTreeProbability(progressCallback));
    }

    // Abstract methods to be implemented by subclasses
    tidyUpCacheIfDirty() {
        throw new Error('Abstract method tidyUpCacheIfDirty must be implemented');
    }

    removeCladePartitionIfNecessary(clade, partition) {
        throw new Error('Abstract method removeCladePartitionIfNecessary must be implemented');
    }
}

/**
 * CCD1 implementation - standard CCD where partition probabilities are based on frequency
 */
export class CCD1 extends AbstractCCD {
    constructor(numLeaves, storeBaseTrees = false) {
        super(numLeaves, storeBaseTrees);
    }

    static fromTrees(trees, burnin = 0) {
        if (trees.length === 0) {
            throw new Error('No trees provided');
        }
        
        // Count unique taxa across all trees and create mapping
        const allTaxa = new Set();
        trees.forEach(tree => {
            const leafList = tree.leafList;
            leafList.forEach(leaf => {
                const label = leaf.label || leaf.id.toString();
                allTaxa.add(label);
            });
        });
        
        const numLeaves = allTaxa.size;
        console.log(`Creating CCD for ${numLeaves} unique taxa`);
        
        const ccd = new CCD1(numLeaves, false);
        
        // Create taxon mapping
        const sortedTaxa = Array.from(allTaxa).sort();
        ccd.taxonNames = sortedTaxa;
        ccd.taxonMapping = new Map();
        sortedTaxa.forEach((taxon, index) => {
            ccd.taxonMapping.set(taxon, index);
        });
        
        // Apply burnin
        const burninCount = Math.floor(trees.length * burnin);
        const treesToUse = trees.slice(burninCount);
        
        // Process each tree
        for (const tree of treesToUse) {
            ccd.addTree(tree);
        }
        
        // Initialize CCPs
        ccd.initialize();
        
        return ccd;
    }

    static async fromTreesAsync(trees, burnin = 0, progressCallback = null) {
        if (trees.length === 0) {
            throw new Error('No trees provided');
        }
        
        // Count unique taxa across all trees and create mapping
        const allTaxa = new Set();
        trees.forEach(tree => {
            const leafList = tree.leafList;
            leafList.forEach(leaf => {
                const label = leaf.label || leaf.id.toString();
                allTaxa.add(label);
            });
        });
        
        const numLeaves = allTaxa.size;
        console.log(`Creating CCD for ${numLeaves} unique taxa`);
        
        const ccd = new CCD1(numLeaves, false);
        
        // Create taxon mapping
        const sortedTaxa = Array.from(allTaxa).sort();
        ccd.taxonNames = sortedTaxa;
        ccd.taxonMapping = new Map();
        sortedTaxa.forEach((taxon, index) => {
            ccd.taxonMapping.set(taxon, index);
        });
        
        // Apply burnin
        const burninCount = Math.floor(trees.length * burnin);
        const treesToUse = trees.slice(burninCount);
        
        // Process each tree with progress reporting
        for (let i = 0; i < treesToUse.length; i++) {
            if (progressCallback) {
                await progressCallback(i + 1, treesToUse.length);
            }
            ccd.addTree(treesToUse[i]);
        }
        
        if (progressCallback) {
            await progressCallback(treesToUse.length, treesToUse.length);
        }
        
        // Initialize CCPs
        ccd.initialize();
        
        return ccd;
    }

    initialize() {
        console.log('Initializing CCD - computing CCPs...');
        
        // Calculate CCPs (Conditional Clade Probabilities) for all partitions
        let totalClades = 0;
        let totalPartitions = 0;
        
        for (const clade of this.getClades()) {
            totalClades++;
            const totalOccurrences = clade.getNumberOfOccurrences();
            
            if (clade.partitions.length > 0) {
                // First, normalize the partition occurrences to get CCPs
                let partitionSum = 0;
                for (const partition of clade.partitions) {
                    partitionSum += partition.getNumberOfOccurrences();
                }
                
                for (const partition of clade.partitions) {
                    totalPartitions++;
                    const partitionOccurrences = partition.getNumberOfOccurrences();
                    // CCP = partition occurrences / total clade occurrences
                    // Note: partitionSum should equal totalOccurrences for consistency
                    const ccp = partitionSum > 0 ? partitionOccurrences / partitionSum : 0;
                    partition.setCCP(ccp);
                    
                    // Debug first few CCPs
                    if (totalPartitions <= 5) {
                        console.log(`Partition ${totalPartitions}: occurrences=${partitionOccurrences}, total=${partitionSum}, CCP=${ccp}`);
                    }
                }
            }
        }
        
        console.log(`Initialized ${totalClades} clades with ${totalPartitions} partitions`);
        
        // Don't mark cache as dirty after initialization
        // Only mark entropy as dirty since we changed CCPs
        this.entropyDirty = true;
        this.numberOfTopologiesDirty = true;
        // Keep probabilitiesDirty = false to avoid resetting cached values
    }

    tidyUpCacheIfDirty() {
        // For CCD1, we don't need to do anything here
        // The specific dirty flags are handled in the respective methods
    }

    removeCladePartitionIfNecessary(clade, partition) {
        if (partition.getNumberOfOccurrences() <= 0) {
            clade.removePartition(partition);
            return true;
        }
        return false;
    }

    toString() {
        return `CCD1 [leaves: ${this.getNumberOfLeaves()}, clades: ${this.getNumberOfClades()}, trees: ${this.getNumberOfBaseTrees()}]`;
    }
}

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