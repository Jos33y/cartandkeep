const fs = require('fs');
let total = 0;
for (const f of fs.readdirSync('research/shelf').filter((n) => /^shelf-.*\.csv$/.test(n)).sort()) {
  const seen = new Set();
  for (const line of fs.readFileSync(`research/shelf/${f}`, 'utf8').split('\n').slice(1)) {
    if (!line) continue;
    const link = line.match(/https?:\/\/[^,"]+/);
    seen.add(link ? link[0] : line);
  }
  total += seen.size;
  console.log(f.replace('.csv', '').padEnd(40), seen.size.toLocaleString().padStart(9));
}
console.log('TOTAL'.padEnd(40), total.toLocaleString().padStart(9));
