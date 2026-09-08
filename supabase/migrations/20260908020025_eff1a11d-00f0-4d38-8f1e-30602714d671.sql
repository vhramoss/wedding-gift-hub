alter table public.weddings
  add column if not exists hero_pos_x integer not null default 50,
  add column if not exists hero_pos_y integer not null default 50;