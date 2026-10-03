-- 0134_keeper_amazon_picked.sql
-- Look up the cards she ticks on Candidates (keeper-task-02-amazon-sourcing.md): a sourcing run over those cards only.
-- The same cards as any run (a delivered batch, not retired, undecided, with a barcode, none in hand already); a card
-- Keeper has looked up before goes again only when she asks (p_again), since it is paid for again.

drop function if exists start_amazon_run(uuid, numeric, integer, text);

create or replace function start_amazon_run(
  p_tenant uuid, p_cap_pence numeric, p_limit integer default null, p_pace text default 'watch',
  p_ids uuid[] default null, p_again boolean default false
)
returns keeper_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  r keeper_runs;
  n integer;
  picked boolean := p_ids is not null and cardinality(p_ids) > 0;
begin
  if not has_tenant(p_tenant) then raise exception 'Not your shop.' using errcode = '42501'; end if;
  if coalesce(p_pace, 'watch') not in ('watch', 'normal') then raise exception 'Unknown pace %.', p_pace; end if;
  if exists (select 1 from keeper_runs where tenant_id = p_tenant and task = 'amazon_source' and state in ('running', 'paused')) then
    raise exception 'A look on Amazon is already going. Open it to carry on or stop it.' using errcode = '23505';
  end if;

  insert into keeper_runs (tenant_id, task, pace, cap_pence, rehearsal)
  values (p_tenant, 'amazon_source', coalesce(p_pace, 'watch'), p_cap_pence, false)
  returning * into r;

  insert into keeper_jobs (tenant_id, candidate_id, kind, run_id)
  select p_tenant, c.id, 'amazon_source', r.id
  from candidates c
  join batches b on b.id = c.batch_id and b.status = 'delivered' and b.retired_at is null
  where c.tenant_id = p_tenant
    and (not picked or c.id = any (p_ids))
    and not exists (select 1 from decisions d where d.candidate_id = c.id)
    and candidate_gtin(c.margin, c.listing) is not null
    and not exists (
      select 1 from keeper_jobs j where j.candidate_id = c.id and j.kind = 'amazon_source' and j.state in ('queued', 'working')
    )
    and ((picked and coalesce(p_again, false)) or not exists (
      select 1 from keeper_jobs j where j.candidate_id = c.id and j.kind = 'amazon_source' and j.state = 'done'
    ))
  order by c.monthly_headroom desc nulls last, c.created_at, c.id
  limit coalesce(p_limit, 100000);

  get diagnostics n = row_count;
  if n = 0 then
    if picked then
      raise exception 'None of these can be looked up now: no barcode, decided already, or looked up before.' using errcode = 'P0002';
    end if;
    raise exception 'Every candidate with a barcode has been looked up already.' using errcode = 'P0002';
  end if;

  update keeper_runs set total = n where id = r.id returning * into r;
  return r;
end;
$$;

revoke all on function start_amazon_run(uuid, numeric, integer, text, uuid[], boolean) from public, anon;
grant execute on function start_amazon_run(uuid, numeric, integer, text, uuid[], boolean) to authenticated;
