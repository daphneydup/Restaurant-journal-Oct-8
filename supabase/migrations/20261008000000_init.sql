-- Table for Everyone: initial schema.
--
-- Run this once in the Supabase dashboard (SQL Editor) or with `supabase db push`.
-- It is safe to read top to bottom: tables, security, the log_visit function, seed data.
--
-- Identity: the app signs users in anonymously (Authentication > Providers > "Allow anonymous
-- sign-ins" must be ON). Every row belongs to auth.uid(), and row-level security means each
-- person can only ever see and change their own rows. Real sign-in can replace anonymous
-- sign-in later without changing this schema.

-- ---------------------------------------------------------------------------
-- Reference data: the dietary lenses (data, not code, so adding one is an INSERT)
-- ---------------------------------------------------------------------------
create table public.diet_lenses (
  id          text primary key,
  label       text not null,
  short_label text not null,
  icon        text not null,
  kind        text not null check (kind in ('preference', 'restriction')),
  sort_order  integer not null default 0
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null default 'Friend' check (char_length(btrim(display_name)) between 1 and 40),
  home_city         text not null default 'Dallas' check (char_length(btrim(home_city)) between 1 and 60),
  default_lens_ids  text[] not null default '{}',
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  neighborhood text not null check (char_length(btrim(neighborhood)) between 1 and 60),
  city         text not null check (char_length(btrim(city)) between 1 and 60),
  price_tier   smallint not null check (price_tier between 1 and 4),
  cuisine      text check (cuisine is null or char_length(btrim(cuisine)) between 1 and 40),
  created_at   timestamptz not null default now()
);
-- The same spot (name + neighborhood, ignoring case) can only be saved once per person.
create unique index restaurants_unique_spot
  on public.restaurants (user_id, lower(btrim(name)), lower(btrim(neighborhood)));

create table public.visits (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  restaurant_id        uuid not null references public.restaurants (id) on delete cascade,
  date                 date not null,
  worked_for_everyone  text not null check (worked_for_everyone in ('yes', 'maybe', 'no')),
  price_tier           smallint not null check (price_tier between 1 and 4),
  worth_it             boolean,
  note                 text check (note is null or char_length(note) <= 280),
  companions           text[] not null default '{}' check (cardinality(companions) <= 12),
  photo_urls           text[] not null default '{}' check (cardinality(photo_urls) <= 4),
  created_at           timestamptz not null default now(),
  -- Lets dishes point at (visit, restaurant) together, so a dish can't claim another spot's visit.
  unique (id, restaurant_id)
);
create index visits_restaurant_idx on public.visits (restaurant_id);
create index visits_user_date_idx on public.visits (user_id, date desc);

-- One rating per diet per visit.
create table public.visit_ratings (
  visit_id uuid not null references public.visits (id) on delete cascade,
  lens_id  text not null references public.diet_lenses (id),
  rating   smallint not null check (rating between 1 and 5),
  primary key (visit_id, lens_id)
);

create table public.dishes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  visit_id      uuid,
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  verdict       text not null check (verdict in ('order-again', 'skip')),
  lens_ids      text[] not null default '{}',
  photo_url     text,
  created_at    timestamptz not null default now(),
  -- When a dish is tied to a visit, that visit must be at the same restaurant. Deleting the
  -- visit deletes its dishes. (With visit_id null the constraint does not apply.)
  foreign key (visit_id, restaurant_id) references public.visits (id, restaurant_id) on delete cascade
);
create index dishes_restaurant_idx on public.dishes (restaurant_id);

create table public.go_back_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  note          text check (note is null or char_length(btrim(note)) between 1 and 140),
  added_at      timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

-- ---------------------------------------------------------------------------
-- Row-level security: you only ever touch your own rows.
-- ---------------------------------------------------------------------------
alter table public.diet_lenses     enable row level security;
alter table public.profiles        enable row level security;
alter table public.restaurants     enable row level security;
alter table public.visits          enable row level security;
alter table public.visit_ratings   enable row level security;
alter table public.dishes          enable row level security;
alter table public.go_back_entries enable row level security;

create policy "lenses are readable by signed-in users"
  on public.diet_lenses for select to authenticated using (true);

create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "own restaurants" on public.restaurants for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own visits" on public.visits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own dishes" on public.dishes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own go-back entries" on public.go_back_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ratings have no user_id of their own: they belong to whoever owns the visit.
create policy "ratings of own visits" on public.visit_ratings for all to authenticated
  using (exists (select 1 from public.visits v where v.id = visit_id and v.user_id = auth.uid()))
  with check (exists (select 1 from public.visits v where v.id = visit_id and v.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- log_visit: the whole "Log a Visit" submission as ONE transaction.
--
-- Creates the restaurant if new, then the visit, its ratings, its dishes, and (optionally) the
-- go-back entry. If anything fails, nothing is saved. Runs as the caller (security invoker), so
-- row-level security still applies to every insert.
--
-- p = {
--   "restaurant": {"mode": "existing", "restaurantId": "<uuid>"}
--              or {"mode": "new", "name": "", "neighborhood": "", "city": "", "cuisine": ""},
--   "visit":  {"date", "ratings": [{"lensId", "rating"}], "workedForEveryone", "priceTier",
--              "worthIt", "note", "companions": [], "photoUrls": []},
--   "dishes": [{"name", "verdict", "lensIds": [], "photoUrl"}],
--   "addToGoBack": true | false
-- }
-- Returns {"restaurant_id", "visit_id", "created_restaurant"}.
-- ---------------------------------------------------------------------------
create function public.log_visit(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_created boolean := false;
  v_visit_id uuid;
  v_rating jsonb;
  v_dish jsonb;
begin
  if p -> 'restaurant' ->> 'mode' = 'existing' then
    v_restaurant_id := (p -> 'restaurant' ->> 'restaurantId')::uuid;
    if not exists (select 1 from restaurants where id = v_restaurant_id) then
      raise exception 'Restaurant does not exist' using errcode = '23503';
    end if;
  else
    -- A duplicate raises unique_violation (23505), which the app reports as "already saved".
    insert into restaurants (name, neighborhood, city, price_tier, cuisine)
    values (
      btrim(p -> 'restaurant' ->> 'name'),
      btrim(p -> 'restaurant' ->> 'neighborhood'),
      btrim(p -> 'restaurant' ->> 'city'),
      (p -> 'visit' ->> 'priceTier')::smallint,
      nullif(btrim(coalesce(p -> 'restaurant' ->> 'cuisine', '')), '')
    )
    returning id into v_restaurant_id;
    v_created := true;
  end if;

  insert into visits (restaurant_id, date, worked_for_everyone, price_tier, worth_it, note, companions, photo_urls)
  values (
    v_restaurant_id,
    (p -> 'visit' ->> 'date')::date,
    p -> 'visit' ->> 'workedForEveryone',
    (p -> 'visit' ->> 'priceTier')::smallint,
    (p -> 'visit' ->> 'worthIt')::boolean,
    nullif(p -> 'visit' ->> 'note', ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'visit' -> 'companions')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p -> 'visit' -> 'photoUrls')), '{}')
  )
  returning id into v_visit_id;

  for v_rating in select * from jsonb_array_elements(p -> 'visit' -> 'ratings') loop
    insert into visit_ratings (visit_id, lens_id, rating)
    values (v_visit_id, v_rating ->> 'lensId', (v_rating ->> 'rating')::smallint);
  end loop;

  for v_dish in select * from jsonb_array_elements(coalesce(p -> 'dishes', '[]'::jsonb)) loop
    insert into dishes (restaurant_id, visit_id, name, verdict, lens_ids, photo_url)
    values (
      v_restaurant_id,
      v_visit_id,
      btrim(v_dish ->> 'name'),
      v_dish ->> 'verdict',
      coalesce(array(select jsonb_array_elements_text(v_dish -> 'lensIds')), '{}'),
      v_dish ->> 'photoUrl'
    );
  end loop;

  if coalesce((p ->> 'addToGoBack')::boolean, false) then
    insert into go_back_entries (restaurant_id) values (v_restaurant_id)
    on conflict (user_id, restaurant_id) do nothing;
  end if;

  return jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'visit_id', v_visit_id,
    'created_restaurant', v_created
  );
end;
$$;

grant execute on function public.log_visit(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: the dietary lenses (the same ones the demo data uses)
-- ---------------------------------------------------------------------------
insert into public.diet_lenses (id, label, short_label, icon, kind, sort_order) values
  ('vegan',       'Vegan options',      'Vegan',       'leaf',      'restriction', 1),
  ('vegetarian',  'Vegetarian options', 'Vegetarian',  'sprout',    'restriction', 2),
  ('steak',       'Steak / meat',       'Steak',       'beef',      'preference',  3),
  ('gluten-free', 'Gluten-free',        'Gluten-free', 'wheat-off', 'restriction', 4),
  ('dairy-free',  'Dairy-free',         'Dairy-free',  'milk-off',  'restriction', 5),
  ('pescatarian', 'Pescatarian',        'Pescatarian', 'fish',      'preference',  6);
