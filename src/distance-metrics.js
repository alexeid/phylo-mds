// src/distance-metrics.js
export function calculateRFDistance(tree1, tree2) {
    const splits1 = getTreeSplits(tree1);
    const splits2 = getTreeSplits(tree2);
    
    let symmetric_difference = 0;
    
    for (const split of splits1) {
        if (!splits2.some(s => areSplitsEqual(s, split))) {
            symmetric_difference++;
        }
    }
    
    for (const split of splits2) {
        if (!splits1.some(s => areSplitsEqual(s, split))) {
            symmetric_difference++;
        }
    }
    
    return symmetric_difference;
}

export function calculateSPRDistance(tree1, tree2) {
    const rf = calculateRFDistance(tree1, tree2);
    return Math.ceil(rf / 2);
}

export function calculatePathDistance(tree1, tree2) {
    const paths1 = getAllPairwisePaths(tree1);
    const paths2 = getAllPairwisePaths(tree2);
    
    let totalDiff = 0;
    let count = 0;
    
    for (const key in paths1) {
        if (paths2[key] !== undefined) {
            totalDiff += Math.abs(paths1[key] - paths2[key]);
            count++;
        }
    }
    
    return count > 0 ? totalDiff / count : Infinity;
}

function getTreeSplits(tree) {
    const splits = [];
    const tipLabels = tree.getTipLabels();
    
    function getSplitForNode(node) {
        if (node.isLeaf()) return null;
        
        const descendants = [];
        function collectDescendantLeaves(n) {
            if (n.isLeaf()) {
                descendants.push(n.label || n.id.toString());
            } else {
                n.children.forEach(child => collectDescendantLeaves(child));
            }
        }
        collectDescendantLeaves(node);
        
        const complement = tipLabels.filter(label => !descendants.includes(label));
        const split = [descendants.sort(), complement.sort()];
        return split;
    }
    
    function traverse(node) {
        if (!node.isLeaf()) {
            const split = getSplitForNode(node);
            if (split && split[0].length > 0 && split[1].length > 0) {
                splits.push(split);
            }
            node.children.forEach(child => traverse(child));
        }
    }
    
    traverse(tree.root);
    return splits;
}

function areSplitsEqual(split1, split2) {
    return (arraysEqual(split1[0], split2[0]) && arraysEqual(split1[1], split2[1])) ||
           (arraysEqual(split1[0], split2[1]) && arraysEqual(split1[1], split2[0]));
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function getAllPairwisePaths(tree) {
    const paths = {};
    const tips = [];
    
    // Collect all tip nodes
    function collectTips(node) {
        if (node.isLeaf()) {
            tips.push(node);
        } else {
            node.children.forEach(child => collectTips(child));
        }
    }
    collectTips(tree.root);
    
    // Calculate pairwise distances
    for (let i = 0; i < tips.length; i++) {
        for (let j = i + 1; j < tips.length; j++) {
            const label1 = tips[i].label || tips[i].id.toString();
            const label2 = tips[j].label || tips[j].id.toString();
            const key = [label1, label2].sort().join('-');
            
            const mrca = tree.getMRCA([tips[i], tips[j]]);
            const dist1 = getDistanceToAncestor(tips[i], mrca);
            const dist2 = getDistanceToAncestor(tips[j], mrca);
            
            paths[key] = dist1 + dist2;
        }
    }
    
    return paths;
}

function getDistanceToAncestor(node, ancestor) {
    let distance = 0;
    let current = node;
    
    while (current !== ancestor && current !== null) {
        distance += current.branchLength || 1;
        current = current.parent;
    }
    
    return distance;
}

export async function calculateDistanceMatrixWithProgress(trees, metric, progressCallback) {
    const n = trees.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            // Report progress
            if (progressCallback) {
                progressCallback(i, j, n);
            }
            
            // Allow UI to update
            if (j % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            let distance;
            
            switch(metric) {
                case 'rf':
                    distance = calculateRFDistance(trees[i], trees[j]);
                    break;
                case 'spr':
                    distance = calculateSPRDistance(trees[i], trees[j]);
                    break;
                case 'path':
                    distance = calculatePathDistance(trees[i], trees[j]);
                    break;
                default:
                    distance = calculateRFDistance(trees[i], trees[j]);
            }
            
            matrix[i][j] = distance;
            matrix[j][i] = distance;
        }
    }
    
    return matrix;
}

export function calculateDistanceMatrix(trees, metric) {
    const n = trees.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            let distance;
            
            switch(metric) {
                case 'rf':
                    distance = calculateRFDistance(trees[i], trees[j]);
                    break;
                case 'spr':
                    distance = calculateSPRDistance(trees[i], trees[j]);
                    break;
                case 'path':
                    distance = calculatePathDistance(trees[i], trees[j]);
                    break;
                default:
                    distance = calculateRFDistance(trees[i], trees[j]);
            }
            
            matrix[i][j] = distance;
            matrix[j][i] = distance;
        }
    }
    
    return matrix;
}