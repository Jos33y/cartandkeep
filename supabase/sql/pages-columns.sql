-- Reads only. Which columns make Candidates (15.2 MB) and Approved (8.9 MB) heavy: kilobytes each column sends,
-- across the cards each page loads, biggest first. One result; paste it.
with t as (select id from tenants where slug = 'cart-and-keep'),
cand as (select c.* from candidates c join batches b on b.id = c.batch_id and b.status = 'delivered', t where c.tenant_id = t.id),
appr as (select c.* from candidates c join decisions d on d.candidate_id = c.id and d.action = 'approve', t where c.tenant_id = t.id),
sizes as (
  select 'Candidates' as page, key as col, sum(octet_length(value::text)) as bytes
  from cand, jsonb_each(to_jsonb(cand) - 'tenant_id') group by 1, 2
  union all
  select 'Approved', key, sum(octet_length(value::text))
  from appr, jsonb_each(to_jsonb(appr) - 'tenant_id') group by 1, 2)
select page, jsonb_agg(jsonb_build_object('col', col, 'kb', round(bytes / 1024.0)) order by bytes desc) filter (where bytes > 20480) as columns
from sizes group by page;
