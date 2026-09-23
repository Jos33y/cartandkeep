-- Categories bounded, no cosmetic terms left in the search list.

select
  research -> 'categories'                  as categories,
  jsonb_array_length(research -> 'terms')   as term_count,
  jsonb_array_length(research -> 'exclude' -> 'terms') as excluded_count
from tenants
where slug = 'cart-and-keep';

| categories                                       | term_count | excluded_count |
| ------------------------------------------------ | ---------- | -------------- |
| ["Beauty Tools & Accessories","Pet Accessories"] | 25         | 44             |

-- Should return no rows. Any hit means a cosmetic term is still being searched.
select t.term
from tenants,
     jsonb_array_elements_text(research -> 'terms') as t(term),
     jsonb_array_elements_text(research -> 'exclude' -> 'terms') as e(bad)
where slug = 'cart-and-keep'
  and t.term ilike '%' || e.bad || '%';
  
Success. No rows returned

