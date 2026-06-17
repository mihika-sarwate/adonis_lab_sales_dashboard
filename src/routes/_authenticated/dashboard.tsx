import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building,
  CalendarRange,
  Search,
  Shield,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { usePortalUser } from "@/hooks/usePortalUser";
import { usePortalPerformanceData } from "@/hooks/usePortalPerformance";
import { KpiCard, formatINR, formatPct } from "@/components/portal/KpiCard";
import { Input } from "@/components/ui/input";
import {
  aggregateByField,
  buildPerformanceRows,
  buildRankings,
  buildScopeTrend,
} from "@/lib/analytics";
import {
  isGlobalRole,
  isManagerialRole,
  monthLabel,
  normalizeRole,
  performanceStatus,
} from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · Pharmaceutical Sales Portal" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: me, isLoading: meLoading } = usePortalUser();
  const { data, isLoading } = usePortalPerformanceData();
  const [teamSearch, setTeamSearch] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    return buildPerformanceRows(data.employees, data.sales, data.targets);
  }, [data]);

  const meRow = rows.find((row) => row.employee_code === me?.employee.employee_code);
  const role = normalizeRole(me?.role ?? me?.employee.role);

  const scopedRows = useMemo(() => {
    if (!me) return [];
    if (isGlobalRole(role)) return rows;
    if (isManagerialRole(role)) return rows;
    return rows.filter((row) => row.employee_code === me.employee.employee_code);
  }, [me, rows, role]);

  const trend = useMemo(() => {
    if (!data || !me) return [];
    return buildScopeTrend(
      rows.filter((row) => row.employee_code === me.employee.employee_code),
      data.sales,
      data.targets,
    );
  }, [data, me, rows]);

  const rankings = useMemo(() => buildRankings(scopedRows), [scopedRows]);
  const companySummary = useMemo(() => {
    const sales = scopedRows.reduce((sum, row) => sum + row.ytd_sales, 0);
    const target = scopedRows.reduce((sum, row) => sum + row.ytd_target, 0);
    return {
      sales,
      target,
      achievement: target > 0 ? (sales / target) * 100 : 0,
    };
  }, [scopedRows]);

  const chartData = useMemo(() => {
    if (!data || !me) return [];
    return buildScopeTrend(
      rows.filter((row) => row.employee_code === me.employee.employee_code),
      data.sales,
      data.targets,
    ).map((point) => ({
      month: point.label,
      Sales: point.sales,
      Target: point.target,
    }));
  }, [data, me, rows]);

  if (meLoading || isLoading) return <SkeletonGrid />;

  if (!me || !meRow) {
    return (
      <div className="kpi-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No employee profile is linked to this account yet.
        </p>
      </div>
    );
  }

  if (!me.employee.active) {
    return (
      <div className="kpi-card p-6 text-center text-sm text-muted-foreground">
        Your account is inactive. Please contact the admin team.
      </div>
    );
  }

  const currentStatus = performanceStatus(meRow.ytd_achievement_pct || meRow.achievement_pct);
  const underperformingCount = scopedRows.filter((row) => row.ytd_achievement_pct < 80).length;

  if (!isManagerialRole(role)) {
    const gap = meRow.target_gap;
    const warning = meRow.achievement_pct < 80;

    return (
      <div className="space-y-5">
        <section className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight">Performance Portal</h1>
          <p className="text-xs text-muted-foreground">
            {me.employee.employee_name} · {me.employee.employee_code}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <KpiCard
            label="MTD Sales"
            value={formatINR(meRow.current_sales)}
            icon={<Wallet className="size-4" />}
            trend={meRow.growth_pct}
            hint="vs previous year"
          />
          <KpiCard
            label="MTD Target"
            value={formatINR(meRow.current_target)}
            icon={<Target className="size-4" />}
            accent="warning"
            hint={`Gap ${formatINR(gap)}`}
          />
          <KpiCard
            label="Achievement %"
            value={formatPct(meRow.achievement_pct)}
            icon={<Trophy className="size-4" />}
            accent={
              meRow.achievement_pct >= 100
                ? "success"
                : meRow.achievement_pct >= 80
                  ? "primary"
                  : "destructive"
            }
            hint={currentStatus}
          />
          <KpiCard
            label="Growth %"
            value={formatPct(meRow.growth_pct)}
            icon={<TrendingUp className="size-4" />}
            accent={meRow.growth_pct >= 0 ? "success" : "destructive"}
            hint="vs previous year"
          />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <KpiCard
            label="YTD Sales"
            value={formatINR(meRow.ytd_sales)}
            icon={<Activity className="size-4" />}
          />
          <KpiCard
            label="YTD Target"
            value={formatINR(meRow.ytd_target)}
            icon={<CalendarRange className="size-4" />}
            accent="warning"
          />
          <div className="col-span-2">
            <KpiCard
              label="YTD Achievement %"
              value={formatPct(meRow.ytd_achievement_pct)}
              icon={<Trophy className="size-4" />}
              accent={
                meRow.ytd_achievement_pct >= 100
                  ? "success"
                  : meRow.ytd_achievement_pct >= 80
                    ? "primary"
                    : "destructive"
              }
              hint={`${formatINR(meRow.ytd_sales)} of ${formatINR(meRow.ytd_target)}`}
            />
          </div>
        </section>

        {warning && (
          <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive flex gap-3 items-start">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold">Achievement Warning</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                You need {formatINR(gap)} more to reach the current month target.
              </p>
            </div>
          </div>
        )}

        <section className="kpi-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Monthly Sales vs Target
            </h2>
            <span className="text-[11px] text-muted-foreground">
              Current month: {monthLabel(new Date().getMonth() + 1)}
            </span>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10 }}
                  stroke="var(--color-muted-foreground)"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(value: number) =>
                    value >= 100000 ? `${(value / 100000).toFixed(0)}L` : `${value}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(value: number) => formatINR(value)}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="Target"
                  stroke="var(--color-chart-3)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Sales"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    );
  }

  const search = teamSearch.trim().toLowerCase();
  const filteredRows = scopedRows.filter((row) => {
    if (!search) return true;
    return (
      row.employee_name.toLowerCase().includes(search) ||
      row.employee_code.toLowerCase().includes(search) ||
      (row.hq ?? "").toLowerCase().includes(search) ||
      (row.state ?? "").toLowerCase().includes(search)
    );
  });

  const stateRankings = isGlobalRole(role) ? aggregateByField(rows, "state") : [];
  const hqRankings = isGlobalRole(role) ? aggregateByField(rows, "hq") : [];
  const managerRankings = isGlobalRole(role) ? aggregateByField(rows, "manager_code") : [];

  return (
    <div className="space-y-5">
      <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {isGlobalRole(role) ? "Organization Performance" : "Team Overview"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {me.employee.employee_name} · {me.employee.employee_code} ·{" "}
            {me.employee.designation ?? "Field Force"}
          </p>
        </div>
        {me.canManageUsers && (
          <Link
            to="/data"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-xs font-semibold text-foreground hover:bg-accent transition"
          >
            <Shield className="size-4 text-primary" />
            Admin Panel
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </section>

      <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 flex gap-3 items-start">
        <Building className="size-5 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold">Performance snapshot</p>
          <p className="text-[11px] opacity-90 mt-0.5">
            {isGlobalRole(role)
              ? `Company achievement is ${companySummary.achievement.toFixed(1)}% with ${underperformingCount} employees under 80%.`
              : `Your visible team achievement is ${companySummary.achievement.toFixed(1)}% with ${underperformingCount} members under 80%.`}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label={isGlobalRole(role) ? "Company Sales" : "Team Sales"}
          value={formatINR(companySummary.sales)}
          icon={<Wallet className="size-4" />}
        />
        <KpiCard
          label={isGlobalRole(role) ? "Company Target" : "Team Target"}
          value={formatINR(companySummary.target)}
          icon={<Target className="size-4" />}
          accent="warning"
        />
        <KpiCard
          label={isGlobalRole(role) ? "Company Achievement" : "Team Achievement"}
          value={formatPct(companySummary.achievement)}
          icon={<Trophy className="size-4" />}
          accent={companySummary.achievement >= 80 ? "success" : "destructive"}
        />
        <KpiCard
          label="Visible Members"
          value={String(scopedRows.length)}
          icon={<Users className="size-4" />}
          accent="primary"
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="kpi-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isGlobalRole(role) ? "State-wise Performance" : "Monthly Trend"}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {isGlobalRole(role) ? "Top 8" : "YTD"}
            </span>
          </div>

          {isGlobalRole(role) ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stateRankings.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9 }}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tick={{ fontSize: 9 }}
                    stroke="var(--color-muted-foreground)"
                    width={80}
                  />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Bar
                    dataKey="achievement_pct"
                    fill="var(--color-chart-1)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="var(--color-chart-3)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="kpi-card p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500">
            Top Performers
          </h3>
          <div className="divide-y text-xs">
            {rankings.top5.map((row, index) => (
              <div key={row.employee_code} className="py-2.5 flex justify-between">
                <span>
                  {index + 1}. {row.employee_name} ({row.employee_code})
                </span>
                <span className="font-semibold text-emerald-500">
                  {formatPct(row.ytd_achievement_pct)}
                </span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t">
            <h3 className="text-xs font-bold uppercase tracking-wider text-destructive">
              Bottom Performers
            </h3>
            <div className="divide-y text-xs mt-1">
              {rankings.bottom5.map((row, index) => (
                <div key={row.employee_code} className="py-2.5 flex justify-between">
                  <span>
                    {index + 1}. {row.employee_name} ({row.employee_code})
                  </span>
                  <span className="font-semibold text-destructive">
                    {formatPct(row.ytd_achievement_pct)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {isGlobalRole(role) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="Best State"
            value={stateRankings[0]?.label ?? "N/A"}
            hint={formatPct(stateRankings[0]?.achievement_pct ?? 0)}
          />
          <KpiCard
            label="Best HQ"
            value={hqRankings[0]?.label ?? "N/A"}
            hint={formatPct(hqRankings[0]?.achievement_pct ?? 0)}
          />
          <KpiCard
            label="Best Manager"
            value={managerRankings[0]?.label ?? "N/A"}
            hint={formatPct(managerRankings[0]?.achievement_pct ?? 0)}
          />
        </div>
      )}

      <section className="kpi-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {isGlobalRole(role) ? "Organization Ranking" : "Team Ranking"}
          </h2>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={teamSearch}
              onChange={(event) => setTeamSearch(event.target.value)}
              className="pl-8 h-8 text-xs bg-secondary"
            />
          </div>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary text-muted-foreground font-semibold border-b">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Name</th>
                <th className="p-3">HQ</th>
                <th className="p-3">State</th>
                <th className="p-3 text-right">Sales</th>
                <th className="p-3 text-right">Target</th>
                <th className="p-3 text-right">Ach %</th>
                <th className="p-3 text-right">Growth %</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRows.map((row) => (
                <tr key={row.employee_code} className="hover:bg-accent/5">
                  <td className="p-3 font-medium">{row.employee_code}</td>
                  <td className="p-3">{row.employee_name}</td>
                  <td className="p-3">{row.hq ?? "N/A"}</td>
                  <td className="p-3">{row.state ?? "N/A"}</td>
                  <td className="p-3 text-right">{formatINR(row.ytd_sales)}</td>
                  <td className="p-3 text-right">{formatINR(row.ytd_target)}</td>
                  <td className="p-3 text-right font-semibold">
                    {formatPct(row.ytd_achievement_pct)}
                  </td>
                  <td className="p-3 text-right">{formatPct(row.growth_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="kpi-card p-4 h-28 animate-pulse" />
      ))}
    </div>
  );
}
