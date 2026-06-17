
revoke execute on function public.has_role(uuid, public.app_role) from anon, authenticated, public;
revoke execute on function public.current_employee_id() from anon, authenticated, public;
revoke execute on function public.is_manager_of(uuid) from anon, authenticated, public;
