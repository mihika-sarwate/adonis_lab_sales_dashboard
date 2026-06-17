-- Allow admins/head office to update user profiles from the management panel.

drop policy if exists user_profiles_update_admin on public.user_profiles;

create policy user_profiles_update_admin
on public.user_profiles
for update
to authenticated
using (public.is_global_access())
with check (public.is_global_access());
