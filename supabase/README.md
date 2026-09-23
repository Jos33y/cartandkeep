# supabase

`migrations/` is the schema. Numbered, applied in order, never edited once run.
A change is a new file.

`queries/` is a log of everything run by hand against the database, one file per
run, named `YYYY-MM-DD_short-description.sql`. Anything typed into the SQL
editor gets saved here afterwards. It is not a migration and is not replayed,
but when a number looks wrong in three weeks this is the record of what touched
the data.

Applying a migration:

1. Supabase dashboard, SQL editor
2. Paste the file whole
3. Confirm no errors
4. Note it in `queries/` if you deviated from the file at all