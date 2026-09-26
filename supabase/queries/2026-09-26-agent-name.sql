-- Run by hand, not a migration. Names the agent for Cart & Keep; another shop sets its own name the same way.
update tenants
set store = jsonb_set(coalesce(store, '{}'::jsonb), '{agent}', jsonb_build_object('name', 'Keeper'), true)
where slug = 'cart-and-keep';

select slug, store -> 'agent' as agent from tenants where slug = 'cart-and-keep';
