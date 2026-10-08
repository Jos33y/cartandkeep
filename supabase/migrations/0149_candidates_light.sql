-- 0149_candidates_light.sql
-- What the Candidates list reads of a card's market, without the long lists only an opened card shows (7 October:
-- the list sent 15 MB; the competitor listings were 1.9 MB of it, and the import's reasons 0.5 MB, which the portal
-- never shows). The list works out the same figures from it: the median, the range and how many listings were
-- sampled. The full competition is read when a card is opened (useCandidates hydrate).
--
-- `sample` is set to the number of priced listings when there are any, which is the count the list showed before
-- (assess.js marketReadOf: priced listings, else the import's sample).
create or replace function candidate_competition_list(c candidates)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case
    when jsonb_typeof(c.competition) <> 'object' then c.competition
    else (c.competition - 'listings' - 'reasons')
      || case when n > 0 then jsonb_build_object('sample', n) else '{}'::jsonb end
  end
  from (
    select count(*) as n
    from jsonb_array_elements(case when jsonb_typeof(c.competition -> 'listings') = 'array' then c.competition -> 'listings' else '[]'::jsonb end) l
    where case jsonb_typeof(l -> 'price')
      when 'number' then (l ->> 'price')::numeric > 0
      when 'string' then (l ->> 'price') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' and trim(l ->> 'price')::numeric > 0
      else false end
  ) x;
$$;

grant execute on function candidate_competition_list(candidates) to authenticated;
