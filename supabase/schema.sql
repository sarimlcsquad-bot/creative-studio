-- AI Brand Kit & Creative Generator: Supabase schema
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists "pgcrypto";

create table if not exists public.brands (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  name              text not null,
  website           text not null,
  industry          text not null,
  description       text not null default '',
  service_area      text not null default '',
  target_audience   text not null default '',
  services          jsonb not null default '[]'::jsonb,   -- ["Website", "CRM", ...]
  offer             text not null default '',              -- pricing / main offer
  differentiators   jsonb not null default '[]'::jsonb,
  proof_points      jsonb not null default '[]'::jsonb,    -- VERIFIED claims only
  guarantees        jsonb not null default '[]'::jsonb,
  default_cta       text not null default 'Book a free strategy call',
  tone_of_voice     text not null default '',
  banned_phrases    jsonb not null default '[]'::jsonb,
  compliance_notes  text not null default '',
  colors            jsonb not null default '{"deep":"#0B0B0C","light":"#F7F7F2","accent":"#B8F23A","primary":"#0B0B0C","secondary":"#F7F7F2"}'::jsonb,
  fonts             jsonb not null default '{"heading":"Montserrat","body":"Nunito Sans"}'::jsonb,
  logo_url          text,
  logo_mono         boolean not null default false,        -- recolour logo to the light colour on dark cards
  brand_images      jsonb not null default '[]'::jsonb,    -- [{url, label}]
  social            jsonb not null default '{}'::jsonb,    -- {facebook, instagram, ...}
  agency_name       text not null default '',
  website_summary   text not null default ''               -- filled by "Auto-fill from website"
);

create table if not exists public.creatives (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  brand_id       uuid not null references public.brands(id) on delete cascade,
  source         text not null check (source in ('agency','owner')),
  created_by     text not null default '',
  mode           text not null check (mode in ('random','prompt')),
  prompt         text not null default '',
  format         text not null default '1:1' check (format in ('1:1','4:5','9:16')),
  photo_source   text not null default 'ai' check (photo_source in ('ai','brand','none')),
  stage          text not null default 'auto',
  method         text not null default 'presold' check (method in ('presold','100m','mix')),
  status         text not null default 'generating' check (status in ('generating','ready','failed')),
  error          text,
  spec           jsonb,          -- card layout the web app renders (blocks, palette choice, photo layout)
  concept        jsonb,          -- presold fields: stage, tier, psychographic layer, ladder...
  ad_copy        jsonb,          -- primary_text, headline, description, cta_button
  photo_prompt   text,
  photo_url      text,
  rendered_url   text            -- final PNG saved by the web app
);

-- Added later: the email shown on ads, and per-audience details (business owners / agency owners).
-- Safe to re-run on an existing database.
alter table public.brands add column if not exists email text not null default '';
alter table public.brands add column if not exists audiences jsonb not null default '{}'::jsonb;

create index if not exists creatives_brand_idx on public.creatives (brand_id, created_at desc);
create index if not exists creatives_source_idx on public.creatives (source, created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists brands_touch on public.brands;
create trigger brands_touch before update on public.brands for each row execute function public.touch_updated_at();
drop trigger if exists creatives_touch on public.creatives;
create trigger creatives_touch before update on public.creatives for each row execute function public.touch_updated_at();

-- Only n8n (service role / secret key) reads and writes. RLS on with no policies
-- means the public anon key can do nothing with these tables.
alter table public.brands enable row level security;
alter table public.creatives enable row level security;

-- Public storage buckets: images must be publicly readable so the web app can draw them on a canvas.
insert into storage.buckets (id, name, public) values ('brand-assets','brand-assets', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('creatives','creatives', true) on conflict (id) do nothing;

-- Upgrading an earlier install: add the method column.
alter table public.creatives add column if not exists method text not null default 'presold';
