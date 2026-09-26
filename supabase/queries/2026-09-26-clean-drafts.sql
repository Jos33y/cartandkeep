-- Run by hand in the SQL editor, top to bottom. Not a migration.

-- 1. Live descriptions that talk about the supplier or the photograph. Read them; fix each by hand in the product sheet.
select slug, title, description
from store_products
where status = 'live'
  and description ~* '(supplier|photograph|not visible|listing|cannot be confirmed)';

-- 2. Stored drafts whose "what is in the box" came back as a pair of quote marks: make them truly empty.
update store_products
set derived_fields = jsonb_set(derived_fields, '{draft,in_the_box}', '""'::jsonb)
where derived_fields->'draft'->>'in_the_box' ~ '^\s*["'']{2}\s*$';

-- 3. The same, if one was already saved into the product itself.
update store_products
set in_the_box = null
where in_the_box ~ '^\s*["'']{2}\s*$';
