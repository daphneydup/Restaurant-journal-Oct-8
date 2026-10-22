-- Reaction GIFs on visits.
--
-- Run this after 20261020000000_rewards.sql (it replaces log_visit, which that file extended).
--
-- A visit can carry one GIF chosen from GIPHY. Only the address and a title are stored. The check
-- constraint means the database itself refuses any address that isn't an https GIPHY one, so a
-- visit can never be made to load some other site's file.
--
-- The GIF search itself is the `giphy` Edge Function (supabase/functions/giphy), which keeps the
-- GIPHY key in a Supabase secret.

alter table public.visits
  add column gif_url   text check (gif_url is null or (char_length(gif_url) <= 500 and gif_url ~ '^https://([a-z0-9-]+\.)*giphy\.com/')),
  add column gif_title text check (gif_title is null or char_length(gif_title) between 1 and 200);

-- log_visit: the same as before, now also saving the GIF (see the visit's "gifUrl" / "gifTitle").
create or replace function public.log_visit(p jsonb)
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

  insert into visits (restaurant_id, date, worked_for_everyone, price_tier, worth_it, note, companions, photo_urls, gif_url, gif_title)
  values (
    v_restaurant_id,
    (p -> 'visit' ->> 'date')::date,
    p -> 'visit' ->> 'workedForEveryone',
    (p -> 'visit' ->> 'priceTier')::smallint,
    (p -> 'visit' ->> 'worthIt')::boolean,
    nullif(p -> 'visit' ->> 'note', ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'visit' -> 'companions')), '{}'),
    coalesce(array(select jsonb_array_elements_text(p -> 'visit' -> 'photoUrls')), '{}'),
    nullif(p -> 'visit' ->> 'gifUrl', ''),
    nullif(left(p -> 'visit' ->> 'gifTitle', 200), '')
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
    'created_restaurant', v_created,
    'points_earned', coalesce(
      (select sum(points) from points_ledger where ref_id = v_visit_id and kind = 'visit'), 0)
  );
end;
$$;
