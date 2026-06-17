-- Migration: Update schema for Adonis Sales Performance Portal
-- Alters employees to make user_id nullable and adds role, state, hq, designation, status columns.
-- Adds previous_year_sales to monthly_sales.

ALTER TABLE public.employees ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS hq text,
ADD COLUMN IF NOT EXISTS designation text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS role text DEFAULT 'be_mr';

ALTER TABLE public.monthly_sales
ADD COLUMN IF NOT EXISTS previous_year_sales numeric(14,2) DEFAULT 0;

-- Recreate functions and roles support
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.employees 
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Allow execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated;

-- Update RLS on employees
DROP POLICY IF EXISTS "view own or team employees" ON public.employees;
DROP POLICY IF EXISTS "managers visible to lookup" ON public.employees;
DROP POLICY IF EXISTS "insert own employee row" ON public.employees;
DROP POLICY IF EXISTS "update own employee row" ON public.employees;

CREATE POLICY "employees_select_policy" ON public.employees FOR SELECT TO authenticated
USING (
  -- Admin and Management can view all employees
  EXISTS (
    SELECT 1 FROM public.employees me
    WHERE me.user_id = auth.uid() AND (me.role = 'admin' OR me.role = 'management')
  )
  OR user_id = auth.uid()
  OR id = public.current_employee_id()
  OR manager_id = public.current_employee_id()
);

CREATE POLICY "employees_insert_policy" ON public.employees FOR INSERT TO authenticated
WITH CHECK (
  -- Allow users to insert during signup if linking by user_id
  user_id = auth.uid() 
  -- Or if Admin
  OR EXISTS (
    SELECT 1 FROM public.employees me
    WHERE me.user_id = auth.uid() AND me.role = 'admin'
  )
);

CREATE POLICY "employees_update_policy" ON public.employees FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.employees me
    WHERE me.user_id = auth.uid() AND me.role = 'admin'
  )
);

CREATE POLICY "employees_delete_policy" ON public.employees FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees me
    WHERE me.user_id = auth.uid() AND me.role = 'admin'
  )
);

-- Update RLS on targets
DROP POLICY IF EXISTS "view own or team targets" ON public.monthly_targets;
DROP POLICY IF EXISTS "insert own or team targets" ON public.monthly_targets;
DROP POLICY IF EXISTS "update own or team targets" ON public.monthly_targets;
DROP POLICY IF EXISTS "delete own or team targets" ON public.monthly_targets;

CREATE POLICY "targets_select_policy" ON public.monthly_targets FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees me
    WHERE me.user_id = auth.uid() AND (me.role = 'admin' OR me.role = 'management')
  )
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);

CREATE POLICY "targets_write_policy" ON public.monthly_targets FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees me
    WHERE me.user_id = auth.uid() AND me.role = 'admin'
  )
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);

-- Update RLS on sales
DROP POLICY IF EXISTS "view own or team sales" ON public.monthly_sales;
DROP POLICY IF EXISTS "insert own or team sales" ON public.monthly_sales;
DROP POLICY IF EXISTS "update own or team sales" ON public.monthly_sales;
DROP POLICY IF EXISTS "delete own or team sales" ON public.monthly_sales;

CREATE POLICY "sales_select_policy" ON public.monthly_sales FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees me
    WHERE me.user_id = auth.uid() AND (me.role = 'admin' OR me.role = 'management')
  )
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);

CREATE POLICY "sales_write_policy" ON public.monthly_sales FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees me
    WHERE me.user_id = auth.uid() AND me.role = 'admin'
  )
  OR employee_id = public.current_employee_id()
  OR public.is_manager_of(employee_id)
);
