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
        
        switch(format) {
            case 'newick':
                return phylo.readTreesFromNewick(content);
            case 'nexus':
                return phylo.readTreesFromNexus(content);
            case 'phyloxml':
                return phylo.readTreesFromPhyloXML(content);
            case 'nexml':
                return phylo.readTreesFromNeXML(content);
            case 'phyjson':
                return phylo.readTreesFromPhyJSON(content);
            default:
                throw new Error('Unknown format: ' + format);
        }
    } catch (error) {
        throw new Error('Failed to parse trees: ' + error.message);
    }
}
