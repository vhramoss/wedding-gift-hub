alter table public.weddings
  add column if not exists hero_opacity integer not null default 30,
  add column if not exists hero_height text not null default 'grande',
  add column if not exists hero_rotate_seconds integer not null default 7,
  add column if not exists music_url text,
  add column if not exists music_title text,
  add column if not exists music_enabled boolean not null default false,
  add column if not exists music_autoplay boolean not null default true,
  add column if not exists rsvp_reminder_enabled boolean not null default false,
  add column if not exists rsvp_reminder_days integer not null default 15,
  add column if not exists rsvp_reminder_template text;

alter table public.wedding_photos
  add column if not exists show_in_cover boolean not null default false;