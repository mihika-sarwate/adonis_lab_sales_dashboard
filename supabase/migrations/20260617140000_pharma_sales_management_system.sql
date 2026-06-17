-- Pharmaceutical Sales Performance Management System
-- New canonical schema, hierarchy helpers, RLS, and storage access.

create extension if not exists pgcrypto;

alter table if exists public.employees
  add column if not exists employee_code text,
  add column if not exists employee_name text,
  add column if not exists manager_code text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.monthly_sales
  add column if not exists employee_code text,
  add column if not exists financial_year text,
  add column if not exists previous_year_sales numeric(14,2) not null default 0;

alter table if exists public.monthly_targets
  add column if not exists employee_code text,
  add column if not exists financial_year text;

create table if not exists public.user_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  employee_code text not null unique,
  role text not null default 'representative' check (role in ('admin', 'head_office', 'zsm', 'rsm', 'manager', 'representative')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imports_log (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references auth.users(id) on delete set null,
  employee_code text,
  import_type text not null check (import_type in ('employees', 'sales', 'targets')),
  source_file_name text,
  storage_path text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'completed_with_errors', 'failed')),
  total_rows integer not null default 0,
  inserted_rows integer not null default 0,
  updated_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  error_rows integer not null default 0,
  preview jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employees_employee_code_idx on public.employees(employee_code);
create index if not exists employees_manager_code_idx on public.employees(manager_code);
create index if not exists employees_role_idx on public.employees(role);
create index if not exists monthly_sales_employee_year_month_idx on public.monthly_sales(employee_code, financial_year, month);
create index if not exists monthly_targets_employee_year_month_idx on public.monthly_targets(employee_code, financial_year, month);
create index if not exists user_profiles_employee_code_idx on public.user_profiles(employee_code);
create index if not exists imports_log_type_created_at_idx on public.imports_log(import_type, created_at desc);

create or replace function public.normalize_portal_role(_role text)
returns text
language sql
stable
as $$
  select case lower(coalesce(_role, 'representative'))
    when 'admin' then 'admin'
    when 'head_office' then 'head_office'
    when 'head office' then 'head_office'
    when 'management' then 'head_office'
    when 'zsm' then 'zsm'
    when 'rsm' then 'rsm'
    when 'manager' then 'manager'
    when 'be_mr' then 'representative'
    when 'be' then 'representative'
    when 'mr' then 'representative'
    when 'rep' then 'representative'
    when 'representative' then 'representative'
    else 'representative'
  end;
$$;

create or replace function public.current_employee_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select up.employee_code from public.user_profiles up where up.auth_user_id = auth.uid() limit 1),
    (select e.employee_code from public.employees e where e.auth_user_id = auth.uid() limit 1)
  );
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.normalize_portal_role(
    coalesce(
      (select up.role from public.user_profiles up where up.auth_user_id = auth.uid() limit 1),
      (select e.role from public.employees e where e.auth_user_id = auth.uid() limit 1),
      'representative'
    )
  );
$$;

create or replace function public.is_global_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() in ('admin', 'head_office');
$$;

create or replace function public.accessible_employee_codes()
returns table(employee_code text)
language sql
stable
security definer
set search_path = public
as $$
  with recursive scope as (
    select e.employee_code, e.manager_code, public.normalize_portal_role(coalesce(up.role, e.role, 'representative')) as role
    from public.employees e
    left join public.user_profiles up on up.employee_code = e.employee_code
    where e.employee_code = public.current_employee_code()
    union all
    select child.employee_code, child.manager_code, public.normalize_portal_role(coalesce(up.role, child.role, 'representative')) as role
    from public.employees child
    left join public.user_profiles up on up.employee_code = child.employee_code
    join scope on child.manager_code = scope.employee_code
  )
  select distinct scope.employee_code
  from scope
  union
  select e.employee_code
  from public.employees e
  where public.is_global_access();
$$;

create or replace function public.can_access_employee(_employee_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_global_access()
    or _employee_code = public.current_employee_code()
    or exists (
      select 1
      from public.accessible_employee_codes() a
      where a.employee_code = _employee_code
    );
$$;

create or replace function public.is_managerial_role(_role text)
returns boolean
language sql
stable
as $$
  select public.normalize_portal_role(_role) in ('admin', 'head_office', 'zsm', 'rsm', 'manager');
$$;

create or replace function public.fiscal_year_from_month(_year int, _month int)
returns text
language sql
stable
as $$
  select case
    when _month >= 4 then _year::text || '-' || right((_year + 1)::text, 2)
    else (_year - 1)::text || '-' || right(_year::text, 2)
  end;
$$;

create or replace function public.lookup_signup_employee(_employee_code text)
returns table(
  employee_code text,
  employee_name text,
  designation text,
  role text,
  manager_code text,
  hq text,
  state text,
  active boolean,
  auth_user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.employee_code,
    e.employee_name,
    e.designation,
    public.normalize_portal_role(coalesce(e.role, 'representative')) as role,
    e.manager_code,
    e.hq,
    e.state,
    e.active,
    e.auth_user_id
  from public.employees e
  where upper(e.employee_code) = upper(_employee_code)
  limit 1;
$$;

create or replace function public.claim_employee_account(_employee_code text, _role text default null)
returns table(auth_user_id uuid, employee_code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_employee public.employees%rowtype;
  v_role text := public.normalize_portal_role(coalesce(_role, 'representative'));
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_employee
  from public.employees e
  where upper(e.employee_code) = upper(_employee_code)
  limit 1;

  if not found then
    raise exception 'Employee code not found';
  end if;

  if not coalesce(v_employee.active, true) then
    raise exception 'Employee account is inactive';
  end if;

  if v_employee.auth_user_id is not null and v_employee.auth_user_id <> v_user_id then
    raise exception 'Employee account has already been claimed';
  end if;

  if exists (
    select 1
    from public.user_profiles up
    where up.auth_user_id = v_user_id
      and upper(up.employee_code) <> upper(v_employee.employee_code)
  ) then
    raise exception 'This authenticated account is already linked to a different employee code';
  end if;

  if lower(coalesce((auth.jwt() ->> 'email'), '')) <> lower(v_employee.employee_code || '@portal.app') then
    raise exception 'Authenticated email does not match the employee code';
  end if;

  insert into public.user_profiles (auth_user_id, employee_code, role)
  values (v_user_id, v_employee.employee_code, v_role)
  on conflict (auth_user_id)
  do update set employee_code = excluded.employee_code, role = excluded.role, updated_at = now();

  update public.employees
  set auth_user_id = v_user_id,
      role = public.normalize_portal_role(coalesce(v_employee.role, v_role))
  where employee_code = v_employee.employee_code;

  auth_user_id := v_user_id;
  employee_code := v_employee.employee_code;
  role := public.normalize_portal_role(coalesce(v_employee.role, v_role));
  return next;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_employee_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.employee_code := upper(coalesce(new.employee_code, new.employee_id));
  new.employee_name := coalesce(new.employee_name, new.name);
  new.manager_code := coalesce(new.manager_code, (
    select m.employee_code
    from public.employees m
    where m.id = new.manager_id
    limit 1
  ));
  new.role := public.normalize_portal_role(coalesce(new.role, 'representative'));
  new.active := coalesce(new.active, (case when lower(coalesce(new.status, 'active')) = 'inactive' then false else true end));
  if new.auth_user_id is null and new.user_id is not null then
    new.auth_user_id := new.user_id;
  end if;
  return new;
end;
$$;

create or replace function public.sync_sales_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.employee_code := upper(coalesce(new.employee_code, (
    select e.employee_code from public.employees e where e.id = new.employee_id limit 1
  )));
  new.financial_year := coalesce(new.financial_year, public.fiscal_year_from_month(coalesce(new.year, extract(year from current_date)::int), coalesce(new.month, extract(month from current_date)::int)));
  new.previous_year_sales := coalesce(new.previous_year_sales, 0);
  return new;
end;
$$;

create or replace function public.sync_target_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.employee_code := upper(coalesce(new.employee_code, (
    select e.employee_code from public.employees e where e.id = new.employee_id limit 1
  )));
  new.financial_year := coalesce(new.financial_year, public.fiscal_year_from_month(coalesce(new.year, extract(year from current_date)::int), coalesce(new.month, extract(month from current_date)::int)));
  return new;
end;
$$;

update public.employees
set
  employee_code = upper(coalesce(employee_code, employee_id)),
  employee_name = coalesce(employee_name, name),
  manager_code = coalesce(manager_code, (
    select m.employee_id
    from public.employees m
    where m.id = public.employees.manager_id
    limit 1
  )),
  auth_user_id = coalesce(auth_user_id, user_id),
  active = coalesce(active, case when lower(coalesce(status, 'active')) = 'inactive' then false else true end),
  role = public.normalize_portal_role(coalesce(role, 'representative'));

update public.monthly_sales
set
  employee_code = upper(coalesce(employee_code, (
    select e.employee_id from public.employees e where e.id = monthly_sales.employee_id limit 1
  ))),
  financial_year = coalesce(financial_year, public.fiscal_year_from_month(coalesce(year, extract(year from current_date)::int), month)),
  previous_year_sales = coalesce(previous_year_sales, 0);

update public.monthly_targets
set
  employee_code = upper(coalesce(employee_code, (
    select e.employee_id from public.employees e where e.id = monthly_targets.employee_id limit 1
  ))),
  financial_year = coalesce(financial_year, public.fiscal_year_from_month(coalesce(year, extract(year from current_date)::int), month));

alter table public.employees
  alter column employee_code set not null,
  alter column employee_name set not null,
  alter column role set default 'representative',
  alter column active set default true;

alter table public.monthly_sales
  alter column employee_code set not null,
  alter column financial_year set not null;

alter table public.monthly_targets
  alter column employee_code set not null,
  alter column financial_year set not null;

alter table public.employees
  drop constraint if exists employees_employee_code_key;

alter table public.employees
  add constraint employees_employee_code_key unique (employee_code);

alter table public.employees
  add constraint employees_manager_code_fkey foreign key (manager_code) references public.employees(employee_code) on delete set null;

alter table public.monthly_sales
  add constraint monthly_sales_employee_code_fkey foreign key (employee_code) references public.employees(employee_code) on delete cascade;

alter table public.monthly_targets
  add constraint monthly_targets_employee_code_fkey foreign key (employee_code) references public.employees(employee_code) on delete cascade;

alter table public.user_profiles
  drop constraint if exists user_profiles_employee_code_key;

alter table public.user_profiles
  add constraint user_profiles_employee_code_key unique (employee_code);

alter table public.user_profiles
  add constraint user_profiles_employee_code_fkey foreign key (employee_code) references public.employees(employee_code) on delete cascade;

alter table public.imports_log
  add constraint imports_log_employee_code_fkey foreign key (employee_code) references public.employees(employee_code) on delete set null;

create unique index if not exists monthly_sales_unique_scope_idx
  on public.monthly_sales(employee_code, financial_year, month);

create unique index if not exists monthly_targets_unique_scope_idx
  on public.monthly_targets(employee_code, financial_year, month);

drop trigger if exists trg_employees_updated on public.employees;
create trigger trg_employees_updated
before update on public.employees
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_imports_log_updated on public.imports_log;
create trigger trg_imports_log_updated
before update on public.imports_log
for each row execute function public.set_updated_at();

drop trigger if exists trg_employees_sync on public.employees;
create trigger trg_employees_sync
before insert or update on public.employees
for each row execute function public.sync_employee_fields();

drop trigger if exists trg_sales_sync on public.monthly_sales;
create trigger trg_sales_sync
before insert or update on public.monthly_sales
for each row execute function public.sync_sales_fields();

drop trigger if exists trg_targets_sync on public.monthly_targets;
create trigger trg_targets_sync
before insert or update on public.monthly_targets
for each row execute function public.sync_target_fields();

alter table public.employees enable row level security;
alter table public.monthly_sales enable row level security;
alter table public.monthly_targets enable row level security;
alter table public.user_profiles enable row level security;
alter table public.imports_log enable row level security;

drop policy if exists employees_select_policy on public.employees;
drop policy if exists employees_insert_policy on public.employees;
drop policy if exists employees_update_policy on public.employees;
drop policy if exists employees_delete_policy on public.employees;

create policy employees_select_policy
on public.employees
for select
to authenticated
using (public.can_access_employee(employee_code));

create policy employees_admin_write_policy
on public.employees
for all
to authenticated
using (public.is_global_access())
with check (public.is_global_access());

drop policy if exists sales_select_policy on public.monthly_sales;
drop policy if exists sales_write_policy on public.monthly_sales;

create policy sales_select_policy
on public.monthly_sales
for select
to authenticated
using (public.can_access_employee(employee_code));

create policy sales_admin_write_policy
on public.monthly_sales
for all
to authenticated
using (public.is_global_access())
with check (public.is_global_access());

drop policy if exists targets_select_policy on public.monthly_targets;
drop policy if exists targets_write_policy on public.monthly_targets;

create policy targets_select_policy
on public.monthly_targets
for select
to authenticated
using (public.can_access_employee(employee_code));

create policy targets_admin_write_policy
on public.monthly_targets
for all
to authenticated
using (public.is_global_access())
with check (public.is_global_access());

create policy user_profiles_select_own_or_admin
on public.user_profiles
for select
to authenticated
using (auth_user_id = auth.uid() or public.is_global_access());

create policy user_profiles_delete_admin
on public.user_profiles
for delete
to authenticated
using (public.is_global_access());

create policy imports_log_select_admin
on public.imports_log
for select
to authenticated
using (public.is_global_access());

create policy imports_log_write_admin
on public.imports_log
for insert
to authenticated
with check (public.is_global_access());

create policy imports_log_update_admin
on public.imports_log
for update
to authenticated
using (public.is_global_access())
with check (public.is_global_access());

create policy imports_log_delete_admin
on public.imports_log
for delete
to authenticated
using (public.is_global_access());

do $$
begin
  insert into storage.buckets (id, name, public)
  values ('imports', 'imports', false)
  on conflict (id) do nothing;
exception
  when undefined_table then
    null;
end $$;

do $$
begin
  execute $policy$
    create policy "imports bucket read"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'imports'
      and (owner = auth.uid() or public.is_global_access())
    )
  $policy$;
exception
  when duplicate_object then
    null;
  when undefined_table then
    null;
end $$;

do $$
begin
  execute $policy$
    create policy "imports bucket write"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'imports'
      and (owner = auth.uid() or public.is_global_access())
    )
  $policy$;
exception
  when duplicate_object then
    null;
  when undefined_table then
    null;
end $$;

do $$
begin
  execute $policy$
    create policy "imports bucket update"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'imports'
      and (owner = auth.uid() or public.is_global_access())
    )
    with check (
      bucket_id = 'imports'
      and (owner = auth.uid() or public.is_global_access())
    )
  $policy$;
exception
  when duplicate_object then
    null;
  when undefined_table then
    null;
end $$;

do $$
begin
  execute $policy$
    create policy "imports bucket delete"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'imports'
      and (owner = auth.uid() or public.is_global_access())
    )
  $policy$;
exception
  when duplicate_object then
    null;
  when undefined_table then
    null;
end $$;

grant execute on function public.normalize_portal_role(text) to authenticated;
grant execute on function public.current_employee_code() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_global_access() to authenticated;
grant execute on function public.accessible_employee_codes() to authenticated;
grant execute on function public.can_access_employee(text) to authenticated;
grant execute on function public.is_managerial_role(text) to authenticated;
grant execute on function public.fiscal_year_from_month(int, int) to authenticated;
grant execute on function public.lookup_signup_employee(text) to anon, authenticated;
grant execute on function public.claim_employee_account(text, text) to authenticated;
