const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'src', 'datasets');

function loadDatasets() {
  return fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort().map(f => require(path.join(DIR, f)));
}

module.exports = { loadDatasets };
