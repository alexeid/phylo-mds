import './styles.css';
import { readTrees } from './tree-reader';
import { calculateDistanceMatrix, calculateDistanceMatrixWithProgress } from './distance-metrics';
import { classicalMDS } from './mds';
import { plotMDS, displayDistanceMatrix } from './plot';

let trees = [];
let fileContent = '';

// DOM elements
const treeFileInput = document.getElementById('treeFile');
const calculateBtn = document.getElementById('calculateBtn');
const errorMsg = document.getElementById('errorMsg');
const loadingMsg = document.getElementById('loadingMsg');
const matrixToggle = document.getElementById('matrixToggle');
const distanceMatrixDiv = document.getElementById('distanceMatrix');

// Event listeners
treeFileInput.addEventListener('change', handleFileUpload);
calculateBtn.addEventListener('click', calculateMDS);
matrixToggle.addEventListener('click', toggleMatrix);

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            fileContent = e.target.result;
            calculateBtn.disabled = false;
            hideError();
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

