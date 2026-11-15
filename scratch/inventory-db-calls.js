const fs = require('fs');
const path = require('path');

function scanDir(dir) {
  let results = [];
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fullPath = path.join(dir, f);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(scanDir(fullPath));
    } else if (f.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const prepares = (content.match(/\.prepare\(/g) || []).length;
      const transactions = (content.match(/\.transaction\(/g) || []).length;
      const dbImports = (content.match(/from\s+['"][^'"]*db\/(?:database|sqliteAdapter)['"]/g) || []).length;
      if (prepares > 0 || transactions > 0 || dbImports > 0) {
        results.push({
          file: fullPath.replace(/\\/g, '/').replace(process.cwd().replace(/\\/g, '/') + '/', ''),
          prepares,
          transactions,
          dbImports
        });
      }
    }
  }
  return results;
}

const list = scanDir(path.resolve(process.cwd(), 'server'));
console.table(list);

const totalPrepares = list.reduce((sum, item) => sum + item.prepares, 0);
const totalTransactions = list.reduce((sum, item) => sum + item.transactions, 0);
console.log('Total modules:', list.length);
console.log('Total prepare calls:', totalPrepares);
console.log('Total transaction calls:', totalTransactions);
