
-- Roles enum & table
create type public.app_role as enum ('employee', 'manager');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "users insert own roles" on public.user_roles for insert to authenticated with check (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

-- Employees
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  employee_id text not null unique,
  name text not null,
  manager_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.employees to authenticated;
grant all on public.employees to service_role;
alter table public.employees enable row level security;

create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_manager_of(_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.employees e
    where e.id = _employee_id
      and e.manager_id = public.current_employee_id()
  );
$$;

create policy "view own or team employees" on public.employees for select to authenticated
using (
  user_id = auth.uid()
  or manager_id = public.current_employee_id()
  or id = public.current_employee_id()
);

-- Allow lookup of a manager record by employee_id during signup (so new employees can choose a manager)
create policy "managers visible to lookup" on public.employees for select to authenticated
using (public.has_role(user_id, 'manager'));

create policy "insert own employee row" on public.employees for insert to authenticated with check (user_id = auth.uid());
create policy "update own employee row" on public.employees for update to authenticated using (user_id = auth.uid());

-- Monthly targets
create table public.monthly_targets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  target_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, year, month)
);
grant select, insert, update, delete on public.monthly_targets to authenticated;
grant all on public.monthly_targets to service_role;
alter table public.monthly_targets enable row level security;

create policy "view own or team targets" on public.monthly_targets for select to authenticated
using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id));
create policy "insert own or team targets" on public.monthly_targets for insert to authenticated
with check (employee_id = public.current_employee_id() or public.is_manager_of(employee_id));
create policy "update own or team targets" on public.monthly_targets for update to authenticated
using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id));
create policy "delete own or team targets" on public.monthly_targets for delete to authenticated
using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id));

-- Monthly sales
create table public.monthly_sales (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  sales_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, year, month)
);
grant select, insert, update, delete on public.monthly_sales to authenticated;
grant all on public.monthly_sales to service_role;
alter table public.monthly_sales enable row level security;

create policy "view own or team sales" on public.monthly_sales for select to authenticated
using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id));
create policy "insert own or team sales" on public.monthly_sales for insert to authenticated
with check (employee_id = public.current_employee_id() or public.is_manager_of(employee_id));
create policy "update own or team sales" on public.monthly_sales for update to authenticated
using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id));
create policy "delete own or team sales" on public.monthly_sales for delete to authenticated
using (employee_id = public.current_employee_id() or public.is_manager_of(employee_id));

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_targets_updated before update on public.monthly_targets
for each row execute function public.set_updated_at();
create trigger trg_sales_updated before update on public.monthly_sales
for each row execute function public.set_updated_at();
