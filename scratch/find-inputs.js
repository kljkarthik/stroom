const fs = require('fs');
const path = require('path');

function searchDir(dir, filter) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist' && f !== '.git') {
        results = results.concat(searchDir(full, filter));
      }
    } else if (filter(full)) {
      results.push(full);
    }
  }
  return results;
}

const files = searchDir('./src/components', f => f.endsWith('.tsx'));
const inputs = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  // Find <input or <textarea or form fields
  const matches = content.match(/<input[^>]*>/g) || [];
  matches.forEach(m => {
    if (/image|photo|avatar|cover|banner|logo|url/i.test(m)) {
      inputs.push({ file: file.replace(/\\/g, '/'), input: m });
    }
  });
}

console.log('Found ' + inputs.length + ' inputs related to image/url in src/components:');
inputs.forEach(i => console.log(i.file + ':\n  ' + i.input + '\n'));
