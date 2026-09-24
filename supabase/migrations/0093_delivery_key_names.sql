-- 0040 stored the delivery settings as freeOver, cutoffHour, transitMin and transitMax. The portal,
-- checkout and notify read and write free_over, cutoff_hour, transit_min and transit_max, so a change
-- saved in Settings reached the checkout but not the shop front: a threshold raised to £50 was charged
-- at checkout while every product page still promised free delivery over £40.
-- One set of names from here: the ones the checkout charges by. A value she has saved wins over the seed.
update tenants
set store = jsonb_set(
  store,
  '{delivery}',
  ((store -> 'delivery') - array['freeOver', 'cutoffHour', 'transitMin', 'transitMax'])
  || jsonb_strip_nulls(jsonb_build_object(
    'free_over',   coalesce(store -> 'delivery' -> 'free_over',   store -> 'delivery' -> 'freeOver'),
    'cutoff_hour', coalesce(store -> 'delivery' -> 'cutoff_hour', store -> 'delivery' -> 'cutoffHour'),
    'transit_min', coalesce(store -> 'delivery' -> 'transit_min', store -> 'delivery' -> 'transitMin'),
    'transit_max', coalesce(store -> 'delivery' -> 'transit_max', store -> 'delivery' -> 'transitMax')
  ))
)
where jsonb_typeof(store -> 'delivery') = 'object';
