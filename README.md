# Phylogenetic Tree MDS Viewer

A web application for visualizing relationships between phylogenetic trees using Multidimensional Scaling (MDS) based on various distance metrics.

## Features

- Read multiple tree formats (Newick, Nexus, PhyloXML, NeXML, PhyJSON)
- Calculate distances using Robinson-Foulds, SPR, or Path metrics
- Visualize tree relationships in 2D using MDS
- Interactive Plotly.js plots
- View full distance matrix

## Installation

```bash
# Clone the repository
git clone https://github.com/alexeid/phylo-mds.git
cd phylo-mds

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Usage

1. Upload a file containing multiple phylogenetic trees
2. Select the distance metric (RF, SPR, or Path)
3. Click "Calculate MDS" to generate the visualization
4. Explore the interactive plot

## Project Structure

```
phylo-mds/
├── package.json
├── webpack.config.js
├── .gitignore
├── README.md
├── dist/
│   └── (built files will go here)
├── src/
│   ├── index.js
│   ├── index.html
│   ├── styles.css
│   ├── tree-reader.js
│   ├── distance-metrics.js
│   ├── mds.js
│   └── plot.js
└── .github/
    └── workflows/
        └── deploy.yml
```

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm start`
4. Open http://localhost:8080 in your browser

### Building for Production

```bash
npm run build
```

This will create optimized files in the `dist/` directory.

### Deployment

The project is set up with GitHub Actions for automatic deployment to GitHub Pages. Simply push to the main branch and the action will:

1. Build the project
2. Deploy to the `gh-pages` branch
3. Your site will be available at `https://alexeid.github.io/phylo-mds`

## Distance Metrics

### Robinson-Foulds (RF) Distance
Calculates the symmetric difference between the splits (bipartitions) of two trees. This is the most commonly used metric for comparing tree topologies.

### Subtree Prune and Regraft (SPR) Distance
Measures the minimum number of SPR operations needed to transform one tree into another. Currently implemented as an approximation (RF/2).

### Path Distance
Compares the sum of branch lengths along paths between corresponding pairs of leaves in both trees. Useful when branch lengths are meaningful (e.g., evolutionary time or genetic distance).

## Technologies

- [PhyloJS](https://github.com/clockor2/phylojs) - Tree parsing and manipulation
- [Plotly.js](https://plotly.com/javascript/) - Interactive visualizations
- [Numeric.js](http://www.numericjs.com/) - Numerical computations for MDS
- [Webpack](https://webpack.js.org/) - Module bundling
- [Babel](https://babeljs.io/) - JavaScript transpilation

## API Reference

### Main Functions

#### `readTrees(content, format)`
Reads phylogenetic trees from a string in various formats.
- `content`: String containing tree data
- `format`: One of 'newick', 'nexus', 'phyloxml', 'nexml', 'phyjson', or 'auto'

#### `calculateDistanceMatrix(trees, metric)`
Calculates pairwise distances between all trees.
- `trees`: Array of tree objects
- `metric`: One of 'rf', 'spr', or 'path'

#### `classicalMDS(distances)`
Performs classical multidimensional scaling on a distance matrix.
- `distances`: n×n distance matrix
- Returns: Array of 2D coordinates

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Future Enhancements

- [ ] Implement exact SPR distance calculation
- [ ] Add support for weighted RF distance
- [ ] Include 3D MDS visualization option
- [ ] Add tree visualization for individual trees
- [ ] Support for larger datasets with performance optimizations
- [ ] Export results in various formats (CSV, JSON, SVG)
- [ ] Add clustering analysis on top of MDS

## License

MIT License

Copyright (c) 2025 Alexei Drummond

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Acknowledgments

- PhyloJS developers for the excellent tree manipulation library
- Plotly team for the interactive visualization library
- All contributors to the open-source libraries used in this project
