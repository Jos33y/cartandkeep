-- The monthly search report.
--
-- The retainer commits to one of these on 24 August and on the 22nd of every
-- month after. The value is not any single month's figures, it is the line from
-- nothing to eleven clicks to ninety, and that line only exists if somebody
-- keeps the months.
--
-- Stored rather than read live from Search Console, for three reasons. Search
-- Console holds sixteen months and then drops it, so a live view quietly loses
-- her first year. Property access can lapse, and a report that disappears when
-- an OAuth token expires is not a report. And each month carries a written read
-- of what changed, which is the part of this that is judgement rather than a
-- number and has nowhere to live in an API response.
--
-- The catalogue half is deliberately not in here. How many products are
-- indexable and what each one is missing is computed from her own rows at read
-- time, because it changes the hour she writes a description and a snapshot of
-- it would be wrong by Tuesday.

create table if not exists seo_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  -- The first of the month it covers. A date rather than a year and month pair,
  -- so ordering and ranges are ordinary date work.
  month date not null,

  /*
   * What Google reported.
   *
   * Null is not zero and the difference matters most in the first months. Zero
   * clicks means Google showed the shop and nobody came. Null means we could not
   * see, because the site was not verified or not yet indexed, and a chart that
   * draws those the same way tells her the wrong story about her own first
   * month.
   */
  clicks integer check (clicks is null or clicks >= 0),
  impressions integer check (impressions is null or impressions >= 0),
  avg_position numeric(5, 2) check (avg_position is null or avg_position > 0),

  -- Pages Google has actually indexed, against what the sitemap offered it.
  indexed_pages integer check (indexed_pages is null or indexed_pages >= 0),
  submitted_pages integer check (submitted_pages is null or submitted_pages >= 0),

  -- [{ query, clicks, impressions, position }], top of the month.
  queries jsonb not null default '[]'::jsonb,
  -- [{ page, clicks, impressions }]
  pages jsonb not null default '[]'::jsonb,

  /*
   * The report itself.
   *
   * `summary` is what changed and what it means. `next` is what happens before
   * the following one. Both are written by the studio, and they are the reason
   * this is a report rather than a dashboard: a number without a read of it
   * asks her to do the interpreting, which is what she is paying not to do.
   */
  summary text,
  next text,

  -- Whether the property was verified and returning data that month. Separates
  -- "no traffic" from "no visibility into traffic", which look identical in a
  -- table of nulls.
  source text not null default 'none'
    check (source in ('none', 'search_console', 'manual')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, month)
);

create index if not exists seo_reports_month_idx on seo_reports (tenant_id, month desc);

create or replace function seo_reports_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists seo_reports_touch on seo_reports;
create trigger seo_reports_touch before update on seo_reports
  for each row execute function seo_reports_touch();

alter table seo_reports enable row level security;

-- Hers to read, ours to write. The figures come from Search Console and the
-- reading of them is studio work, so a settings screen cannot edit last month's
-- numbers into a better shape.
revoke all on seo_reports from anon, authenticated;
grant select on seo_reports to authenticated;

drop policy if exists seo_reports_read on seo_reports;
create policy seo_reports_read on seo_reports
  for select to authenticated
  using (has_tenant(tenant_id));

comment on table seo_reports is
  'One row per month per tenant. The Google half is stored because Search Console drops history after sixteen months and access can lapse, and because each month carries a written read of what changed. The catalogue half is computed live and is deliberately absent here.';

comment on column seo_reports.clicks is
  'Null means we could not see, because the property was not verified or the site was not indexed. Zero means Google showed the shop and nobody came. Charting those the same way tells the wrong story about a first month.';
