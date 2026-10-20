// Lets `node --test tools/erd-playground/test/` work: Node 22 loads a folder argument as a module,
// so this file loads every *.test.js next to it.
const fs = require('fs');
const path = require('path');

for (const f of fs.readdirSync(__dirname).filter(n => n.endsWith('.test.js')).sort()) require(path.join(__dirname, f));
