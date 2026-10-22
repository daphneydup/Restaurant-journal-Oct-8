-- Rewards: points for visits and invites, redeemable perks, vouchers.
--
-- Run this after 20261009000000_account_deletion.sql.
--
-- The whole programme is enforced HERE, not in the app. People can read their own ledger and
-- vouchers, but nobody can insert, update or delete them directly: there are no write policies,
-- and the only writers are the SECURITY DEFINER functions below (and the trigger that pays for a
-- visit). That is what stops a browser from granting itself points.
--
-- The numbers (50 points a visit, +10 for a note, +10 for a photo, 3 paid visits a day, 1 per
-- restaurant a day, 200 points per invite side, 25 paid invites) mirror src/lib/rewardRules.ts.
-- Change both together.
--
-- Custom error codes (SQLSTATE) the app understands:
--   TF001 not enough points      TF002 unknown invite code      TF003 invite already used
--   TF004 your own invite code   TF005 needs a confirmed account TF006 unknown reward
--   TF007 voucher already used or expired                       TF008 unknown voucher

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.points_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('visit', 'invite', 'joined', 'redeem')),
  points        integer not null check (points <> 0),
  label         text not null check (char_length(label) between 1 and 200),
  -- Plain uuids, not foreign keys: deleting a restaurant or visit must never erase points.
  restaurant_id uuid,
  ref_id        uuid,
  created_at    timestamptz not null default now(),
  -- Only redemptions spend; everything else earns.
  check ((kind = 'redeem') = (points < 0))
);
create index points_ledger_user_idx on public.points_ledger (user_id, created_at desc);
-- A visit can pay out once, however the trigger is reached.
create unique index points_ledger_visit_once on public.points_ledger (ref_id) where kind = 'visit';

create table public.rewards_catalog (
  id          text primary key,
  title       text not null,
  description text not null,
  partner     text not null,
  category    text not null check (category in ('appetizer', 'drink', 'dessert', 'entree', 'discount', 'experience')),
  cost        integer not null check (cost > 0),
  active      boolean not null default true
);

create table public.vouchers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  reward_id    text not null,
  -- Copied from the catalogue so later edits never rewrite what someone already bought.
  title        text not null,
  partner      text not null,
  category     text not null,
  code         text not null unique,
  points_spent integer not null check (points_spent > 0),
  status       text not null default 'active' check (status in ('active', 'used')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '90 days',
  used_at      timestamptz
);
create index vouchers_user_idx on public.vouchers (user_id, created_at desc);

create table public.referral_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code       text not null unique check (code ~ '^TFE-[A-HJKMNP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

-- One row per person who used an invite. The primary key is what makes "only once" a fact.
create table public.referral_claims (
  claimer_id uuid primary key references auth.users (id) on delete cascade,
  -- Set null (not cascade) if the inviter leaves, so the claimer can't claim a second time.
  inviter_id uuid references auth.users (id) on delete set null,
  code       text not null,
  created_at timestamptz not null default now()
);
create index referral_claims_inviter_idx on public.referral_claims (inviter_id);

-- ---------------------------------------------------------------------------
-- Row-level security: read your own, write nothing directly.
-- ---------------------------------------------------------------------------
alter table public.points_ledger   enable row level security;
alter table public.rewards_catalog enable row level security;
alter table public.vouchers        enable row level security;
alter table public.referral_codes  enable row level security;
alter table public.referral_claims enable row level security;

create policy "read own ledger"  on public.points_ledger for select to authenticated using (user_id = auth.uid());
create policy "read own vouchers" on public.vouchers      for select to authenticated using (user_id = auth.uid());
create policy "read the catalogue" on public.rewards_catalog for select to authenticated using (active);
-- referral_codes and referral_claims have no policies: they are only reached through functions.

-- Supabase grants every privilege on new tables to anon and authenticated, and TRUNCATE ignores
-- row-level security, so take everything back and give back only what is needed.
revoke all on public.points_ledger, public.vouchers, public.rewards_catalog,
  public.referral_codes, public.referral_claims from anon, authenticated;
grant select on public.points_ledger, public.vouchers, public.rewards_catalog to authenticated;

-- ---------------------------------------------------------------------------
-- Paying for a visit: a trigger, so every way of saving a visit (log_visit, a direct insert)
-- is treated the same and the app can't skip or fake it.
-- ---------------------------------------------------------------------------
create function public.award_visit_points()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text;
  v_today  integer;
  v_spot   integer;
  v_points integer;
begin
  -- Serialise this person's earning and spending so the daily limits and balance can't be raced.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  select count(*) into v_today
    from public.points_ledger
   where user_id = new.user_id and kind = 'visit'
     and (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date;
  if v_today >= 3 then return new; end if;

  select count(*) into v_spot
    from public.points_ledger
   where user_id = new.user_id and kind = 'visit' and restaurant_id = new.restaurant_id
     and (created_at at time zone 'utc')::date = (now() at time zone 'utc')::date;
  if v_spot >= 1 then return new; end if;

  v_points := 50
    + case when btrim(coalesce(new.note, '')) <> '' then 10 else 0 end
    + case when cardinality(new.photo_urls) > 0 then 10 else 0 end;

  select name into v_name from public.restaurants where id = new.restaurant_id;

  insert into public.points_ledger (user_id, kind, points, label, restaurant_id, ref_id)
  values (new.user_id, 'visit', v_points, 'Visit to ' || coalesce(v_name, 'a restaurant'), new.restaurant_id, new.id);
  return new;
end;
$$;

revoke all on function public.award_visit_points() from public, anon, authenticated;

create trigger visits_award_points
  after insert on public.visits
  for each row execute function public.award_visit_points();

-- ---------------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------------
-- Runs as the caller, so row-level security shows only their own ledger.
create function public.get_rewards_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'balance',         coalesce((select sum(points) from public.points_ledger), 0),
    'lifetime_earned', coalesce((select sum(points) from public.points_ledger where points > 0), 0),
    'entries',         coalesce((
      select jsonb_agg(e) from (
        select id, kind, points, label, restaurant_id, created_at
          from public.points_ledger
         order by created_at desc, id
         limit 100
      ) e
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Redeeming: the balance check, the deduction and the voucher are ONE transaction.
-- ---------------------------------------------------------------------------
create function public.redeem_reward(p_reward_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user       uuid := auth.uid();
  v_reward     public.rewards_catalog;
  v_balance    bigint;
  v_voucher_id uuid := gen_random_uuid();
  v_voucher    public.vouchers;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));

  select * into v_reward from public.rewards_catalog where id = p_reward_id and active;
  if not found then
    raise exception 'That reward is not available' using errcode = 'TF006';
  end if;

  select coalesce(sum(points), 0) into v_balance from public.points_ledger where user_id = v_user;
  if v_balance < v_reward.cost then
    raise exception 'Not enough points' using errcode = 'TF001';
  end if;

  insert into public.points_ledger (user_id, kind, points, label, ref_id)
  values (v_user, 'redeem', -v_reward.cost, 'Redeemed: ' || v_reward.title, v_voucher_id);

  insert into public.vouchers (id, user_id, reward_id, title, partner, category, code, points_spent)
  values (
    v_voucher_id, v_user, v_reward.id, v_reward.title, v_reward.partner, v_reward.category,
    'TFE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
      || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)),
    v_reward.cost
  )
  returning * into v_voucher;

  return to_jsonb(v_voucher);
end;
$$;

create function public.use_voucher(p_voucher_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_voucher public.vouchers;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  update public.vouchers
     set status = 'used', used_at = now()
   where id = p_voucher_id and user_id = v_user and status = 'active' and expires_at > now()
  returning * into v_voucher;

  if not found then
    if exists (select 1 from public.vouchers where id = p_voucher_id and user_id = v_user) then
      raise exception 'This voucher is no longer valid' using errcode = 'TF007';
    end if;
    raise exception 'Voucher not found' using errcode = 'TF008';
  end if;
  return to_jsonb(v_voucher);
end;
$$;

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------
-- Returns the caller's own invite code, creating it the first time it is asked for.
create function public.get_my_referral()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_new  text;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select code into v_code from public.referral_codes where user_id = v_user;
  if v_code is null then
    loop
      -- Hex digits 0 and 1 are swapped for G and H so every code matches the readable alphabet.
      v_new := 'TFE-' || translate(upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)), '01', 'GH');
      begin
        insert into public.referral_codes (user_id, code) values (v_user, v_new);
        v_code := v_new;
        exit;
      exception when unique_violation then
        -- Either another person holds that code (draw again) or this person just got one.
        select code into v_code from public.referral_codes where user_id = v_user;
        exit when v_code is not null;
      end;
    end loop;
  end if;

  return jsonb_build_object(
    'code', v_code,
    'invited_count', (select count(*) from public.referral_claims where inviter_id = v_user),
    'points_earned', coalesce((select sum(points) from public.points_ledger where user_id = v_user and kind = 'invite'), 0),
    'has_claimed', exists (select 1 from public.referral_claims where claimer_id = v_user)
  );
end;
$$;

-- Uses a friend's code. Both people are paid. Guards: a confirmed, non-guest account; one claim
-- per person (the primary key); never your own code; an inviter is only paid for 25 friends.
create function public.claim_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_code    text := upper(btrim(coalesce(p_code, '')));
  v_inviter uuid;
  v_paid    integer;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  -- Guests and unconfirmed emails can't claim: it is what makes self-made accounts costly.
  if not exists (
    select 1 from auth.users u
     where u.id = v_user and not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
  ) then
    raise exception 'Create an account and confirm your email to claim an invite' using errcode = 'TF005';
  end if;

  select user_id into v_inviter from public.referral_codes where code = v_code;
  if not found then
    raise exception 'That invite code does not match anyone' using errcode = 'TF002';
  end if;
  if v_inviter = v_user then
    raise exception 'You can not use your own invite code' using errcode = 'TF004';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_inviter::text));

  begin
    insert into public.referral_claims (claimer_id, inviter_id, code) values (v_user, v_inviter, v_code);
  exception when unique_violation then
    raise exception 'You have already used an invite' using errcode = 'TF003';
  end;

  insert into public.points_ledger (user_id, kind, points, label)
  values (v_user, 'joined', 200, 'Welcome bonus from a friend’s invite');

  select count(*) into v_paid from public.referral_claims where inviter_id = v_inviter;
  if v_paid <= 25 then
    insert into public.points_ledger (user_id, kind, points, label)
    values (v_inviter, 'invite', 200, 'A friend joined with your invite');
  end if;

  return jsonb_build_object('points_awarded', 200);
end;
$$;

-- Only signed-in people (guests included, except where a function says otherwise) may call these.
revoke all on function public.get_rewards_summary() from public, anon;
revoke all on function public.redeem_reward(text)   from public, anon;
revoke all on function public.use_voucher(uuid)     from public, anon;
revoke all on function public.get_my_referral()     from public, anon;
revoke all on function public.claim_referral(text)  from public, anon;
grant execute on function public.get_rewards_summary() to authenticated;
grant execute on function public.redeem_reward(text)   to authenticated;
grant execute on function public.use_voucher(uuid)     to authenticated;
grant execute on function public.get_my_referral()     to authenticated;
grant execute on function public.claim_referral(text)  to authenticated;

-- ---------------------------------------------------------------------------
-- log_visit now also reports the points the visit earned (0 when a daily limit was reached).
-- Same behaviour as before otherwise.
-- ---------------------------------------------------------------------------
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
    'created_restaurant', v_created,
    'points_earned', coalesce(
      (select sum(points) from points_ledger where ref_id = v_visit_id and kind = 'visit'), 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed: the sample perk catalogue (fictional partners; nothing is honoured by a real restaurant).
-- ---------------------------------------------------------------------------
insert into public.rewards_catalog (id, title, description, partner, category, cost) values
  ('appetizer-ember',  'Complimentary appetizer',        'Any starter from the seasonal menu, with your main course.',          'Ember & Orchard',     'appetizer',  150),
  ('drink-marigold',   'Signature cocktail or mocktail', 'One house drink on us, alcoholic or not.',                            'Marigold Social',     'drink',      120),
  ('dessert-fig',      'Dessert to share',               'The pastry chef’s dessert of the evening, for the whole table.',      'Little Fig Kitchen',  'dessert',    180),
  ('discount-basil',   '$15 off your table',             'Taken off the bill on dinner for two or more.',                       'Basil & Bone',        'discount',   250),
  ('discount-saffron', '20% off dinner',                 'Twenty percent off the food on a weekday evening.',                   'Saffron & Salt',      'discount',   400),
  ('entree-cinder',    'Complimentary entrée',           'A main course of your choice when a second is ordered.',              'Cinder House',        'entree',     500),
  ('bottle-lantern',   'Bottle of sparkling',            'A bottle of the house sparkling wine to start the evening.',          'Lantern Alley',       'drink',      800),
  ('tasting-copper',   'Chef’s tasting for two',         'The full tasting menu for two at the chef’s counter.',                'The Copper Table',    'experience', 1500);
