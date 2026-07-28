import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parsePastedTable, dedupe } from './sources/zikExport.js';
import { velocityTrend } from './lib/metrics.js';

// A browser paste is one field per line, which parses fine but cannot be read.
// This writes the same data as a CSV that opens in Excel and sorts.
//
//   node pipeline/tidy-zik.js drops/raw/zik_2026-07-26.txt

const COLUMNS = [
  'title', 'uploaded', 'price',
  'sold_7d', 'sold_14d', 'sold_30d',
  'revenue_30d', 'trend', 'direction',
];

function direction(t) {
  if (t == null) return 'unknown';
  if (t >= 1.5) return 'climbing';
  if (t >= 0.8) return 'steady';
  if (t > 0) return 'falling';
  return 'stopped';
}

const csv = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: node pipeline/tidy-zik.js <pasted-file.txt> [outDir]');
    process.exit(1);
  }
  const outDir = process.argv[3] ?? 'drops';

  const rows = dedupe(parsePastedTable(await readFile(input, 'utf8')));
  if (!rows.length) {
    console.error('Nothing parsed. Expected nine fields per listing, one per line.');
    process.exit(1);
  }

  const tidy = rows
    .map((r) => {
      const trend = velocityTrend({ sold7: r.sold7, sold30: r.sold30 });
      return {
        title: r.title,
        uploaded: r.uploaded,
        price: r.price?.toFixed(2),
        sold_7d: r.sold7,
        sold_14d: r.sold14,
        sold_30d: r.sold30,
        revenue_30d: r.rev30?.toFixed(2),
        trend: trend?.toFixed(2),
        direction: direction(trend),
      };
    })
    .sort((a, b) => Number(b.sold_30d) - Number(a.sold_30d));

  const base = path.basename(input).replace(/_raw|\.(txt|tsv|csv)$/gi, '');
  const out = path.join(outDir, `${base}.csv`);
  await mkdir(outDir, { recursive: true });
  await writeFile(
    out,
    [COLUMNS.join(','), ...tidy.map((r) => COLUMNS.map((c) => csv(r[c])).join(','))].join('\n') + '\n',
  );

  const by = (d) => tidy.filter((r) => r.direction === d).length;
  console.log(`\n${out}`);
  console.log(`  ${tidy.length} unique listings from ${rows.length} parsed`);
  console.log(`  climbing ${by('climbing')}, steady ${by('steady')}, falling ${by('falling')}, stopped ${by('stopped')}\n`);
}

main();
