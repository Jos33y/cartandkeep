-- Reads only. Inside the heavy fields: kilobytes by key, across the approved cards (draft, supplier_read, photo_checks)
-- and across all cards (margin, competition). One result; paste it.
with t as (select id from tenants where slug = 'cart-and-keep'),
appr as (select c.* from candidates c join decisions d on d.candidate_id = c.id and d.action = 'approve', t where c.tenant_id = t.id),
cand as (select c.* from candidates c join batches b on b.id = c.batch_id and b.status = 'delivered', t where c.tenant_id = t.id),
k as (
  select 'draft' as field, e.key, sum(octet_length(e.value::text)) as bytes from appr, jsonb_each(case when jsonb_typeof(appr.draft) = 'object' then appr.draft end) e group by 1, 2
  union all select 'supplier_read', e.key, sum(octet_length(e.value::text)) from appr, jsonb_each(case when jsonb_typeof(appr.supplier_read) = 'object' then appr.supplier_read end) e group by 1, 2
  union all select 'photo_checks', e.key, sum(octet_length(e.value::text)) from appr, jsonb_each(case when jsonb_typeof(appr.photo_checks) = 'object' then appr.photo_checks end) e group by 1, 2
  union all select 'margin', e.key, sum(octet_length(e.value::text)) from cand, jsonb_each(case when jsonb_typeof(cand.margin) = 'object' then cand.margin end) e group by 1, 2
  union all select 'competition', e.key, sum(octet_length(e.value::text)) from cand, jsonb_each(case when jsonb_typeof(cand.competition) = 'object' then cand.competition end) e group by 1, 2)
select field, jsonb_agg(jsonb_build_object('key', key, 'kb', round(bytes / 1024.0)) order by bytes desc) filter (where bytes > 10240) as keys,
  (select jsonb_agg(distinct jsonb_typeof(x)) from (select photo_checks x from appr) y) as photo_checks_types
from k group by field;
