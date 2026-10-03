-- SHAVINGFUN's supplier: "Amazon Business", dropship -> "Amazon", sent by her (stock).
-- One-off, by hand in the SQL editor, after 0133. Run step 1 first and check it shows exactly one row.

-- Step 1: read only. The row to change.
select s.id, c.title, s.supplier, s.fulfilment, s.unit_cost, s.supplier_shipping, s.landed_unit_cost, s.cost_by, s.url
from candidate_sources s
join candidates c on c.id = s.candidate_id
where s.supplier = 'Amazon Business' and s.url ilike '%B0BDLDML22%';

-- Step 2: the change. Postage to the buyer is hers on this route, so the supplier's postage is cleared, and the
-- landed cost becomes the Amazon price alone. Her own cost (cost_by 'her') is kept as it is.
update candidate_sources
set supplier = 'Amazon',
    fulfilment = 'stock',
    supplier_shipping = null,
    inbound_freight_per_unit = null,
    duty_pct = null,
    cost_by = case when cost_by = 'her' then 'her' else 'amazon' end
where supplier = 'Amazon Business' and url ilike '%B0BDLDML22%'
returning id, supplier, fulfilment, unit_cost, landed_unit_cost, cost_by;
