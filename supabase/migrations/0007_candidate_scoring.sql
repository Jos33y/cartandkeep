-- The interface reads a rank score, a component breakdown, and the demand
-- metrics behind them. None of those had columns, so VerdictBar rendered
-- nothing and the ledger showed source agreement where it said score.
--
-- confidence stays. It answers "how many sources agree", which is a different
-- and still useful question from "how good is this".

alter table candidates
  add column score                integer check (score between 0 and 100),
  add column component_count      integer not null default 0,
  add column breakdown            jsonb not null default '{}'::jsonb,

  add column sold_30d             integer,
  add column avg_sold_price       numeric(10,2),
  add column active_listings      integer,
  add column sell_through         numeric(6,3),
  add column trend                numeric(5,2),
  add column seller_concentration numeric(4,3),

  add column window_start         date,
  add column window_end           date;

-- Ranking is the sort order the reviewer actually wants. The old index on
-- confidence stays for the source-agreement view.
create index on candidates (batch_id, score desc nulls last);

comment on column candidates.score is 'rankScore output, gates already applied';
comment on column candidates.breakdown is 'per component value and weight, the basis of the score';
comment on column candidates.component_count is 'how many components had data, so the bar can show the basis';
