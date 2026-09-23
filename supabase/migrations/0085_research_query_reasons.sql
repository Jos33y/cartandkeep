-- Entry now ends a candidate instead of being reported, so it needs its codes.

alter table research_queries drop constraint if exists research_queries_reason_check;

alter table research_queries add constraint research_queries_reason_check
  check (
    reason is null
    or reason in (
      'no_listings', 'crowded', 'young_not_selling', 'nothing_sold',
      'market_small', 'below_cost',
      'entry_large_only', 'entry_thin', 'entry_untested',
      'unknown'
    )
  );
