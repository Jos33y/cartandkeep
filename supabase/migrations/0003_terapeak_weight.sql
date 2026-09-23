-- Terapeak was seeded as a fallback and left out of the weights. It is now a
-- first-class velocity source, same class of signal as Zik, so it carries the
-- same weight. Without this it silently defaults to 1.

update tenants
set scoring = jsonb_set(scoring, '{weights,terapeak_export}', '1.2'::jsonb)
where slug = 'cart-and-keep';