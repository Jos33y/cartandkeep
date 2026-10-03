-- The candidates left as "Another pack on Amazon" by the old pack rule (3 October): a kit's contents ("3 x 450ml") or
-- Amazon's "Number of Items" alone. Their jobs are marked stopped, so the next look takes them again under the new rule.
-- By hand, after keeper-run is deployed. A real multipack named in Amazon's title is left as it is.

-- Step 1: read only. Expect Dryzone, Brita Marella, FireAngel Smoke Alarm and Seven Seas.
select c.title, j.result ->> 'why' as why
from keeper_jobs j join candidates c on c.id = j.candidate_id
where j.kind = 'amazon_source' and j.state = 'done' and j.result ->> 'line' = 'Another pack on Amazon.'
  and (j.result ->> 'why' ilike '%Number of Items%' or c.title ilike '%kit%' or j.result ->> 'why' ilike '%pieces%'
       or j.result ->> 'why' ilike '%pcs%' or j.result ->> 'why' ilike '% in the title%');

-- Step 2: send them back for another look.
update keeper_jobs j set state = 'stopped'
from candidates c
where c.id = j.candidate_id and j.kind = 'amazon_source' and j.state = 'done' and j.result ->> 'line' = 'Another pack on Amazon.'
  and (j.result ->> 'why' ilike '%Number of Items%' or c.title ilike '%kit%' or j.result ->> 'why' ilike '%pieces%'
       or j.result ->> 'why' ilike '%pcs%' or j.result ->> 'why' ilike '% in the title%')
returning c.title;
