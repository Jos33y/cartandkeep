-- The short address rule, two refinements after the live preview (keeper-task-01-shop-drafts.md):
--   "In/Out" stays one word ("rca-in-out", not "rca-out"), so slashes no longer split words;
--   a word already in the address, or its plural, is skipped ("duster-refills-cleaning", not "duster-refills-refill").
-- The same change is made to slugFor in shop-check.ts; slug_parity_test.ts keeps the two the same.

create or replace function keeper_slug(p_title text)
returns text
language plpgsql
immutable
as $$
declare
  w text;
  out_words text[] := '{}';
  stems text[] := '{}';
  cleaned text;
begin
  cleaned := translate(lower(coalesce(p_title, '')),
    'àáâãäåāçćčèéêëēėęìíîïīįñńòóôõöōùúûüūýÿžźż', 'aaaaaaaccceeeeeeeiiiiiinnoooooouuuuuyyzzz');
  cleaned := replace(cleaned, '&', ' and ');
  for w in select regexp_replace(regexp_replace(x, '[^a-z0-9]+', '-', 'g'), '^-+|-+$', '', 'g')
           from regexp_split_to_table(cleaned, '[\s,|]+') as x
  loop
    continue when w = '' or w = any(array['a', 'an', 'and', 'the', 'of', 'with', 'for', 'in', 'on', 'to', 'by', 'from', 'uk', 'new', 'pcs', 'pc', 'x'])
      or w ~ '^\d+(pcs|pc|pk|x)$';
    continue when regexp_replace(w, 's$', '') = any(stems);
    exit when cardinality(out_words) >= 6 or length(array_to_string(out_words || w, '-')) > 50;
    out_words := out_words || w;
    stems := stems || regexp_replace(w, 's$', '');
  end loop;
  return coalesce(nullif(array_to_string(out_words, '-'), ''), 'product');
end;
$$;
