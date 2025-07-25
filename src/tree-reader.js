import * as phylo from 'phylojs';

export function detectFormat(content) {
    if (content.trim().startsWith('(')) return 'newick';
    if (content.toLowerCase().includes('#nexus')) return 'nexus';
    if (content.includes('<?xml') && content.includes('phyloxml')) return 'phyloxml';
    if (content.includes('<?xml') && content.includes('nexml')) return 'nexml';
    if (content.trim().startsWith('{')) return 'phyjson';
    return 'newick';
}

export function readTrees(content, format) {
    try {
        if (format === 'auto') {
            format = detectFormat(content);
        }
        
        let trees;
        switch(format) {
            case 'newick':
                trees = phylo.readTreesFromNewick(content);
                break;
            case 'nexus':
                trees = phylo.readTreesFromNexus(content);
                break;
            case 'phyloxml':
                trees = phylo.readTreesFromPhyloXML(content);
                break;
            case 'nexml':
                trees = phylo.readTreesFromNeXML(content);
                break;
            case 'phyjson':
                trees = phylo.readTreesFromPhyJSON(content);
                break;
            default:
                throw new Error('Unknown format: ' + format);
        }
        
        // The trees from phylojs should already have proper structure
        // Just ensure they have the methods we need
        trees.forEach(tree => {
            // Add leafList getter if not present
            if (!tree.leafList && tree.nodeList) {
                Object.defineProperty(tree, 'leafList', {
                    get: function() {
                        return this.nodeList.filter(n => n.isLeaf());
                    }
                });
            }
            
            // Add getTipLabels method if not present
            if (!tree.getTipLabels) {
                tree.getTipLabels = function() {
                    const leafList = this.leafList || [];
                    return leafList.map(leaf => leaf.label || leaf.id.toString());
                };
            }
        });
        
        return trees;
    } catch (error) {
        throw new Error('Failed to parse trees: ' + error.message);
    }
}