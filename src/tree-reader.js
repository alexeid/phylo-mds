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
        
        // Update loading message
        const loadingDiv = document.getElementById('loadingMsg');
        if (loadingDiv) {
            const loadingText = loadingDiv.querySelector('.loading-text');
            if (loadingText) {
                // Give more context about what's happening
                const sizeInMB = (content.length / (1024 * 1024)).toFixed(2);
                loadingText.textContent = `Parsing ${format} file (${sizeInMB} MB)...`;
            }
        }
        
        let trees;
        const startTime = Date.now();
        
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
        
        const parseTime = Date.now() - startTime;
        console.log(`Parsed ${trees.length} trees in ${parseTime}ms`);
        
        // Update loading message with tree count
        if (loadingDiv) {
            const loadingText = loadingDiv.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = `Processing ${trees.length} trees...`;
            }
        }
        
        // The trees from phylojs should already have proper structure
        // Just ensure they have the methods we need
        trees.forEach((tree, index) => {
            // Update progress periodically
            if (index % 100 === 0 && loadingDiv) {
                const loadingText = loadingDiv.querySelector('.loading-text');
                if (loadingText) {
                    loadingText.textContent = `Processing tree ${index + 1} of ${trees.length}...`;
                }
            }
            
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

export async function readTreesAsync(content, format, progressCallback) {
    try {
        if (format === 'auto') {
            format = detectFormat(content);
        }
        
        // Give initial feedback about file size
        const sizeInMB = (content.length / (1024 * 1024)).toFixed(2);
        
        if (progressCallback) {
            await progressCallback(`Detected ${format} format (${sizeInMB} MB file)...`);
            await new Promise(resolve => setTimeout(resolve, 50)); // Brief pause to show message
            await progressCallback(`Parsing ${format} file, please wait...`);
        }
        
        // For large files, we might want to give periodic updates during parsing
        // but phylojs doesn't support progress callbacks, so we'll parse in one go
        const startTime = Date.now();
        
        // Give the UI a chance to update before starting the heavy parsing
        await new Promise(resolve => setTimeout(resolve, 10));
        
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
        
        const parseTime = Date.now() - startTime;
        console.log(`Parsed ${trees.length} trees in ${parseTime}ms`);
        
        if (progressCallback) {
            await progressCallback(`Parsed ${trees.length} trees in ${(parseTime/1000).toFixed(1)}s`);
            await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause to show completion
            await progressCallback(`Processing ${trees.length} trees...`);
        }
        
        // Process trees in chunks to allow UI updates
        const chunkSize = 50;
        for (let i = 0; i < trees.length; i += chunkSize) {
            const chunk = trees.slice(i, Math.min(i + chunkSize, trees.length));
            
            chunk.forEach((tree, chunkIndex) => {
                const index = i + chunkIndex;
                
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
            
            if (progressCallback) {
                const processed = Math.min(i + chunkSize, trees.length);
                await progressCallback(`Processing tree ${processed} of ${trees.length}...`);
            }
            
            // Allow UI to update
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        return trees;
    } catch (error) {
        throw new Error('Failed to parse trees: ' + error.message);
    }
}