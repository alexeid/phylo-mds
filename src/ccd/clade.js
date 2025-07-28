// ccd/clade.js - Clade and CladePartition classes

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