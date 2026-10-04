-- 0139_keeper_matches_the_listing.sql
-- Keeper task 03 (Joseey, 4 October): when Keeper gets an eBay card ready it first asks Keepr to match, as she does
-- with "Ask Keepr to match": the eBay listing that sells the product she actually buys. Many cards price from a
-- listing that is not quite her product; Keepr finds the one that is and the card moves to it.
--
-- The move, as the portal makes it (ApprovedPage moveTo): the listing goes on her draft as `entry`, with eBay's facts
-- for it; when it is another product, what was written for the old one is kept in `before` (so she can switch back)
-- and cleared, so Keeper writes the card again for the new one. Only on a card whose listing nobody has chosen yet,
-- and never to a listing she turned down.

create or replace function keeper_ready_move(p_candidate uuid, p_entry jsonb, p_facts jsonb, p_other boolean, p_market jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c candidates;
  d jsonb;
  item text := p_entry ->> 'item_id';
  fields text[] := array['title', 'description', 'images', 'catalogue', 'ebay_category', 'aspects', 'package', 'price', 'ebay_price', 'as_shelf', 'market'];
  f text;
  before jsonb := '{}'::jsonb;
begin
  select * into c from candidates where id = p_candidate for update;
  if not found then return jsonb_build_object('status', 'gone'); end if;
  if not exists (select 1 from decisions where candidate_id = c.id and action = 'approve') then return jsonb_build_object('status', 'decided'); end if;
  if c.ebay ->> 'listing_id' is not null then return jsonb_build_object('status', 'live'); end if;
  if item is null then return jsonb_build_object('status', 'no_listing'); end if;

  d := coalesce(c.draft, '{}'::jsonb);
  -- Chosen already (by her, or by Keepr when she asked): left as it is.
  if d -> 'entry' is not null and d -> 'entry' <> 'null'::jsonb then return jsonb_build_object('status', 'chosen', 'draft', d); end if;
  -- A listing she turned down is never moved to.
  if exists (select 1 from jsonb_array_elements_text(coalesce(d -> 'entry_dismissed', '[]'::jsonb)) x where x = item
      or regexp_replace(x, '^v1\|(\d+)\|.*$', '\1') = regexp_replace(item, '^v1\|(\d+)\|.*$', '\1')) then
    return jsonb_build_object('status', 'dismissed', 'draft', d);
  end if;

  d := d || jsonb_build_object(
    -- `by` stays Keepr's ('keepr'), as when she asks on the card: the checklist reads it ("Keepr matched it, 97%
    -- sure"). `via` says Keeper asked, while getting the card ready.
    'entry', p_entry || jsonb_build_object('new_product', coalesce(p_other, false), 'market', p_market, 'chosen_at', now(), 'via', 'keeper'),
    'item_facts', p_facts,
    'entry_suggestion', null
  );
  if coalesce(p_other, false) then
    foreach f in array fields loop before := before || jsonb_build_object(f, c.draft -> f); end loop;
    d := d || jsonb_build_object(
      'before', coalesce(c.draft -> 'before', before),
      'title', '', 'description', '', 'images', '[]'::jsonb, 'catalogue', null, 'ebay_category', null, 'aspects', '{}'::jsonb,
      'package', null, 'price', null, 'ebay_price', null, 'as_shelf', false, 'market', null,
      'keeper_ready', null, 'parcel_from', null
    );
  end if;
  update candidates set draft = d where id = c.id;
  return jsonb_build_object('status', 'moved', 'other', coalesce(p_other, false), 'draft', d);
end;
$$;

revoke all on function keeper_ready_move(uuid, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function keeper_ready_move(uuid, jsonb, jsonb, boolean, jsonb) to service_role;
