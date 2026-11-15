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
  // Match across newlines
  const regex = /<input[\s\S]*?>/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const tag = match[0];
    if (/image|photo|avatar|cover|banner|logo/i.test(tag)) {
      const lineNo = content.substring(0, match.index).split('\n').length;
      inputs.push({ file: file.replace(/\\/g, '/'), line: lineNo, tag: tag.replace(/\s+/g, ' ').substring(0, 150) });
    }
  }
}

console.log('Found ' + inputs.length + ' inputs matching across newlines:');
inputs.forEach(i => console.log(`${i.file}:${i.line} -> ${i.tag}`));
