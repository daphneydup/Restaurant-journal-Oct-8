-- Account deletion.
--
-- Run this after 20261008000000_init.sql. It lets a signed-in person (including a guest) delete
-- their own account. Deleting the auth user cascades to every table: profile, restaurants,
-- visits (and their ratings), dishes and go-back entries all have ON DELETE CASCADE chains that
-- start at auth.users.
--
-- It must be SECURITY DEFINER because ordinary users have no permission on the auth schema. It is
-- safe because it can only ever delete the caller's own row (auth.uid()), and the search_path is
-- pinned so nothing can be redirected to a look-alike table.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Only signed-in users (guests included, they have the "authenticated" role) may call it.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
