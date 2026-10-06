-- 0142_keeper_amazon_ebay_no_lego.sql
-- "Let Keeper look them up" on Candidates (Joseey, 4 October): 34 cards are live on eBay from Cart & Keep and more eBay
-- cards are wanted, so the lookup takes the cards for eBay only, and never LEGO: 11 LEGO sets are live already, and
-- that is enough of it. LEGO-compatible sets are left out too. Cards she ticks herself are still looked up as she
-- picked them; this is only what the button chooses.

-- LEGO, DUPLO, or a set sold as compatible with them: by the words on the card, the shop page and the eBay listing.
create or replace function candidate_is_lego(c candidates)
returns boolean
language sql
immutable
as $$
  select concat_ws(' ', c.title, c.external_ref, c.listing ->> 'title', c.listing ->> 'brand', c.entry ->> 'title', c.margin #>> '{shelf,title}')
    ~* '\m(lego|duplo)\M';
$$;

-- A card for eBay, as the portal reads it (src/lib/assess.js channelsOf): anything but a store card, or a store card
-- the import also recommended for eBay. The card's eBay mark on Candidates.
create or replace function candidate_for_ebay(c candidates)
returns boolean
language sql
immutable
as $$
  select coalesce(c.margin ->> 'channel', '') <> 'store' or 'ebay' = any (coalesce(c.recommended_channels, '{}'));
$$;

-- What the button looks up, and what its count on Candidates says: undecided eBay cards with a barcode, not yet looked
-- up, no LEGO.
create or replace function amazon_source_pool(p_tenant uuid)
returns table (id uuid, gtin text, monthly_headroom numeric, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, candidate_gtin(c.margin, c.listing), c.monthly_headroom, c.created_at
  from candidates c
  join batches b on b.id = c.batch_id and b.status = 'delivered' and b.retired_at is null
  where c.tenant_id = p_tenant
    and not exists (select 1 from decisions d where d.candidate_id = c.id)
    and candidate_gtin(c.margin, c.listing) is not null
    and candidate_for_ebay(c)
    and not candidate_is_lego(c)
    and not exists (
      select 1 from keeper_jobs j
      where j.candidate_id = c.id and j.kind = 'amazon_source' and j.state in ('queued', 'working', 'done')
    );
$$;
revoke all on function amazon_source_pool(uuid) from public, anon, authenticated;

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
    -- The button's own choice: eBay cards, no LEGO. Her picks are looked up as picked.
    and (picked or (candidate_for_ebay(c) and not candidate_is_lego(c)))
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
    raise exception 'Every eBay card with a barcode has been looked up already (LEGO is left out).' using errcode = 'P0002';
  end if;

  update keeper_runs set total = n where id = r.id returning * into r;
  return r;
end;
$$;
revoke all on function start_amazon_run(uuid, numeric, integer, text, uuid[], boolean) from public, anon;
grant execute on function start_amazon_run(uuid, numeric, integer, text, uuid[], boolean) to authenticated;
