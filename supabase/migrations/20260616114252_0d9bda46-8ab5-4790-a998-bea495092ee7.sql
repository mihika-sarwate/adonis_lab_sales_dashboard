
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.is_manager_of(uuid) to authenticated;
