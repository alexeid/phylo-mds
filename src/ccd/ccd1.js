// ccd/ccd1.js - CCD1 implementation

import { AbstractCCD } from './abstract-ccd';

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