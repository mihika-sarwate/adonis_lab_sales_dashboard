import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Users, Trophy, TrendingDown } from "lucide-react";
import { usePortalUser } from "@/hooks/usePortalUser";
import { usePortalPerformanceData } from "@/hooks/usePortalPerformance";
import { KpiCard, formatINR, formatPct } from "@/components/portal/KpiCard";
import {
  aggregateByField,
  buildPerformanceRows,
  buildRankings,
  teamSummary,
} from "@/lib/analytics";
import { isManagerialRole, normalizeRole } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team · Pharmaceutical Sales Portal" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: me, isLoading: meLoading } = usePortalUser();
  const { data, isLoading } = usePortalPerformanceData();

  const rows = useMemo(() => {
    if (!data) return [];
    return buildPerformanceRows(data.employees, data.sales, data.targets);
  }, [data]);

  const role = normalizeRole(me?.role ?? me?.employee.role);
  const scopedRows = useMemo(() => {
    if (!me) return [];
    if (!isManagerialRole(role)) return [];
    return rows;
  }, [me, rows, role]);

  if (meLoading || isLoading) return <div className="kpi-card p-6 animate-pulse h-40" />;

  if (!me || !isManagerialRole(role)) {
    return (
      <div className="kpi-card p-6 text-center text-sm text-muted-foreground">
        Only managers, regional leaders, head office, and admins can view the team dashboard.
      </div>
    );
  }

  const summary = teamSummary(scopedRows);
  const rankings = buildRankings(scopedRows);
  const stateRankings = aggregateByField(scopedRows, "state");

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">Team Performance</h1>
        <p className="text-sm text-muted-foreground">
          {me.employee.employee_name} · {scopedRows.length} visible team members
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Team Sales"
          value={formatINR(summary.sales)}
          icon={<Users className="size-4" />}
        />
        <KpiCard
          label="Team Achievement"
          value={formatPct(summary.achievement_pct)}
          icon={<Trophy className="size-4" />}
          accent={
            summary.achievement_pct >= 100
              ? "success"
              : summary.achievement_pct >= 80
                ? "primary"
                : "destructive"
          }
          hint={`Target ${formatINR(summary.target)}`}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RankingList title="Top Performers" rows={rankings.top5} accent="success" />
        <RankingList
          title="Bottom Performers"
          rows={rankings.bottom5}
          accent="destructive"
          icon={<TrendingDown className="size-4" />}
        />
      </section>

      <section className="kpi-card p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          State Snapshot
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stateRankings.slice(0, 6).map((state) => (
            <div key={state.label} className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{state.label}</p>
                <span className="text-sm font-semibold">{formatPct(state.achievement_pct)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatINR(state.sales)} sales against {formatINR(state.target)} target
              </p>
            </div>
          ))}
        </div>
      </section>
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
  rows: ReturnType<typeof buildRankings>["top5"];
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
      {rows.map((row, index) => (
        <div key={row.employee_code} className="px-4 py-3 flex items-center gap-3">
          <span className="size-7 rounded-full bg-muted grid place-items-center text-xs font-semibold text-muted-foreground">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{row.employee_name}</p>
            <p className="text-[11px] text-muted-foreground">{row.employee_code}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{formatPct(row.ytd_achievement_pct)}</p>
            <p className="text-[11px] text-muted-foreground">{formatINR(row.ytd_sales)}</p>
          </div>
          <span
            className={[
              "h-1.5 w-12 rounded-full overflow-hidden",
              accent === "success" ? "bg-success/15" : "bg-destructive/15",
            ].join(" ")}
          >
            <span
              className={[
                "block h-full",
                accent === "success" ? "bg-success" : "bg-destructive",
              ].join(" ")}
              style={{ width: `${Math.min(100, Math.max(2, row.ytd_achievement_pct))}%` }}
            />
          </span>
        </div>
      ))}
    </section>
  );
}
