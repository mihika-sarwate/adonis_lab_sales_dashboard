import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskInput = z.object({
  question: z.string().min(1).max(2000),
});

type RowSale = { employee_id: string; year: number; month: number; sales_amount: number; previous_year_sales: number };
type RowTarget = { employee_id: string; year: number; month: number; target_amount: number };
type EmpRow = { id: string; employee_id: string; name: string; manager_id: string | null; hq: string | null; designation: string | null; state: string | null; role: string | null };

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return isFinite(n) ? n : 0;
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AskInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Resolve current employee
    const { data: me, error: meErr } = await supabase
      .from("employees")
      .select("id, employee_id, name, manager_id, hq, designation, state, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (meErr) throw new Error(meErr.message);
    if (!me) throw new Error("No employee profile.");

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const role = me.role || "be_mr";

    // Self data
    const [{ data: myTargets = [] }, { data: mySales = [] }] = await Promise.all([
      supabase.from("monthly_targets").select("employee_id, year, month, target_amount").eq("employee_id", me.id).eq("year", year),
      supabase.from("monthly_sales").select("employee_id, year, month, sales_amount, previous_year_sales").eq("employee_id", me.id).eq("year", year),
    ]);

    let teamSummary: string | null = null;
    let companySummary: string | null = null;

    if (role === "manager" || role === "admin" || role === "management") {
      // Fetch reportees
      const query = supabase.from("employees").select("id, employee_id, name, manager_id, hq, designation, state, role");
      
      // If manager, only their direct reports. If management/admin, all reports.
      if (role === "manager") {
        query.eq("manager_id", me.id);
      }
      
      const { data: reports = [] } = await query;
      const teamIds = (reports as EmpRow[]).map((e) => e.id);
      
      if (teamIds.length) {
        const [{ data: tTargets = [] }, { data: tSales = [] }] = await Promise.all([
          supabase.from("monthly_targets").select("employee_id, year, month, target_amount").in("employee_id", teamIds).eq("year", year),
          supabase.from("monthly_sales").select("employee_id, year, month, sales_amount, previous_year_sales").in("employee_id", teamIds).eq("year", year),
        ]);

        const rows = (reports as EmpRow[]).map((emp) => {
          const ytdSales = (tSales as RowSale[])
            .filter((s) => s.employee_id === emp.id)
            .reduce((a, b) => a + num(b.sales_amount), 0);
          const ytdTarget = (tTargets as RowTarget[])
            .filter((t) => t.employee_id === emp.id)
            .reduce((a, b) => a + num(b.target_amount), 0);
          const mSales = (tSales as RowSale[])
            .filter((s) => s.employee_id === emp.id && s.month === month)
            .reduce((a, b) => a + num(b.sales_amount), 0);
          const mTarget = (tTargets as RowTarget[])
            .filter((t) => t.employee_id === emp.id && t.month === month)
            .reduce((a, b) => a + num(b.target_amount), 0);
          const ach = ytdTarget > 0 ? (ytdSales / ytdTarget) * 100 : 0;
          const mAch = mTarget > 0 ? (mSales / mTarget) * 100 : 0;
          return { name: emp.name, id: emp.employee_id, hq: emp.hq, state: emp.state, role: emp.role, ytdSales, ytdTarget, ach, mSales, mTarget, mAch };
        });

        rows.sort((a, b) => b.ach - a.ach);
        teamSummary = rows
          .map((r, i) => `${i + 1}. ${r.name} (${r.id}) HQ: ${r.hq || "N/A"}: YTD Sales ₹${r.ytdSales.toFixed(0)} / Target ₹${r.ytdTarget.toFixed(0)} → ${r.ach.toFixed(1)}% · Month Ach: ${r.mAch.toFixed(1)}%`)
          .join("\n");

        if (role === "admin" || role === "management") {
          // Calculate state performance
          const stateSales: Record<string, { sales: number; target: number }> = {};
          rows.forEach((r) => {
            if (!r.state) return;
            if (!stateSales[r.state]) stateSales[r.state] = { sales: 0, target: 0 };
            stateSales[r.state].sales += r.ytdSales;
            stateSales[r.state].target += r.ytdTarget;
          });

          const stateLeaderboard = Object.keys(stateSales)
            .map((st) => {
              const ach = stateSales[st].target > 0 ? (stateSales[st].sales / stateSales[st].target) * 100 : 0;
              return `${st}: ₹${stateSales[st].sales.toFixed(0)} achieved of ₹${stateSales[st].target.toFixed(0)} (${ach.toFixed(1)}%)`;
            })
            .join("\n");

          companySummary = `State performance:\n${stateLeaderboard}`;
        }
      } else {
        teamSummary = "No direct reports found.";
      }
    }

    const ytdSales = (mySales as RowSale[]).reduce((a, b) => a + num(b.sales_amount), 0);
    const ytdTarget = (myTargets as RowTarget[]).reduce((a, b) => a + num(b.target_amount), 0);
    const curSales = (mySales as RowSale[]).filter((s) => s.month === month).reduce((a, b) => a + num(b.sales_amount), 0);
    const curTarget = (myTargets as RowTarget[]).filter((t) => t.month === month).reduce((a, b) => a + num(b.target_amount), 0);
    const curPYSales = (mySales as RowSale[]).filter((s) => s.month === month).reduce((a, b) => a + num(b.previous_year_sales), 0);
    const ach = ytdTarget > 0 ? (ytdSales / ytdTarget) * 100 : 0;
    const curAch = curTarget > 0 ? (curSales / curTarget) * 100 : 0;
    const growth = curPYSales > 0 ? ((curSales - curPYSales) / curPYSales) * 100 : 0;
    const gap = Math.max(0, curTarget - curSales);

    const context_summary = [
      `User: ${me.name} (Code: ${me.employee_id}) — Role: ${role}`,
      `Current Date context: Year ${year}, Month ${month}`,
      `Current Month Sales: ₹${curSales.toFixed(0)} / Target ₹${curTarget.toFixed(0)} → Achievement: ${curAch.toFixed(1)}%`,
      `Sales needed to hit current month target: ₹${gap.toFixed(0)}`,
      `Growth vs Previous Year: ${growth.toFixed(1)}%`,
      `YTD Sales: ₹${ytdSales.toFixed(0)} / Target ₹${ytdTarget.toFixed(0)} → YTD Achievement: ${ach.toFixed(1)}%`,
      teamSummary ? `\nTeam/Direct Reports (sorted by YTD achievement):\n${teamSummary}` : "",
      companySummary ? `\nState-wise Performance:\n${companySummary}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are Adonis Sales Portal AI Assistant, an advanced performance analyst for a pharma organization. Answer the user's question using ONLY the provided data context. Always use Rupees (₹) and percentages. If the user asks about data or individuals not present in the context, politely state you do not have permission or visibility to access that. Keep answers brief (under 8 lines) and use formatting like bold text and bullets where appropriate.",
          },
          {
            role: "user",
            content: `DATA CONTEXT:\n${context_summary}\n\nQUESTION: ${data.question}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limit reached. Please retry shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace billing.");
      const text = await res.text();
      throw new Error(`AI error: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const answer = json.choices?.[0]?.message?.content ?? "(no response)";
    return { answer };
  });
