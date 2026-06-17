import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PortalUser = {
  userId: string;
  employee: {
    id: string;
    employee_id: string;
    name: string;
    manager_id: string | null;
    hq: string | null;
    designation: string | null;
    state: string | null;
    status: string | null;
    role: string | null;
  };
  isManager: boolean;
  isAdmin: boolean;
  isManagement: boolean;
};

export function useAuthUserId() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
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
      const { data: emp, error } = await supabase
        .from("employees")
        .select("id, employee_id, name, manager_id, hq, designation, state, status, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!emp) return null;

      const role = emp.role || "be_mr";
      const isManager = role === "manager" || role === "admin" || role === "management";
      const isAdmin = role === "admin";
      const isManagement = role === "management";

      return {
        userId,
        employee: emp,
        isManager,
        isAdmin,
        isManagement,
      };
    },
  });
}
