import './styles.css';
import { readTrees, readTreesAsync } from './tree-reader';
import { calculateDistanceMatrix, calculateDistanceMatrixWithProgress } from './distance-metrics';
import { classicalMDS } from './mds';
import { plotMDS, displayDistanceMatrix } from './plot';
import { CCD1, computeCCDStatistics, calculateWithinChainDissonance, formatDissonanceResults } from './ccd';
import Plotly from 'plotly.js-dist';

let trees = [];
let fileContent = '';
let currentCCD = null;

// DOM elements
const treeFileInput = document.getElementById('treeFile');
const calculateBtn = document.getElementById('calculateBtn');
const computeCCDBtn = document.getElementById('computeCCDBtn');
const checkMixingBtn = document.getElementById('checkMixingBtn');
const errorMsg = document.getElementById('errorMsg');
const loadingMsg = document.getElementById('loadingMsg');
const matrixToggle = document.getElementById('matrixToggle');
const distanceMatrixDiv = document.getElementById('distanceMatrix');

// Event listeners
treeFileInput.addEventListener('change', handleFileUpload);
calculateBtn.addEventListener('click', calculateMDS);
if (computeCCDBtn) {
    computeCCDBtn.addEventListener('click', computeCCD);
}
if (checkMixingBtn) {
    checkMixingBtn.addEventListener('click', checkMixing);
}
matrixToggle.addEventListener('click', toggleMatrix);

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            fileContent = e.target.result;
            calculateBtn.disabled = false;
            if (computeCCDBtn) {
                computeCCDBtn.disabled = false;
            }
            if (checkMixingBtn) {
                checkMixingBtn.disabled = false;
            }
            hideError();
            // Clear previous results
            currentCCD = null;
            const ccdStats = document.getElementById('ccdStats');
            if (ccdStats) {
                ccdStats.classList.add('hidden');
            }
        };
        reader.readAsText(file);
    }
}

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
}

function hideError() {
    errorMsg.style.display = 'none';
}

function showLoading(message) {
    const loadingDiv = document.getElementById('loadingMsg');
    const loadingText = loadingDiv.querySelector('.loading-text');
    loadingText.textContent = message || 'Processing...';
    loadingDiv.style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingMsg').style.display = 'none';
}

function toggleMatrix() {
    distanceMatrixDiv.classList.toggle('hidden');
}

async function calculateMDS() {
    hideError();
    showLoading('Processing trees...');
    
    // Remove any previous sampling notes
    const existingNotes = document.querySelectorAll('.sampling-note');
    existingNotes.forEach(note => note.remove());
    
    setTimeout(() => {
        try {
            const format = document.getElementById('fileFormat').value;
            const metric = document.getElementById('distanceMetric').value;
            const maxTrees = parseInt(document.getElementById('maxTrees').value) || 500;
            const burninPercent = parseInt(document.getElementById('burnin').value) || 0;
            
            // Read trees
            trees = readTrees(fileContent, format);
            
            if (trees.length < 2) {
                throw new Error('At least 2 trees are required for MDS analysis');
            }
            
            // Apply burnin
            let treesAfterBurnin = trees;
            let burninCount = 0;
            
            if (burninPercent > 0) {
                burninCount = Math.floor(trees.length * burninPercent / 100);
                treesAfterBurnin = trees.slice(burninCount);
                showLoading(`Removed ${burninCount} burnin trees (${burninPercent}%)...`);
            }
            
            if (treesAfterBurnin.length < 2) {
                throw new Error(`After ${burninPercent}% burnin, only ${treesAfterBurnin.length} trees remain. At least 2 trees are required.`);
            }
            
            // Thin trees if necessary
            let selectedTrees = treesAfterBurnin;
            let treeLabels;
            
            if (treesAfterBurnin.length > maxTrees) {
                showLoading(`Randomly sampling ${maxTrees} trees from ${treesAfterBurnin.length} post-burnin trees...`);
                const indices = randomSample(treesAfterBurnin.length, maxTrees);
                selectedTrees = indices.map(i => treesAfterBurnin[i]);
                // Adjust labels to show original tree numbers
                treeLabels = indices.map(i => `Tree ${i + burninCount + 1}`);
            } else {
                // Labels showing original position in file
                treeLabels = treesAfterBurnin.map((_, i) => `Tree ${i + burninCount + 1}`);
            }
            
            showLoading(`Calculating ${metric.toUpperCase()} distances for ${selectedTrees.length} trees...`);
            
            // Calculate distance matrix
            const distances = calculateDistanceMatrix(selectedTrees, metric);
            
            // Display distance matrix
            displayDistanceMatrix(distances, treeLabels);
            
            // Perform MDS
            showLoading('Performing MDS analysis...');
            const coords = classicalMDS(distances);
            
            // Plot results
            plotMDS(coords, treeLabels);
            
            hideLoading();
            
            // Show info about burnin and sampling
            const infoDiv = document.querySelector('.info');
            const processingNote = document.createElement('div');
            processingNote.className = 'sampling-note';
            
            let noteText = '<strong>Processing summary:</strong><ul>';
            noteText += `<li>Total trees in file: ${trees.length}</li>`;
            if (burninCount > 0) {
                noteText += `<li>Burnin: ${burninCount} trees (${burninPercent}%)</li>`;
                noteText += `<li>Trees after burnin: ${treesAfterBurnin.length}</li>`;
            }
            if (treesAfterBurnin.length > maxTrees) {
                noteText += `<li>Randomly sampled: ${maxTrees} trees</li>`;
            }
            noteText += `<li>Trees analyzed: ${selectedTrees.length}</li>`;
            noteText += '</ul>';
            
            processingNote.innerHTML = noteText;
            infoDiv.insertBefore(processingNote, infoDiv.firstChild);
            
        } catch (error) {
            showError(error.message);
            console.error(error);
            hideLoading();
        }
    }, 10);
}

// Helper function to randomly sample indices
function randomSample(n, k) {
    // Fisher-Yates shuffle variant for sampling
    const indices = Array.from({length: n}, (_, i) => i);
    const sampled = [];
    
    for (let i = 0; i < k; i++) {
        const j = Math.floor(Math.random() * (n - i)) + i;
        [indices[i], indices[j]] = [indices[j], indices[i]];
        sampled.push(indices[i]);
    }
    
    return sampled.sort((a, b) => a - b);
}

function updateProgress(message) {
    const progressDiv = document.querySelector('.loading-progress');
    if (progressDiv) {
        progressDiv.textContent = message;
    }
}

async function computeCCD() {
    hideError();
    showLoading('Reading trees...');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    try {
        const format = document.getElementById('fileFormat').value;
        const burninPercent = parseInt(document.getElementById('burnin').value) || 0;
        
        // Create a progress callback for reading trees
        const readProgressCallback = async (message) => {
            showLoading(message);
            await new Promise(resolve => setTimeout(resolve, 0));
        };
        
        // Read all trees with progress
        trees = await readTreesAsync(fileContent, format, readProgressCallback);
        
        if (trees.length < 2) {
            throw new Error('At least 2 trees are required for CCD analysis');
        }
        
        showLoading(`Constructing CCD from ${trees.length} trees...`);
        
        // Create CCD with burnin
        const burnin = burninPercent / 100;
        
        // Create a progress callback
        const progressCallback = async (current, total) => {
            const percent = Math.round((current / total) * 100);
            showLoading(`Processing tree ${current} of ${total} (${percent}%)...`);
            // Allow UI to update
            if (current % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        };
        
        currentCCD = await CCD1.fromTreesAsync(trees, burnin, progressCallback);
        
        showLoading('Computing CCD statistics...');
        await new Promise(resolve => setTimeout(resolve, 0));
        
        // Quick check on CCD size
        console.log(`CCD has ${currentCCD.getNumberOfClades()} clades`);
        
        // For very large CCDs, warn the user
        if (currentCCD.getNumberOfClades() > 10000) {
            showLoading('Large CCD detected, this may take a moment...');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Compute basic statistics first
        const stats = {
            numberOfTrees: currentCCD.getNumberOfBaseTrees(),
            numberOfClades: currentCCD.getNumberOfClades(),
            numberOfLeaves: currentCCD.getNumberOfLeaves()
        };
        
        try {
            // Compute clade probabilities
            showLoading('Computing clade probabilities...');
            await new Promise(resolve => setTimeout(resolve, 0));
            currentCCD.computeCladeProbabilitiesIfDirty();
            
            // Compute entropy
            showLoading('Computing phylogenetic entropy...');
            await new Promise(resolve => setTimeout(resolve, 0));
            stats.entropy = currentCCD.getEntropy();
            
            // Compute Lewis entropy
            showLoading('Computing entropy (Lewis method)...');
            await new Promise(resolve => setTimeout(resolve, 0));
            
            try {
                // Create a progress callback for Lewis entropy
                let lastUpdate = Date.now();
                const lewisProgressCallback = async (message) => {
                    const now = Date.now();
                    // Update UI at most every 100ms to avoid overwhelming it
                    if (now - lastUpdate > 100) {
                        showLoading(message);
                        await new Promise(resolve => setTimeout(resolve, 0));
                        lastUpdate = now;
                    }
                };
                
                stats.entropyLewis = currentCCD.getEntropyLewis(lewisProgressCallback);
            } catch (error) {
                console.error('Error computing Lewis entropy:', error);
                stats.entropyLewis = NaN;
            }
            
            // Compute max tree probability
            showLoading('Computing maximum tree probability...');
            await new Promise(resolve => setTimeout(resolve, 0));
            
            try {
                // Create a progress callback for max tree probability
                let lastUpdate = Date.now();
                const maxProbProgressCallback = async (message) => {
                    const now = Date.now();
                    // Update UI at most every 100ms to avoid overwhelming it
                    if (now - lastUpdate > 100) {
                        showLoading(message);
                        await new Promise(resolve => setTimeout(resolve, 0));
                        lastUpdate = now;
                    }
                };
                
                stats.maxLogTreeProbability = currentCCD.getMaxLogTreeProbability(maxProbProgressCallback);
                stats.maxTreeProbability = currentCCD.getMaxTreeProbability();
            } catch (error) {
                console.error('Error computing max tree probability:', error);
                stats.maxLogTreeProbability = NaN;
                stats.maxTreeProbability = NaN;
            }
            
            // Find most probable clades
            showLoading('Finding most probable clades...');
            await new Promise(resolve => setTimeout(resolve, 0));
            const clades = Array.from(currentCCD.getClades());
            const nonTrivialClades = clades.filter(c => !c.isLeaf() && !c.isRoot());
            nonTrivialClades.sort((a, b) => b.getProbability() - a.getProbability());
            
            stats.topClades = nonTrivialClades.slice(0, 10).map(clade => ({
                size: clade.size(),
                probability: clade.getProbability(),
                occurrences: clade.getNumberOfOccurrences()
            }));
        } catch (error) {
            console.error('Error computing CCD statistics:', error);
            // Return partial statistics
            stats.entropy = NaN;
            stats.entropyLewis = NaN;
            stats.maxTreeProbability = NaN;
            stats.maxLogTreeProbability = NaN;
            stats.topClades = [];
        }
        
        // Display results
        displayCCDStatistics(stats);
        
        hideLoading();
        
        // Show info about processing
        const infoDiv = document.querySelector('.info');
        const processingNote = document.createElement('div');
        processingNote.className = 'ccd-processing-note';
        
        let noteText = '<strong>CCD Construction Summary:</strong><ul>';
        noteText += `<li>Total trees in file: ${trees.length}</li>`;
        
        const burninCount = Math.floor(trees.length * burnin);
        if (burninCount > 0) {
            noteText += `<li>Burnin: ${burninCount} trees (${burninPercent}%)</li>`;
        }
        
        noteText += `<li>Trees used: ${trees.length - burninCount}</li>`;
        noteText += `<li>Number of clades: ${stats.numberOfClades}</li>`;
        noteText += `<li>Phylogenetic entropy: ${stats.entropy.toFixed(4)}</li>`;
        noteText += '</ul>';
        
        processingNote.innerHTML = noteText;
        
        // Remove any existing CCD notes
        const existingNotes = document.querySelectorAll('.ccd-processing-note');
        existingNotes.forEach(note => note.remove());
        
        infoDiv.insertBefore(processingNote, infoDiv.firstChild);
        
    } catch (error) {
        showError(error.message);
        console.error(error);
        hideLoading();
    }
}

// Add the displayCCDStatistics function if it's not in plot.js
function displayCCDStatistics(stats) {
    const statsDiv = document.getElementById('ccdStats');
    if (!statsDiv) {
        console.error('CCD stats div not found');
        return;
    }
    
    let html = '<h3>CCD Statistics</h3>';
    html += '<div class="stats-grid">';
    
    // Basic statistics
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Number of Trees:</div>';
    html += `<div class="stat-value">${stats.numberOfTrees}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Number of Clades:</div>';
    html += `<div class="stat-value">${stats.numberOfClades}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Number of Leaves:</div>';
    html += `<div class="stat-value">${stats.numberOfLeaves}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Phylogenetic Entropy:</div>';
    html += `<div class="stat-value">${stats.entropy.toFixed(6)}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Entropy (Lewis):</div>';
    if (isNaN(stats.entropyLewis)) {
        html += `<div class="stat-value" title="Skipped due to CCD size or timeout">N/A</div>`;
    } else {
        html += `<div class="stat-value">${stats.entropyLewis.toFixed(6)}</div>`;
    }
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Max Tree Probability:</div>';
    html += `<div class="stat-value">${stats.maxTreeProbability.toExponential(4)}</div>`;
    html += '</div>';
    
    html += '<div class="stat-item">';
    html += '<div class="stat-label">Max Log Tree Probability:</div>';
    html += `<div class="stat-value">${stats.maxLogTreeProbability.toFixed(6)}</div>`;
    html += '</div>';
    
    html += '</div>'; // end stats-grid
    
    // Top clades
    if (stats.topClades && stats.topClades.length > 0) {
        html += '<h4>Most Probable Non-trivial Clades</h4>';
        html += '<table class="clades-table">';
        html += '<tr><th>Clade Size</th><th>Probability</th><th>Occurrences</th></tr>';
        
        for (const clade of stats.topClades) {
            html += '<tr>';
            html += `<td>${clade.size}</td>`;
            html += `<td>${clade.probability.toFixed(4)}</td>`;
            html += `<td>${clade.occurrences}</td>`;
            html += '</tr>';
        }
        
        html += '</table>';
    }
    
    statsDiv.innerHTML = html;
    statsDiv.classList.remove('hidden');
}

async function checkMixing() {
    hideError();
    showLoading('Reading trees...');
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    try {
        const format = document.getElementById('fileFormat').value;
        const burninPercent = parseInt(document.getElementById('burnin').value) || 0;
        
        // Create a progress callback for reading trees
        const readProgressCallback = async (message) => {
            showLoading(message);
            await new Promise(resolve => setTimeout(resolve, 0));
        };
        
        // Read all trees with progress
        trees = await readTreesAsync(fileContent, format, readProgressCallback);
        
        if (trees.length < 4) {
            throw new Error('At least 4 trees are required for mixing analysis');
        }
        
        // Apply burnin
        const burnin = burninPercent / 100;
        const burninCount = Math.floor(trees.length * burnin);
        const treesAfterBurnin = trees.slice(burninCount);
        
        if (treesAfterBurnin.length < 4) {
            throw new Error(`After ${burninPercent}% burnin, only ${treesAfterBurnin.length} trees remain. At least 4 trees are required for mixing analysis.`);
        }
        
        showLoading(`Analyzing mixing for ${treesAfterBurnin.length} trees (after ${burninPercent}% burnin)...`);
        
        // Calculate within-chain dissonance
        const progressCallback = async (message) => {
            showLoading(message);
            await new Promise(resolve => setTimeout(resolve, 0));
        };
        
        // Check mixing by comparing first and second halves
        const results = await calculateWithinChainDissonance(treesAfterBurnin, 2, progressCallback);
        
        // Display results
        displayMixingResults(results, burninCount, trees.length);
        
        hideLoading();
        
    } catch (error) {
        showError(error.message);
        console.error(error);
        hideLoading();
    }
}

function displayMixingResults(results, burninCount, totalTrees) {
    const statsDiv = document.getElementById('ccdStats');
    if (!statsDiv) {
        console.error('CCD stats div not found');
        return;
    }
    
    let html = '<h3>Mixing Analysis Results</h3>';
    
    // Add processing summary
    html += '<div class="mixing-summary">';
    html += '<p><strong>Processing Summary:</strong></p>';
    html += '<ul>';
    html += `<li>Total trees in file: ${totalTrees}</li>`;
    if (burninCount > 0) {
        html += `<li>Burnin removed: ${burninCount} trees</li>`;
    }
    html += `<li>Trees analyzed: ${results.numTrees * results.numChains}</li>`;
    html += `<li>Split into ${results.numSplits} equal parts of ${results.splitSize} trees each</li>`;
    html += '</ul>';
    html += '</div>';
    
    // Add dissonance results
    html += formatDissonanceResults(results);
    
    // Add a plot showing dissonance over time
    html += '<div id="dissonancePlot" style="margin-top: 20px;"></div>';
    
    statsDiv.innerHTML = html;
    statsDiv.classList.remove('hidden');
    
    // Plot dissonance over time
    plotDissonanceOverTime(results);
}

function plotDissonanceOverTime(results) {
    const trace = {
        x: Array.from({length: results.dissonanceValues.length}, (_, i) => i + 1),
        y: results.dissonanceValues,
        mode: 'lines',
        type: 'scatter',
        name: 'Dissonance',
        line: {
            color: 'rgb(75, 192, 192)',
            width: 2
        }
    };
    
    const layout = {
        title: 'Dissonance Over Time',
        xaxis: { 
            title: 'Tree Number',
            tickformat: 'd'
        },
        yaxis: { 
            title: 'Dissonance',
            tickformat: '.6f'
        },
        hovermode: 'closest',
        showlegend: false,
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        height: 400,
        margin: {
            l: 60,
            r: 30,
            t: 60,
            b: 60
        }
    };
    
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };
    
    Plotly.newPlot('dissonancePlot', [trace], layout, config);
}