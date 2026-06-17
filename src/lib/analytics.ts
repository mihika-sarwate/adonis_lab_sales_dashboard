import {
  currentFinancialYear,
  fiscalMonthsToCurrent,
  isInYtd,
  monthLabel,
  performanceStatus,
  toNumber,
  type MonthlySalesRow,
  type MonthlyTargetRow,
  type PortalEmployee,
} from "./portal";

export type PerformanceRow = PortalEmployee & {
  current_sales: number;
  current_target: number;
  current_previous_year_sales: number;
  achievement_pct: number;
  growth_pct: number;
  ytd_sales: number;
  ytd_target: number;
  ytd_achievement_pct: number;
  target_gap: number;
  status: string;
};

export type TrendPoint = {
  month: number;
  label: string;
  sales: number;
  target: number;
  achievement_pct: number;
};

export function buildTrendSeries(
  employeeCode: string,
  sales: MonthlySalesRow[],
  targets: MonthlyTargetRow[],
  date = new Date(),
): TrendPoint[] {
  const financialYear = currentFinancialYear(date);
  const months = fiscalMonthsToCurrent(date);

  return months
    .filter((month) => month >= 1 && month <= 12)
    .map((month) => {
      const monthlySales = sales
        .filter(
          (row) =>
            row.employee_code === employeeCode &&
            row.financial_year === financialYear &&
            row.month === month,
        )
        .reduce((sum, row) => sum + toNumber(row.sales_amount), 0);

      const monthlyTarget = targets
        .filter(
          (row) =>
            row.employee_code === employeeCode &&
            row.financial_year === financialYear &&
            row.month === month,
        )
        .reduce((sum, row) => sum + toNumber(row.target_amount), 0);

      return {
        month,
        label: monthLabel(month),
        sales: monthlySales,
        target: monthlyTarget,
        achievement_pct: monthlyTarget > 0 ? (monthlySales / monthlyTarget) * 100 : 0,
      };
    });
}

export function buildPerformanceRows(
  employees: PortalEmployee[],
  sales: MonthlySalesRow[],
  targets: MonthlyTargetRow[],
  date = new Date(),
): PerformanceRow[] {
  const financialYear = currentFinancialYear(date);
  const currentMonth = date.getMonth() + 1;

  const salesByEmployee = new Map<string, MonthlySalesRow[]>();
  for (const row of sales) {
    if (row.financial_year !== financialYear) continue;
    let arr = salesByEmployee.get(row.employee_code);
    if (!arr) {
      arr = [];
      salesByEmployee.set(row.employee_code, arr);
    }
    arr.push(row);
  }

  const targetsByEmployee = new Map<string, MonthlyTargetRow[]>();
  for (const row of targets) {
    if (row.financial_year !== financialYear) continue;
    let arr = targetsByEmployee.get(row.employee_code);
    if (!arr) {
      arr = [];
      targetsByEmployee.set(row.employee_code, arr);
    }
    arr.push(row);
  }

  return employees.map((employee) => {
    const employeeSales = salesByEmployee.get(employee.employee_code) || [];
    const employeeTargets = targetsByEmployee.get(employee.employee_code) || [];

    let currentSales = 0;
    let currentPreviousYearSales = 0;
    let ytdSales = 0;

    for (const row of employeeSales) {
      const amount = toNumber(row.sales_amount);
      const prevAmount = toNumber(row.previous_year_sales);
      if (row.month === currentMonth) {
        currentSales += amount;
        currentPreviousYearSales += prevAmount;
      }
      if (isInYtd(row.month, date)) {
        ytdSales += amount;
      }
    }

    let currentTarget = 0;
    let ytdTarget = 0;

    for (const row of employeeTargets) {
      const amount = toNumber(row.target_amount);
      if (row.month === currentMonth) {
        currentTarget += amount;
      }
      if (isInYtd(row.month, date)) {
        ytdTarget += amount;
      }
    }

    const achievementPct = currentTarget > 0 ? (currentSales / currentTarget) * 100 : 0;
    const growthPct =
      currentPreviousYearSales > 0
        ? ((currentSales - currentPreviousYearSales) / currentPreviousYearSales) * 100
        : 0;
    const ytdAchievementPct = ytdTarget > 0 ? (ytdSales / ytdTarget) * 100 : 0;

    return {
      ...employee,
      current_sales: currentSales,
      current_target: currentTarget,
      current_previous_year_sales: currentPreviousYearSales,
      achievement_pct: achievementPct,
      growth_pct: growthPct,
      ytd_sales: ytdSales,
      ytd_target: ytdTarget,
      ytd_achievement_pct: ytdAchievementPct,
      target_gap: Math.max(0, currentTarget - currentSales),
      status: performanceStatus(ytdAchievementPct || achievementPct),
    };
  });
}

export function buildScopeTrend(
  rows: PerformanceRow[],
  sales: MonthlySalesRow[],
  targets: MonthlyTargetRow[],
  date = new Date(),
) {
  const financialYear = currentFinancialYear(date);
  const months = fiscalMonthsToCurrent(date);

  const employeeCodes = new Set(rows.map(r => r.employee_code));

  const validSalesByMonth = new Map<number, number>();
  for (const s of sales) {
    if (s.financial_year === financialYear && employeeCodes.has(s.employee_code)) {
      validSalesByMonth.set(s.month, (validSalesByMonth.get(s.month) || 0) + toNumber(s.sales_amount));
    }
  }

  const validTargetsByMonth = new Map<number, number>();
  for (const t of targets) {
    if (t.financial_year === financialYear && employeeCodes.has(t.employee_code)) {
      validTargetsByMonth.set(t.month, (validTargetsByMonth.get(t.month) || 0) + toNumber(t.target_amount));
    }
  }

  return months
    .filter((month) => month >= 1 && month <= 12)
    .map((month) => {
      const salesTotal = validSalesByMonth.get(month) || 0;
      const targetTotal = validTargetsByMonth.get(month) || 0;

      return {
        month,
        label: monthLabel(month),
        sales: salesTotal,
        target: targetTotal,
        achievement_pct: targetTotal > 0 ? (salesTotal / targetTotal) * 100 : 0,
      };
    });
}

export function aggregateByField(rows: PerformanceRow[], field: "state" | "hq" | "manager_code") {
  const buckets = new Map<
    string,
    { label: string; sales: number; target: number; growth: number; count: number }
  >();

  for (const row of rows) {
    const label = row[field] || "Unassigned";
    const bucket = buckets.get(label) ?? {
      label,
      sales: 0,
      target: 0,
      growth: 0,
      count: 0,
    };
    bucket.sales += row.ytd_sales;
    bucket.target += row.ytd_target;
    bucket.growth += row.growth_pct;
    bucket.count += 1;
    buckets.set(label, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      achievement_pct: bucket.target > 0 ? (bucket.sales / bucket.target) * 100 : 0,
      average_growth_pct: bucket.count > 0 ? bucket.growth / bucket.count : 0,
    }))
    .sort((a, b) => b.achievement_pct - a.achievement_pct);
}

export function buildRankings(rows: PerformanceRow[]) {
  const sorted = [...rows].sort((a, b) => b.ytd_achievement_pct - a.ytd_achievement_pct);
  return {
    top20: sorted.slice(0, 20),
    bottom20: [...sorted].reverse().slice(0, 20),
    top5: sorted.slice(0, 5),
    bottom5: [...sorted].reverse().slice(0, 5),
  };
}

export function companySummary(rows: PerformanceRow[]) {
  const sales = rows.reduce((sum, row) => sum + row.ytd_sales, 0);
  const target = rows.reduce((sum, row) => sum + row.ytd_target, 0);
  const growth = rows.reduce((sum, row) => sum + row.growth_pct, 0) / Math.max(rows.length, 1);
  return {
    sales,
    target,
    achievement_pct: target > 0 ? (sales / target) * 100 : 0,
    average_growth_pct: growth,
    count: rows.length,
  };
}

export function teamSummary(rows: PerformanceRow[]) {
  const sales = rows.reduce((sum, row) => sum + row.ytd_sales, 0);
  const target = rows.reduce((sum, row) => sum + row.ytd_target, 0);
  return {
    sales,
    target,
    achievement_pct: target > 0 ? (sales / target) * 100 : 0,
    count: rows.length,
  };
}
