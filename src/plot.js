import Plotly from 'plotly.js-dist';

export function plotMDS(coords, labels) {
    const trace = {
        x: coords.map(c => c[0]),
        y: coords.map(c => c[1]),
        mode: 'markers+text',
        type: 'scatter',
        text: labels,
        textposition: 'top center',
        marker: {
            size: 12,
            color: coords.map((_, i) => i),
            colorscale: 'Viridis',
            showscale: false
        },
        hovertemplate: '<b>%{text}</b><br>MDS1: %{x:.3f}<br>MDS2: %{y:.3f}<extra></extra>'
    };
    
    const layout = {
        title: 'MDS Plot of Phylogenetic Trees',
        xaxis: { 
            title: 'MDS Dimension 1',
            tickformat: '.2f'  // Force numeric format
        },
        yaxis: { 
            title: 'MDS Dimension 2',
            tickformat: '.2f'  // Force numeric format
        },
        hovermode: 'closest',
        showlegend: false,
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        autosize: true,
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
    
    Plotly.newPlot('plot', [trace], layout, config);
}

export function displayDistanceMatrix(distances, treeLabels) {
    const matrixDiv = document.getElementById('distanceMatrix');
    
    let html = '<table>';
    html += '<tr><th></th>';
    for (let i = 0; i < treeLabels.length; i++) {
        html += `<th>${treeLabels[i]}</th>`;
    }
    html += '</tr>';
    
    for (let i = 0; i < distances.length; i++) {
        html += `<tr><th>${treeLabels[i]}</th>`;
        for (let j = 0; j < distances[i].length; j++) {
            const value = distances[i][j];
            // Ensure we're displaying numbers properly
            const displayValue = typeof value === 'number' ? value.toFixed(2) : value;
            html += `<td>${displayValue}</td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    
    matrixDiv.innerHTML = html;
    document.getElementById('matrixToggle').classList.remove('hidden');
}