import numeric from 'numeric';

export function classicalMDS(distances) {
    const n = distances.length;
    
    // Convert distances to squared distances
    const D = distances.map(row => row.map(d => d * d));
    
    // Double centering
    const rowMeans = D.map(row => row.reduce((a, b) => a + b) / n);
    const totalMean = rowMeans.reduce((a, b) => a + b) / n;
    
    const B = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            B[i][j] = -0.5 * (D[i][j] - rowMeans[i] - rowMeans[j] + totalMean);
        }
    }
    
    // Eigendecomposition
    const eig = numeric.eig(B);
    
    // Get the two largest eigenvalues and corresponding eigenvectors
    const eigenPairs = eig.lambda.x.map((val, idx) => ({
        value: val,
        vector: eig.E.x.map(row => row[idx])
    }));
    
    eigenPairs.sort((a, b) => b.value - a.value);
    
    // Extract 2D coordinates
    const coords = Array(n).fill(null).map(() => [0, 0]);
    
    if (eigenPairs[0].value > 0) {
        const scale1 = Math.sqrt(eigenPairs[0].value);
        for (let i = 0; i < n; i++) {
            coords[i][0] = eigenPairs[0].vector[i] * scale1;
        }
    }
    
    if (eigenPairs.length > 1 && eigenPairs[1].value > 0) {
        const scale2 = Math.sqrt(eigenPairs[1].value);
        for (let i = 0; i < n; i++) {
            coords[i][1] = eigenPairs[1].vector[i] * scale2;
        }
    }
    
    return coords;
}
