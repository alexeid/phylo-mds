// ccd/abstract-ccd.js - Abstract base class for Conditional Clade Distribution

import { BitSet } from '../bitset';
import { Clade } from './clade';

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

    /**
     * Calculate the log probability of a specific tree under this CCD
     * @param {Tree} tree - The tree to evaluate
     * @returns {number} Log probability of the tree
     */
    getTreeLogProbability(tree) {
        // First ensure clade probabilities are computed
        this.computeCladeProbabilitiesIfDirty();
        
        let logProb = 0;
        
        // Traverse the tree and sum log CCPs
        const calculateNodeLogProb = (node) => {
            if (node.isLeaf()) {
                return null; // Leaf nodes don't contribute to probability
            }
            
            // Get clades for children
            const child1Clade = calculateNodeLogProb(node.children[0]);
            const child2Clade = calculateNodeLogProb(node.children[1]);
            
            // Build clade for this node
            const cladeInBits = new BitSet(this.leafArraySize);
            
            if (child1Clade) {
                cladeInBits.or(child1Clade.cladeInBits);
            } else {
                // Child is a leaf - add its bit
                const leafNode = node.children[0];
                const label = leafNode.label || leafNode.id.toString();
                const index = this.taxonMapping.get(label);
                if (index !== undefined) {
                    cladeInBits.set(index);
                }
            }
            
            if (child2Clade) {
                cladeInBits.or(child2Clade.cladeInBits);
            } else {
                // Child is a leaf - add its bit
                const leafNode = node.children[1];
                const label = leafNode.label || leafNode.id.toString();
                const index = this.taxonMapping.get(label);
                if (index !== undefined) {
                    cladeInBits.set(index);
                }
            }
            
            // Find this clade in the CCD
            const clade = this.getClade(cladeInBits);
            if (!clade) {
                // Clade not in CCD means probability 0
                logProb = -Infinity;
                return clade;
            }
            
            // Find the partition
            if (child1Clade || child2Clade) {
                const partition = clade.getCladePartition(
                    child1Clade || this.getLeafClade(node.children[0]),
                    child2Clade || this.getLeafClade(node.children[1])
                );
                
                if (!partition) {
                    // Partition not in CCD means probability 0
                    logProb = -Infinity;
                    return clade;
                }
                
                // Add log CCP to total
                logProb += partition.getLogCCP();
            }
            
            return clade;
        };
        
        calculateNodeLogProb(tree.root);
        
        return logProb;
    }
    
    /**
     * Get the clade for a leaf node
     * @param {Node} leafNode - A leaf node
     * @returns {Clade} The clade containing just this leaf
     */
    getLeafClade(leafNode) {
        const cladeInBits = new BitSet(this.leafArraySize);
        const label = leafNode.label || leafNode.id.toString();
        const index = this.taxonMapping.get(label);
        if (index !== undefined) {
            cladeInBits.set(index);
            return this.getClade(cladeInBits);
        }
        return null;
    }

    // Abstract methods to be implemented by subclasses
    tidyUpCacheIfDirty() {
        throw new Error('Abstract method tidyUpCacheIfDirty must be implemented');
    }

    removeCladePartitionIfNecessary(clade, partition) {
        throw new Error('Abstract method removeCladePartitionIfNecessary must be implemented');
    }
}