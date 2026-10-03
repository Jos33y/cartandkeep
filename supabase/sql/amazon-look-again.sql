-- The candidates Keeper left only because Amazon's page printed no barcode (the rule before 3 October, evening).
-- Their jobs are marked stopped, so the next look on Amazon takes them again. By hand, after keeper-run is deployed.

-- Step 1: read only. Expect the 4 LEGO sets from the first run.
select j.id, c.title, j.result ->> 'line' as line, j.result ->> 'asin' as asin
from keeper_jobs j join candidates c on c.id = j.candidate_id
where j.kind = 'amazon_source' and j.state = 'done' and j.result ->> 'line' = 'Amazon''s page shows no barcode to compare.';

-- Step 2: send them back.
update keeper_jobs set state = 'stopped'
where kind = 'amazon_source' and state = 'done' and result ->> 'line' = 'Amazon''s page shows no barcode to compare.'
returning id;
