alter table public.portfolio_items
  add column if not exists gallery jsonb not null default '[]'::jsonb;
