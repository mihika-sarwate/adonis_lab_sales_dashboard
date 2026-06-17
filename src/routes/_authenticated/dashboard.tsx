import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser } from "@/hooks/usePortalUser";
import { KpiCard, formatINR, formatPct } from "@/components/portal/KpiCard";
import {
  Target,
  TrendingUp,
  Wallet,
  CalendarRange,
  Trophy,
  Activity,
  Users,
  Search,
  ArrowUpDown,
  Building,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  Shield,
  FileSpreadsheet
} from "lucide-react";
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
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · Sales Performance Portal" }],
  }),
  component: DashboardPage,
});

const MONTHS_FISCAL = [
  { name: "Apr", m: 4 },
  { name: "May", m: 5 },
  { name: "Jun", m: 6 },
  { name: "Jul", m: 7 },
  { name: "Aug", m: 8 },
  { name: "Sep", m: 9 },
  { name: "Oct", m: 10 },
  { name: "Nov", m: 11 },
  { name: "Dec", m: 12 },
  { name: "Jan", m: 1 },
  { name: "Feb", m: 2 },
  { name: "Mar", m: 3 },
];

function isMonthInYtd(m: number, currentMonth: number): boolean {
  if (currentMonth >= 4) {
    return m >= 4 && m <= currentMonth;
  } else {
    return m >= 4 || m <= currentMonth;
  }
}

function num(v: unknown) {
  return (typeof v === "string" ? parseFloat(v) : (v as number)) || 0;
}

function DashboardPage() {
  const { data: me, isLoading: meLoading } = usePortalUser();
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1; // 1-12

  // Filters for Manager table
  const [teamSearch, setTeamSearch] = useState("");
  const [teamSort, setTeamSort] = useState<"name" | "ach" | "growth">("ach");
  const [teamSortDir, setTeamSortDir] = useState<"asc" | "desc">("desc");

  const empId = me?.employee.id;
  const userRole = me?.employee.role || "be_mr";

  // Fetch all required data dynamically based on user role
  const { data, isLoading } = useQuery({
    enabled: !!empId,
    queryKey: ["dashboard-data", empId, userRole, year, month],
    queryFn: async () => {
      let employeesList: any[] = [];
      let salesList: any[] = [];
      let targetsList: any[] = [];

      if (userRole === "admin" || userRole === "management") {
        // Fetch all data
        const [empRes, salesRes, targetRes] = await Promise.all([
          supabase.from("employees").select("*"),
          supabase.from("monthly_sales").select("*").eq("year", year),
          supabase.from("monthly_targets").select("*").eq("year", year),
        ]);
        employeesList = empRes.data || [];
        salesList = salesRes.data || [];
        targetsList = targetRes.data || [];
      } else if (userRole === "manager") {
        // Fetch reports + self
        const { data: reports } = await supabase
          .from("employees")
          .select("*")
          .or(`manager_id.eq.${empId},id.eq.${empId}`);
        employeesList = reports || [];
        const empIds = employeesList.map((e) => e.id);

        if (empIds.length > 0) {
          const [salesRes, targetRes] = await Promise.all([
            supabase.from("monthly_sales").select("*").in("employee_id", empIds).eq("year", year),
            supabase.from("monthly_targets").select("*").in("employee_id", empIds).eq("year", year),
          ]);
          salesList = salesRes.data || [];
          targetsList = targetRes.data || [];
        }
      } else {
        // BE / MR - Self only
        const [empRes, salesRes, targetRes] = await Promise.all([
          supabase.from("employees").select("*").eq("id", empId!).single(),
          supabase.from("monthly_sales").select("*").eq("employee_id", empId!).eq("year", year),
          supabase.from("monthly_targets").select("*").eq("employee_id", empId!).eq("year", year),
        ]);
        employeesList = empRes.data ? [empRes.data] : [];
        salesList = salesRes.data || [];
        targetsList = targetRes.data || [];
      }

      return { employees: employeesList, sales: salesList, targets: targetsList };
    },
  });

  if (meLoading || isLoading) return <SkeletonGrid />;

  if (!me) {
    return (
      <div className="kpi-card p-6 text-center">
        <p className="text-sm text-muted-foreground">No employee profile linked to this account.</p>
      </div>
    );
  }

  const employees = data?.employees || [];
  const sales = data?.sales || [];
  const targets = data?.targets || [];

  // Helper calculations
  const getEmployeeStats = (employeeUuid: string) => {
    const empSales = sales.filter((s) => s.employee_id === employeeUuid);
    const empTargets = targets.filter((t) => t.employee_id === employeeUuid);

    const curSales = empSales.filter((s) => s.month === month).reduce((a, b) => a + num(b.sales_amount), 0);
    const curTarget = empTargets.filter((t) => t.month === month).reduce((a, b) => a + num(b.target_amount), 0);
    const curPYSales = empSales.filter((s) => s.month === month).reduce((a, b) => a + num(b.previous_year_sales), 0);

    const ytdSales = empSales.filter((s) => isMonthInYtd(s.month, month)).reduce((a, b) => a + num(b.sales_amount), 0);
    const ytdTarget = empTargets.filter((t) => isMonthInYtd(t.month, month)).reduce((a, b) => a + num(b.target_amount), 0);

    const ach = curTarget > 0 ? (curSales / curTarget) * 100 : 0;
    const growth = curPYSales > 0 ? ((curSales - curPYSales) / curPYSales) * 100 : 0;
    const ytdAch = ytdTarget > 0 ? (ytdSales / ytdTarget) * 100 : 0;

    return { curSales, curTarget, ach, growth, ytdSales, ytdTarget, ytdAch };
  };

  // Rendering logic based on role
  if (userRole === "be_mr") {
    const stats = getEmployeeStats(empId!);
    const alertActive = stats.ach < 80;
    const salesNeeded = Math.max(0, stats.curTarget - stats.curSales);

    const chartData = MONTHS_FISCAL.map((item) => {
      const ms = sales.filter((s) => s.month === item.m).reduce((a, b) => a + num(b.sales_amount), 0);
      const mt = targets.filter((t) => t.month === item.m).reduce((a, b) => a + num(b.target_amount), 0);
      return { m: item.name, Sales: ms, Target: mt };
    });

    return (
      <div className="space-y-5">
        <section className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Performance Portal</h1>
            <p className="text-xs text-muted-foreground">{me.employee.name} · {me.employee.employee_id}</p>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
            Active · {me.employee.hq}
          </span>
        </section>

        {alertActive && (
          <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive flex gap-3 items-start animate-pulse">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold">Achievement Warning (&lt;80%)</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                Your monthly achievement is {stats.ach.toFixed(1)}%. You need ₹{salesNeeded.toLocaleString("en-IN")} more sales to meet this month's target.
              </p>
            </div>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Current Month Sales"
            value={formatINR(stats.curSales)}
            icon={<Wallet className="size-4" />}
            trend={stats.growth}
            hint="vs last year"
          />
          <KpiCard
            label="Current Month Target"
            value={formatINR(stats.curTarget)}
            icon={<Target className="size-4" />}
            accent="warning"
            hint={`Gap: ${formatINR(salesNeeded)}`}
          />
          <KpiCard
            label="Achievement %"
            value={formatPct(stats.ach)}
            icon={<Trophy className="size-4" />}
            accent={stats.ach >= 100 ? "success" : stats.ach >= 80 ? "primary" : "destructive"}
            hint="Monthly progress"
          />
          <KpiCard
            label="Growth %"
            value={formatPct(stats.growth)}
            icon={<TrendingUp className="size-4" />}
            accent={stats.growth >= 0 ? "success" : "destructive"}
            hint="vs previous year"
          />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <KpiCard label="YTD Sales" value={formatINR(stats.ytdSales)} icon={<Activity className="size-4" />} />
          <KpiCard label="YTD Target" value={formatINR(stats.ytdTarget)} icon={<CalendarRange className="size-4" />} accent="warning" />
          <div className="col-span-2">
            <KpiCard
              label="YTD Achievement %"
              value={formatPct(stats.ytdAch)}
              icon={<Trophy className="size-4" />}
              accent={stats.ytdAch >= 100 ? "success" : stats.ytdAch >= 80 ? "primary" : "destructive"}
              hint={`${formatINR(stats.ytdSales)} achieved of ${formatINR(stats.ytdTarget)} YTD target`}
            />
          </div>
        </section>

        <section className="kpi-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly Sales vs Target</h2>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="m" tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v: number) => (v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  formatter={(v: number) => formatINR(v)}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="Target" stroke="var(--color-chart-3)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="Sales" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    );
  }

  if (userRole === "manager") {
    const myStats = getEmployeeStats(empId!);
    // Direct reports (excluding manager self for calculations)
    const reports = employees.filter((e) => e.id !== empId);

    const teamRows = reports.map((emp) => {
      const s = getEmployeeStats(emp.id);
      return {
        id: emp.id,
        code: emp.employee_id,
        name: emp.name,
        hq: emp.hq,
        sales: s.curSales,
        target: s.curTarget,
        ach: s.ach,
        growth: s.growth,
      };
    });

    const teamSales = teamRows.reduce((a, b) => a + b.sales, 0);
    const teamTarget = teamRows.reduce((a, b) => a + b.target, 0);
    const teamAch = teamTarget > 0 ? (teamSales / teamTarget) * 100 : 0;

    const underperformingCount = teamRows.filter((r) => r.ach < 80).length;

    // Perform sorting/filtering
    const filteredRows = teamRows
      .filter((r) => r.name.toLowerCase().includes(teamSearch.toLowerCase()) || r.code.toLowerCase().includes(teamSearch.toLowerCase()))
      .sort((a, b) => {
        let valA = a[teamSort];
        let valB = b[teamSort];
        if (typeof valA === "string") {
          return teamSortDir === "asc"
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        }
        return teamSortDir === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });

    const topPerformers = [...teamRows].sort((a, b) => b.ach - a.ach).slice(0, 3);
    const bottomPerformers = [...teamRows].sort((a, b) => a.ach - b.ach).slice(0, 3);

    return (
      <div className="space-y-5">
        <section>
          <h1 className="text-xl font-bold tracking-tight">Team Overview</h1>
          <p className="text-xs text-muted-foreground">{me.employee.name} · manager views</p>
        </section>

        {/* Daily summary notification */}
        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-primary flex gap-3 items-start">
          <Activity className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold">Daily Team Performance Digest</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              Team overall monthly achievement is at {teamAch.toFixed(1)}%. {underperformingCount} team members are under 80% achievement threshold today.
            </p>
          </div>
        </div>

        <section className="grid grid-cols-3 gap-2">
          <KpiCard label="Team Sales" value={formatINR(teamSales)} icon={<Wallet className="size-4" />} />
          <KpiCard label="Team Target" value={formatINR(teamTarget)} icon={<Target className="size-4" />} accent="warning" />
          <KpiCard
            label="Team Achievement"
            value={formatPct(teamAch)}
            icon={<Trophy className="size-4" />}
            accent={teamAch >= 80 ? "success" : "destructive"}
          />
        </section>

        {/* Leaderboards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="kpi-card p-3.5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
              <Trophy className="size-3.5" /> Top Performers
            </h3>
            <div className="divide-y text-xs">
              {topPerformers.map((p, idx) => (
                <div key={p.id} className="py-2 flex justify-between">
                  <span>{idx + 1}. {p.name} ({p.hq})</span>
                  <span className="font-semibold text-emerald-500">{formatPct(p.ach)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="kpi-card p-3.5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1">
              <TrendingDown className="size-3.5" /> Below Target
            </h3>
            <div className="divide-y text-xs">
              {bottomPerformers.map((p, idx) => (
                <div key={p.id} className="py-2 flex justify-between">
                  <span>{idx + 1}. {p.name} ({p.hq})</span>
                  <span className="font-semibold text-destructive">{formatPct(p.ach)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Table */}
        <section className="kpi-card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Member Performance</h2>
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-secondary"
              />
            </div>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-secondary text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="p-3">Employee Code</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">HQ</th>
                  <th className="p-3 text-right">Sales</th>
                  <th className="p-3 text-right">Target</th>
                  <th className="p-3 text-right">Ach %</th>
                  <th className="p-3 text-right">Growth %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/5">
                    <td className="p-3 font-medium">{r.code}</td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">{r.hq}</td>
                    <td className="p-3 text-right">{formatINR(r.sales)}</td>
                    <td className="p-3 text-right">{formatINR(r.target)}</td>
                    <td className="p-3 text-right font-semibold">{formatPct(r.ach)}</td>
                    <td className="p-3 text-right">{formatPct(r.growth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (userRole === "management" || userRole === "admin") {
    // Calculate management dashboard
    const allReports = employees.map((emp) => {
      const s = getEmployeeStats(emp.id);
      return {
        id: emp.id,
        code: emp.employee_id,
        name: emp.name,
        hq: emp.hq,
        state: emp.state,
        managerId: emp.manager_id,
        ...s,
      };
    });

    const overallSales = allReports.reduce((a, b) => a + b.curSales, 0);
    const overallTarget = allReports.reduce((a, b) => a + b.curTarget, 0);
    const overallAch = overallTarget > 0 ? (overallSales / overallTarget) * 100 : 0;

    // State Performance Map
    const stateMap: Record<string, { sales: number; target: number }> = {};
    allReports.forEach((r) => {
      if (!r.state) return;
      if (!stateMap[r.state]) stateMap[r.state] = { sales: 0, target: 0 };
      stateMap[r.state].sales += r.curSales;
      stateMap[r.state].target += r.curTarget;
    });
    const stateRankings = Object.keys(stateMap)
      .map((st) => ({
        state: st,
        sales: stateMap[st].sales,
        target: stateMap[st].target,
        ach: stateMap[st].target > 0 ? (stateMap[st].sales / stateMap[st].target) * 100 : 0,
      }))
      .sort((a, b) => b.ach - a.ach);

    // Leaderboards (Top 20 / Bottom 20)
    const top20 = [...allReports].sort((a, b) => b.ach - a.ach).slice(0, 20);
    const bottom20 = [...allReports].sort((a, b) => a.ach - b.ach).slice(0, 20);

    return (
      <div className="space-y-5">
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Organization Performance</h1>
            <p className="text-xs text-muted-foreground">Adonis National Sales Dashboard</p>
          </div>
          {userRole === "admin" && (
            <Link to="/data" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card text-xs font-semibold text-foreground hover:bg-accent transition">
              <Shield className="size-4 text-primary" /> Admin Panel <ArrowRight className="size-3.5" />
            </Link>
          )}
        </section>

        {/* Weekly Company summary alert */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 flex gap-3 items-start">
          <Building className="size-5 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold">Weekly Company Performance digest</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              Leaderboard: **{stateRankings[0]?.state || "N/A"}** leads states with {stateRankings[0]?.ach.toFixed(0)}% achievement. Overall company monthly target progress is at {overallAch.toFixed(1)}%.
            </p>
          </div>
        </div>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="National Sales" value={formatINR(overallSales)} icon={<Wallet className="size-4" />} />
          <KpiCard label="National Target" value={formatINR(overallTarget)} icon={<Target className="size-4" />} accent="warning" />
          <KpiCard
            label="Overall Achievement"
            value={formatPct(overallAch)}
            icon={<Trophy className="size-4" />}
            accent={overallAch >= 80 ? "success" : "destructive"}
          />
          <KpiCard
            label="Reporting Force"
            value={allReports.length.toString()}
            icon={<Users className="size-4" />}
            accent="primary"
          />
        </section>

        {/* State Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="kpi-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">State Rankings</h3>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateRankings.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" />
                  <YAxis dataKey="state" type="category" tick={{ fontSize: 9 }} stroke="var(--color-muted-foreground)" width={80} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="ach" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Top Leaderboard */}
          <section className="kpi-card p-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500">Top 5 Performers (National)</h3>
            <div className="divide-y text-xs">
              {top20.slice(0, 5).map((p, idx) => (
                <div key={p.id} className="py-2.5 flex justify-between">
                  <span>{idx + 1}. {p.name} ({p.hq})</span>
                  <span className="font-semibold text-emerald-500">{formatPct(p.ach)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return null;
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="kpi-card p-4 h-28 animate-pulse" />
      ))}
    </div>
  );
}
