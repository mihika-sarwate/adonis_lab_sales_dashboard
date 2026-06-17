import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser } from "@/hooks/usePortalUser";
import { KpiCard, formatINR, formatPct } from "@/components/portal/KpiCard";
import { Users, Trophy, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team · Sales Performance" }] }),
  component: TeamPage,
});

type Row = {
  empId: string;
  name: string;
  code: string;
  ytdSales: number;
  ytdTarget: number;
  ach: number;
};

function TeamPage() {
  const { data: me } = usePortalUser();
  const year = new Date().getFullYear();
  const myId = me?.employee.id;

  const { data, isLoading } = useQuery({
    enabled: !!myId && !!me?.isManager,
    queryKey: ["team", myId, year],
    queryFn: async () => {
      const { data: teamData } = await supabase
        .from("employees")
        .select("id, employee_id, name")
        .eq("manager_id", myId!);
      const team = teamData ?? [];
      const ids = team.map((t) => t.id);
      if (!ids.length) return { rows: [] as Row[] };
      const [{ data: tg = [] }, { data: ts = [] }] = await Promise.all([
        supabase.from("monthly_targets").select("employee_id, target_amount").in("employee_id", ids).eq("year", year),
        supabase.from("monthly_sales").select("employee_id, sales_amount").in("employee_id", ids).eq("year", year),
      ]);
      const num = (v: unknown) => (typeof v === "string" ? parseFloat(v) : (v as number)) || 0;
      const rows: Row[] = team.map((e) => {
        const ytdSales = (ts as Array<{ employee_id: string; sales_amount: number }>)
          .filter((s) => s.employee_id === e.id)
          .reduce((a, b) => a + num(b.sales_amount), 0);
        const ytdTarget = (tg as Array<{ employee_id: string; target_amount: number }>)
          .filter((t) => t.employee_id === e.id)
          .reduce((a, b) => a + num(b.target_amount), 0);
        const ach = ytdTarget > 0 ? (ytdSales / ytdTarget) * 100 : 0;
        return { empId: e.id, code: e.employee_id, name: e.name, ytdSales, ytdTarget, ach };
      });
      rows.sort((a, b) => b.ach - a.ach);
      return { rows };
    },
  });

  if (me && !me.isManager) {
    return (
      <div className="kpi-card p-6 text-center text-sm text-muted-foreground">
        Only managers can view the team dashboard.
      </div>
    );
  }

  if (isLoading || !data) return <div className="kpi-card p-6 animate-pulse h-40" />;

  const rows = data.rows;
  const teamSales = rows.reduce((a, r) => a + r.ytdSales, 0);
  const teamTarget = rows.reduce((a, r) => a + r.ytdTarget, 0);
  const teamAch = teamTarget > 0 ? (teamSales / teamTarget) * 100 : 0;
  const top10 = rows.slice(0, 10);
  const bottom10 = [...rows].reverse().slice(0, 10);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">Team Performance</h1>
        <p className="text-sm text-muted-foreground">YTD · {rows.length} team members</p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <KpiCard label="Team Sales (YTD)" value={formatINR(teamSales)} icon={<Users className="size-4" />} />
        <KpiCard
          label="Team Achievement"
          value={formatPct(teamAch)}
          icon={<Trophy className="size-4" />}
          accent={teamAch >= 100 ? "success" : teamAch >= 80 ? "primary" : "destructive"}
          hint={`Target ${formatINR(teamTarget)}`}
        />
      </section>

      <RankingList title="Top Performers" rows={top10} accent="success" />
      <RankingList title="Bottom Performers" rows={bottom10} accent="destructive" icon={<TrendingDown className="size-4" />} />
    </div>
  );
}

function RankingList({
  title,
  rows,
  accent,
  icon,
}: {
  title: string;
  rows: Row[];
  accent: "success" | "destructive";
  icon?: React.ReactNode;
}) {
  if (!rows.length) {
    return (
      <section className="kpi-card p-5 text-sm text-muted-foreground">
        <h2 className="text-sm font-semibold mb-1 text-foreground">{title}</h2>
        No data yet.
      </section>
    );
  }
  return (
    <section className="kpi-card divide-y">
      <div className="p-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {icon ?? <Trophy className="size-4 text-muted-foreground" />}
      </div>
      {rows.map((r, i) => (
        <div key={r.empId} className="px-4 py-3 flex items-center gap-3">
          <span className="size-7 rounded-full bg-muted grid place-items-center text-xs font-semibold text-muted-foreground">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{r.name}</p>
            <p className="text-[11px] text-muted-foreground">{r.code}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{formatPct(r.ach)}</p>
            <p className="text-[11px] text-muted-foreground">{formatINR(r.ytdSales)}</p>
          </div>
          <span
            className={[
              "h-1.5 w-12 rounded-full overflow-hidden",
              accent === "success" ? "bg-success/15" : "bg-destructive/15",
            ].join(" ")}
          >
            <span
              className={["block h-full", accent === "success" ? "bg-success" : "bg-destructive"].join(" ")}
              style={{ width: `${Math.min(100, Math.max(2, r.ach))}%` }}
            />
          </span>
        </div>
      ))}
    </section>
  );
}
