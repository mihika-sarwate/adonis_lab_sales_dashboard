export type PortalRole = "admin" | "head_office" | "zsm" | "rsm" | "manager" | "representative";

export const PORTAL_ROLES: PortalRole[] = [
  "admin",
  "head_office",
  "zsm",
  "rsm",
  "manager",
  "representative",
];

export type FinancialYear = `${number}-${number}`;

export type PortalEmployee = {
  employee_code: string;
  employee_name: string;
  designation: string | null;
  role: string | null;
  manager_code: string | null;
  hq: string | null;
  state: string | null;
  active: boolean | null;
  auth_user_id: string | null;
};

export type MonthlySalesRow = {
  employee_code: string;
  month: number;
  financial_year: string;
  sales_amount: number | string | null;
  previous_year_sales: number | string | null;
};

export type MonthlyTargetRow = {
  employee_code: string;
  month: number;
  financial_year: string;
  target_amount: number | string | null;
};

export type ImportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed";

export function normalizeRole(role: string | null | undefined): PortalRole {
  const normalized = (role ?? "representative").trim().toLowerCase();
  switch (normalized) {
    case "admin":
      return "admin";
    case "head_office":
    case "head office":
    case "management":
      return "head_office";
    case "zsm":
      return "zsm";
    case "rsm":
      return "rsm";
    case "manager":
      return "manager";
    default:
      return "representative";
  }
}

export function isGlobalRole(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "head_office";
}

export function isManagerialRole(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return (
    normalized === "admin" ||
    normalized === "head_office" ||
    normalized === "zsm" ||
    normalized === "rsm" ||
    normalized === "manager"
  );
}

export function currentFinancialYear(date = new Date()): FinancialYear {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}` as FinancialYear;
}

export function currentFiscalYearStart(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4 ? new Date(year, 3, 1) : new Date(year - 1, 3, 1);
}

export function fiscalMonthsToCurrent(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 4) {
    return Array.from({ length: month - 3 }, (_, i) => i + 4);
  }
  return [4, 5, 6, 7, 8, 9, 10, 11, 12].concat(Array.from({ length: month }, (_, i) => i + 1));
}

export function isInYtd(month: number, date = new Date()) {
  const currentMonth = date.getMonth() + 1;
  if (currentMonth >= 4) return month >= 4 && month <= currentMonth;
  return month >= 4 || month <= currentMonth;
}

export function monthLabel(month: number) {
  return (
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
      month - 1
    ] ?? `${month}`
  );
}

export function monthNumberFromLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  const short = normalized.slice(0, 3);
  const map: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  const numeric = Number(label);
  return (
    map[normalized] ??
    map[short] ??
    (Number.isFinite(numeric) ? numeric : new Date().getMonth() + 1)
  );
}

export function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function performanceStatus(achievement: number) {
  if (achievement >= 100) return "Leading";
  if (achievement >= 80) return "On Track";
  if (achievement >= 60) return "Watchlist";
  return "Critical";
}
