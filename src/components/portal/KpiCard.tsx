import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function formatINR(n: number) {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

export function formatPct(n: number, digits = 1) {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function KpiCard({
  label,
  value,
  hint,
  trend,
  icon,
  accent = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: number | null;
  icon?: ReactNode;
  accent?: "primary" | "success" | "warning" | "destructive";
}) {
  const accentClass = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning-foreground bg-warning/20",
    destructive: "text-destructive bg-destructive/10",
  }[accent];

  return (
    <div className="kpi-card p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        {icon && (
          <span className={`size-8 rounded-lg grid place-items-center ${accentClass}`}>{icon}</span>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <div className="flex items-center gap-2 text-xs">
        {typeof trend === "number" && isFinite(trend) && (
          <span
            className={[
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium",
              trend >= 0 ? "text-success bg-success/10" : "text-destructive bg-destructive/10",
            ].join(" ")}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground truncate">{hint}</span>}
      </div>
    </div>
  );
}
