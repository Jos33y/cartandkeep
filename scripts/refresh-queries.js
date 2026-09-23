import fs from 'node:fs';
import { connect } from '../pipeline/lib/db.js';

const args = process.argv.slice(2);
const arg = (k, d = null) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const slug = arg('tenant', 'cart-and-keep');

const { db } = await connect();

const { data: tenant } = await db.from('tenants').select('id').eq('slug', slug).maybeSingle();
if (!tenant) {
  console.error(`Tenant "${slug}" not found.`);
  process.exit(1);
}

const { data: batches, error } = await db
  .from('batches')
  .select('id, delivered_for, category_label')
  .eq('tenant_id', tenant.id)
  .eq('status', 'delivered')
  .is('retired_at', null)
  .order('delivered_for');

if (error) {
  console.error('Batches not read:', error.message);
  process.exit(1);
}

for (const b of batches) {
  const { data: rows, error: cErr } = await db
    .from('candidates')
    .select('external_ref')
    .eq('batch_id', b.id)
    .order('external_ref');
  if (cErr) {
    console.error(`${b.category_label}: ${cErr.message}`);
    continue;
  }

  const file = `scripts/queries-refresh-${b.delivered_for}.txt`;
  const lines = [`# ${b.category_label}, ${rows.length} queries`, ...rows.map((r) => r.external_ref)];
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  console.log(`${file}  ${rows.length} queries, about ${rows.length * 21} API calls`);
}
