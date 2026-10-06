-- 1. Reject the blade cards. Delete any line you want to keep before running.
--    Gillette Labs (cartridge refills) and the Minky sweeper are left out on purpose.
update decisions d
set action = 'reject', reason = 'other', note = 'A blade or cutting tool: eBay UK needs age-checked delivery.', decided_at = now()
where d.action = 'approve'
  and d.candidate_id in (
    '134d9965-b8c9-439d-b791-310db2cce952', -- Bosch S644D (eBay refused)
    'bb7fb159-583b-4b2b-a925-dbb34ea534d1', -- Trend CSB/CC21660 (eBay refused)
    'a32369ca-4d40-4f62-bd65-9c0fb9559190', -- Bosch S1122BF
    'cee12276-a1e5-438f-865d-a1af3bf8ecad', -- Freud circular saw blade
    '063b28a9-00f5-4ba4-8db6-f814f0974597', -- Milwaukee bandsaw blade
    '52eee3b3-3203-4b4f-bbf7-36d428ef4be0', -- Evolution diamond blade
    '620bdb37-3043-44e3-9d0c-1583ffcb0786', -- Smart Trade diamond blade
    '87703625-34c9-4d96-a094-92ad98e04ea6', -- Purdy 10-in-1
    '8011c849-e6ed-42a4-b30f-504d307803cb'  -- Victorinox paring knives
  )
returning d.candidate_id, d.action;

-- 2. Clear eBay's refusals off Alerts for the cards just rejected. The error stays on the job.
update listing_jobs l
set state = 'cancelled'
from decisions d
where d.candidate_id = l.candidate_id
  and d.action = 'reject'
  and l.state = 'failed'
returning l.candidate_id, l.state;

-- 3. eBay queue pace: 100 a day (was 20 by default, 50 as set). The monthly cap stays 300.
update tenant_credentials
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('daily_pace', 100)
where provider = 'ebay'
  and tenant_id = (select tenant_id from candidates where id = '134d9965-b8c9-439d-b791-310db2cce952')
returning tenant_id, settings ->> 'daily_pace' as daily_pace, settings ->> 'monthly_limit' as monthly_limit;
