-- 0135_keeper_amazon_check.sql
-- Before the ticked cards are looked up on Amazon, why any of them cannot be, counted, so the bar says which reason
-- applies instead of all three at once. Read only.

create or replace function amazon_source_check(p_tenant uuid, p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  out jsonb;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  with picked as (
    select c.id,
      exists (select 1 from decisions d where d.candidate_id = c.id) as decided,
      candidate_gtin(c.margin, c.listing) is not null as has_code,
      exists (select 1 from keeper_jobs j where j.candidate_id = c.id and j.kind = 'amazon_source' and j.state in ('queued', 'working')) as in_hand,
      exists (select 1 from keeper_jobs j where j.candidate_id = c.id and j.kind = 'amazon_source' and j.state = 'done') as looked
    from candidates c
    where c.tenant_id = p_tenant and c.id = any (p_ids)
  )
  select jsonb_build_object(
    'total', count(*),
    'decided', count(*) filter (where decided),
    'no_barcode', count(*) filter (where not decided and not has_code),
    'in_hand', count(*) filter (where not decided and has_code and in_hand),
    'looked', count(*) filter (where not decided and has_code and not in_hand and looked),
    'ready', count(*) filter (where not decided and has_code and not in_hand and not looked)
  ) into out
  from picked;
  return out;
end;
$$;

revoke all on function amazon_source_check(uuid, uuid[]) from public, anon;
grant execute on function amazon_source_check(uuid, uuid[]) to authenticated;
