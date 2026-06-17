import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  currentFinancialYear,
  type MonthlySalesRow,
  type MonthlyTargetRow,
  type PortalEmployee,
} from "@/lib/portal";
import { usePortalUser } from "./usePortalUser";

export function usePortalPerformanceData() {
  const { data: me } = usePortalUser();
  const financialYear = currentFinancialYear();

  return useQuery({
    enabled: !!me,
    queryKey: ["portal-performance", me?.userId, me?.role, financialYear],
    queryFn: async () => {
      const [
        { data: employees, error: employeesError },
        { data: sales, error: salesError },
        { data: targets, error: targetsError },
      ] = await Promise.all([
        supabase
          .from("employees")
          .select(
            "employee_code, employee_name, designation, role, manager_code, hq, state, active, auth_user_id",
          )
          .order("employee_name"),
        supabase
          .from("monthly_sales")
          .select("employee_code, month, financial_year, sales_amount, previous_year_sales")
          .eq("financial_year", financialYear),
        supabase
          .from("monthly_targets")
          .select("employee_code, month, financial_year, target_amount")
          .eq("financial_year", financialYear),
      ]);

      if (employeesError) throw employeesError;
      if (salesError) throw salesError;
      if (targetsError) throw targetsError;

      return {
        financialYear,
        employees: (employees ?? []) as PortalEmployee[],
        sales: (sales ?? []) as MonthlySalesRow[],
        targets: (targets ?? []) as MonthlyTargetRow[],
      };
    },
  });
}
