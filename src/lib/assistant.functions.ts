import { z } from "zod";
import {
  buildPerformanceRows,
  buildRankings,
  companySummary,
  aggregateByField,
} from "@/lib/analytics";
import {
  currentFinancialYear,
  isGlobalRole,
  isManagerialRole,
  normalizeRole,
  type PortalEmployee,
} from "@/lib/portal";

const AskInput = z.object({
  question: z.string().min(1).max(2000),
});

type AssistantContext = ReturnType<typeof buildContext>;
type Intent =
  | "self_achievement"
  | "self_ytd_achievement"
  | "sales_needed"
  | "team_ranking"
  | "below_80"
  | "top_performers"
  | "company_achievement"
  | "best_state"
  | "best_hq"
  | "best_manager"
  | "team_summary"
  | "help";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function bulletList(items: string[]) {
  if (!items.length) return "No matching records were found.";
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function parseIntent(question: string): Intent {
  const normalized = question.trim().toLowerCase();

  if (/(top\s*performers?|best\s*performers?|leaders|rankings?)/.test(normalized))
    return "top_performers";
  if (/(below\s*80|under\s*80|less\s*than\s*80|low\s*performers?)/.test(normalized))
    return "below_80";
  if (/(team\s*ranking|show\s*team\s*ranking|ranking)/.test(normalized)) return "team_ranking";
  if (/(company\s*achievement|overall\s*achievement|company\s*performance)/.test(normalized))
    return "company_achievement";
  if (/(best\s*state|which\s*state|state\s*performing)/.test(normalized)) return "best_state";
  if (/(best\s*hq|which\s*hq|hq\s*performing)/.test(normalized)) return "best_hq";
  if (/(best\s*manager|which\s*manager|manager\s*performing)/.test(normalized))
    return "best_manager";
  if (/(team\s*summary|team\s*snapshot|team\s*performance)/.test(normalized)) return "team_summary";
  if (
    /(ytd.*achievement|achievement.*ytd|year[-\s]*to[-\s]*date\s*achievement|my\s*ytd\s*achievement)/.test(
      normalized,
    )
  ) {
    return "self_ytd_achievement";
  }
  if (
    /(how\s*much.*sales.*need|how\s*much.*need.*sales|sales\s*needed|needed\s*to\s*reach\s*target|gap\s*to\s*target)/.test(
      normalized,
    )
  ) {
    return "sales_needed";
  }
  if (
    /(my\s*achievement|what\s*is\s*my\s*achievement|current\s*achievement|achievement\s*%)/.test(
      normalized,
    )
  ) {
    return "self_achievement";
  }

  return "help";
}

function buildContext(
  me: PortalEmployee,
  rows: ReturnType<typeof buildPerformanceRows>,
  question = "",
) {
  const current = rows.find((row) => row.employee_code === me.employee_code) ?? rows[0];
  if (!current) {
    throw new Error("No performance data available for the current account.");
  }

  const rankings = buildRankings(rows);
  const company = companySummary(rows);
  const stateRankings = aggregateByField(rows, "state");
  const hqRankings = aggregateByField(rows, "hq");
  const managerRankings = aggregateByField(rows, "manager_code");

  return {
    question,
    rows,
    self: current,
    rankings,
    company,
    stateRankings,
    hqRankings,
    managerRankings,
  };
}

function answerSelfAchievement(context: AssistantContext) {
  return [
    `Current month achievement: ${formatPct(context.self.achievement_pct)}`,
    `Current month sales: ${formatAmount(context.self.current_sales)}`,
    `Current month target: ${formatAmount(context.self.current_target)}`,
  ].join("\n");
}

function answerSelfYtdAchievement(context: AssistantContext) {
  return [
    `YTD achievement: ${formatPct(context.self.ytd_achievement_pct)}`,
    `YTD sales: ${formatAmount(context.self.ytd_sales)}`,
    `YTD target: ${formatAmount(context.self.ytd_target)}`,
  ].join("\n");
}

function answerSalesNeeded(context: AssistantContext) {
  const currentGap = Math.max(0, context.self.target_gap);
  const ytdGap = Math.max(0, context.self.ytd_target - context.self.ytd_sales);

  if (!currentGap && !ytdGap) {
    return "You have already met both the current month target and the YTD target.";
  }

  return [
    `Sales needed for current month target: ${formatAmount(currentGap)}`,
    `Sales needed for YTD target: ${formatAmount(ytdGap)}`,
  ].join("\n");
}

function answerTeamRanking(context: AssistantContext) {
  return bulletList(
    context.rankings.top20
      .slice(0, 10)
      .map(
        (row) =>
          `${row.employee_name} (${row.employee_code}) - ${formatPct(row.ytd_achievement_pct)}`,
      ),
  );
}

function answerBelow80(context: AssistantContext) {
  const rows = context.rows.filter((row) => row.ytd_achievement_pct < 80);
  if (!rows.length) return "No visible employees are below 80% achievement.";
  return bulletList(
    rows.map(
      (row) =>
        `${row.employee_name} (${row.employee_code}) - ${formatPct(row.ytd_achievement_pct)}`,
    ),
  );
}

function answerTopPerformers(context: AssistantContext) {
  return bulletList(
    context.rankings.top5.map(
      (row) =>
        `${row.employee_name} (${row.employee_code}) - ${formatPct(row.ytd_achievement_pct)}`,
    ),
  );
}

function answerCompanyAchievement(context: AssistantContext) {
  return [
    `Company achievement: ${formatPct(context.company.achievement_pct)}`,
    `Company sales: ${formatAmount(context.company.sales)}`,
    `Company target: ${formatAmount(context.company.target)}`,
    `Average growth: ${formatPct(context.company.average_growth_pct)}`,
  ].join("\n");
}

function answerBestBucket(
  buckets: Array<{ label: string; achievement_pct: number; sales: number; target: number }>,
  label: string,
) {
  const bucket = buckets[0];
  if (!bucket) return `No ${label.toLowerCase()} data is available.`;
  return [
    `Best ${label.toLowerCase()}: ${bucket.label}`,
    `Achievement: ${formatPct(bucket.achievement_pct)}`,
    `Sales: ${formatAmount(bucket.sales)}`,
    `Target: ${formatAmount(bucket.target)}`,
  ].join("\n");
}

function answerTeamSummary(context: AssistantContext) {
  return [
    `Visible employees: ${context.rows.length}`,
    `Team sales: ${formatAmount(context.company.sales)}`,
    `Team target: ${formatAmount(context.company.target)}`,
    `Team achievement: ${formatPct(context.company.achievement_pct)}`,
  ].join("\n");
}

function answerFallback(context: AssistantContext) {
  const suggestions = [
    "What is my achievement?",
    "What is my YTD achievement?",
    "How much sales do I need?",
    "Show team ranking.",
    "Show employees below 80%.",
    "Show top performers.",
  ];

  return [
    `I can answer live from the database for ${context.rows.length} visible employees.`,
    "Try one of these:",
    bulletList(suggestions),
  ].join("\n");
}

export const askAssistant = async (question: string, supabase: any, userId: string) => {
    const financialYear = currentFinancialYear();

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("auth_user_id, employee_code, role")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw new Error("No employee profile linked to this account.");

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select(
        "employee_code, employee_name, designation, role, manager_code, hq, state, active, auth_user_id",
      )
      .eq("employee_code", profile.employee_code)
      .maybeSingle();
    if (employeeError) throw employeeError;
    if (!employee) throw new Error("Employee record not found.");

    const [{ data: employees = [] }, { data: sales = [] }, { data: targets = [] }] =
      await Promise.all([
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

    const rows = buildPerformanceRows(employees as PortalEmployee[], sales, targets);
    const contextSummary = buildContext(employee, rows, question);
    const role = normalizeRole(profile.role ?? employee.role);
    const visibleScope = isGlobalRole(role) ? "company" : isManagerialRole(role) ? "team" : "self";
    const intent = parseIntent(question);

    const answerByIntent: Record<Intent, string> = {
      self_achievement: answerSelfAchievement(contextSummary),
      self_ytd_achievement: answerSelfYtdAchievement(contextSummary),
      sales_needed: answerSalesNeeded(contextSummary),
      team_ranking: answerTeamRanking(contextSummary),
      below_80: answerBelow80(contextSummary),
      top_performers: answerTopPerformers(contextSummary),
      company_achievement: answerCompanyAchievement(contextSummary),
      best_state: answerBestBucket(contextSummary.stateRankings, "State"),
      best_hq: answerBestBucket(contextSummary.hqRankings, "HQ"),
      best_manager: answerBestBucket(contextSummary.managerRankings, "Manager"),
      team_summary: answerTeamSummary(contextSummary),
      help: answerFallback(contextSummary),
    };

    return {
      answer: [
        answerByIntent[intent],
        "",
        `Scope: ${visibleScope}`,
        `Role: ${role}`,
        `Financial year: ${financialYear}`,
      ].join("\n"),
    };
  };
