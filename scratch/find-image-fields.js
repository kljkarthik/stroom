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

const files = searchDir('./src', f => f.endsWith('.tsx') || f.endsWith('.ts'));
const imageInputs = [];

const patterns = [
  /type=["']url["']/i,
  /placeholder=["'].*?(?:https?:\/\/|image|avatar|banner|logo|photo|poster|cover).*?["']/i,
  /(?:image_url|avatar_url|cover_image|cover_url|banner_url|poster_url|logo_url|thumbnail_url|photo_url)/i
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    for (const pat of patterns) {
      if (pat.test(line)) {
        imageInputs.push({ file: file.replace(/\\/g, '/'), line: idx + 1, text: line.trim() });
        break;
      }
    }
  });
}

console.log('Total matches: ' + imageInputs.length);
const byFile = {};
imageInputs.forEach(item => {
  if (!byFile[item.file]) byFile[item.file] = [];
  byFile[item.file].push({ line: item.line, text: item.text });
});

for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n=== ${file} (${items.length} occurrences) ===`);
  items.slice(0, 10).forEach(i => console.log(`  L${i.line}: ${i.text}`));
  if (items.length > 10) console.log(`  ... and ${items.length - 10} more`);
}
