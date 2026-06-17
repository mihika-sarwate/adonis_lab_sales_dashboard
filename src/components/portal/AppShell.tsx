import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Database,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Shield,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser } from "@/hooks/usePortalUser";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = usePortalUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(me?.isManagerial ? [{ to: "/team", label: "Team", icon: Users }] : []),
    { to: "/assistant", label: "Assistant", icon: Sparkles },
    ...(me?.canManageUsers ? [{ to: "/data", label: "Admin", icon: Database }] : []),
  ] as const;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleLabel = me?.role
    ? me.role
        .split("_")
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join(" ")
    : "Member";

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <div className="size-9 rounded-xl brand-gradient grid place-items-center text-primary-foreground shadow-soft">
            <Activity className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground leading-none">
              Pharmaceutical Sales Performance
            </p>
            <p className="text-sm font-semibold truncate">
              {me?.employee.employee_name ?? "Welcome"}{" "}
              <span className="text-muted-foreground font-normal">
                · {me?.employee.employee_code ?? ""}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>

        <nav className="hidden md:flex mx-auto max-w-5xl px-4 pb-2 gap-1">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                ].join(" ")}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 w-full mx-auto max-w-5xl px-4 py-4">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-card">
        <div className={`grid ${nav.length >= 4 ? "grid-cols-4" : "grid-cols-3"}`}>
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]",
                  active ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
