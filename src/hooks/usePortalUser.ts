import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  isGlobalRole,
  isManagerialRole,
  normalizeRole,
  type PortalEmployee,
  type PortalRole,
} from "@/lib/portal";

export type PortalProfile = {
  auth_user_id: string;
  employee_code: string;
  role: PortalRole;
};

export type PortalUser = {
  userId: string;
  profile: PortalProfile;
  employee: PortalEmployee;
  role: PortalRole;
  isAdmin: boolean;
  isHeadOffice: boolean;
  isManagerial: boolean;
  canManageUsers: boolean;
};

export function useAuthUserId() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return userId;
}

export function usePortalUser() {
  const userId = useAuthUserId();

  return useQuery({
    enabled: !!userId,
    queryKey: ["portal-user", userId],
    queryFn: async (): Promise<PortalUser | null> => {
      if (!userId) return null;

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("auth_user_id, employee_code, role")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) return null;

      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select(
          "employee_code, employee_name, designation, role, manager_code, hq, state, active, auth_user_id",
        )
        .eq("employee_code", profile.employee_code)
        .maybeSingle();

      if (employeeError) throw employeeError;
      if (!employee) return null;

      const role = normalizeRole(profile.role ?? employee.role);

      return {
        userId,
        profile: {
          auth_user_id: profile.auth_user_id,
          employee_code: profile.employee_code,
          role,
        },
        employee,
        role,
        isAdmin: role === "admin",
        isHeadOffice: role === "head_office",
        isManagerial: isManagerialRole(role),
        canManageUsers: isGlobalRole(role),
      };
    },
  });
}
