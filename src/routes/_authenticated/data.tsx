import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle,
  FileText,
  Key,
  Shield,
  Upload,
  UserCheck,
  Users,
  History,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser } from "@/hooks/usePortalUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  currentFinancialYear,
  monthNumberFromLabel,
  normalizeRole,
  type PortalRole,
} from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/data")({
  head: () => ({ meta: [{ title: "Admin Portal · Pharmaceutical Sales Portal" }] }),
  component: AdminPortalPage,
});

type UploadType = "employees" | "sales" | "targets";

type ParsedRow = Record<string, string>;
type ValidationIssue = { row: number; message: string };

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];

  const splitLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = splitLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  return lines.slice(1).map((line) => {
    const values = splitLine(line);
    const row: ParsedRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function normalizeMonth(value: string) {
  const clean = value.trim().toLowerCase();
  const short = clean.slice(0, 3);
  return Number.isFinite(Number(clean)) ? Number(clean) : monthNumberFromLabel(short);
}

function normalizeEmployeeCode(value: string) {
  return value.trim().toUpperCase();
}

function AdminPortalPage() {
  const { data: me, isLoading: meLoading } = usePortalUser();
  const qc = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("upload");

  const canAccess = !!me?.canManageUsers;

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    enabled: canAccess,
    queryKey: ["admin-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "employee_code, employee_name, designation, role, manager_code, hq, state, active, auth_user_id",
        )
        .order("employee_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    enabled: canAccess,
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("auth_user_id, employee_code, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: importHistory = [] } = useQuery({
    enabled: canAccess,
    queryKey: ["admin-imports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imports_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async (payload: {
      employee_code: string;
      role?: PortalRole;
      active?: boolean;
      manager_code?: string | null;
    }) => {
      const { employee_code, role, active, manager_code } = payload;
      const updates: Record<string, unknown> = {};
      if (role) updates.role = normalizeRole(role);
      if (typeof active === "boolean") updates.active = active;
      if (manager_code !== undefined)
        updates.manager_code = manager_code ? manager_code.toUpperCase() : null;
      const { error } = await supabase
        .from("employees")
        .update(updates)
        .eq("employee_code", employee_code);
      if (error) throw error;

      if (role) {
        await supabase
          .from("user_profiles")
          .update({ role: normalizeRole(role) })
          .eq("employee_code", employee_code);
      }
    },
    onSuccess: () => {
      toast.success("Employee updated");
      qc.invalidateQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed"),
  });

  const resetPassword = useMutation({
    mutationFn: async (employee_code: string) => {
      const email = `${employee_code.trim().toLowerCase()}@portal.app`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Password reset link sent"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Reset failed"),
  });

  if (meLoading) return <div className="kpi-card p-6 animate-pulse h-40" />;

  if (!canAccess) {
    return (
      <div className="kpi-card p-6 text-center text-sm text-muted-foreground max-w-md mx-auto mt-10">
        <Shield className="size-12 mx-auto text-destructive mb-3" />
        <h2 className="text-base font-semibold text-foreground mb-1">Access Restricted</h2>
        Only head office and admin accounts can access the management portal.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">
            Employee master, imports, hierarchy, and user controls
          </p>
        </div>
      </section>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="upload" className="flex items-center gap-1.5">
            <Upload className="size-4" /> Uploads
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="size-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="size-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <CsvUploadSection />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <section className="kpi-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Employee Master ({employees.length})</h2>
              <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries()}>
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            </div>

            {employeesLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-10 bg-secondary rounded" />
                <div className="h-10 bg-secondary rounded" />
              </div>
            ) : (
              <div className="divide-y max-h-[70vh] overflow-y-auto pr-1">
                {employees.map((employee) => {
                  const profile = profiles.find(
                    (item) => item.employee_code === employee.employee_code,
                  );
                  return (
                    <div
                      key={employee.employee_code}
                      className="py-3 grid gap-3 md:grid-cols-[1.5fr_0.8fr_0.8fr_auto_auto] md:items-center"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{employee.employee_name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                            {employee.employee_code}
                          </span>
                          {!employee.active && (
                            <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {employee.designation || "No designation"} · {employee.hq || "No HQ"} ·{" "}
                          {employee.state || "No state"}
                        </p>
                      </div>

                      <Select
                        value={normalizeRole(profile?.role ?? employee.role)}
                        onValueChange={(role) =>
                          updateEmployee.mutate({
                            employee_code: employee.employee_code,
                            role: role as PortalRole,
                          })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="representative">Representative</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="rsm">RSM</SelectItem>
                          <SelectItem value="zsm">ZSM</SelectItem>
                          <SelectItem value="head_office">Head Office</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        key={`${employee.employee_code}-${employee.manager_code ?? ""}`}
                        className="h-9 text-xs"
                        defaultValue={employee.manager_code ?? ""}
                        placeholder="Manager code"
                        onBlur={(event) =>
                          updateEmployee.mutate({
                            employee_code: employee.employee_code,
                            manager_code: event.target.value || null,
                          })
                        }
                      />

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        title={employee.active ? "Deactivate employee" : "Activate employee"}
                        onClick={() =>
                          updateEmployee.mutate({
                            employee_code: employee.employee_code,
                            active: !employee.active,
                          })
                        }
                      >
                        {employee.active ? (
                          <UserCheck className="size-4 text-success" />
                        ) : (
                          <Ban className="size-4 text-destructive" />
                        )}
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        title="Reset password"
                        onClick={() => resetPassword.mutate(employee.employee_code)}
                      >
                        <Key className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <section className="kpi-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Import History</h2>
              <span className="text-xs text-muted-foreground">
                Latest {importHistory.length} runs
              </span>
            </div>

            <div className="divide-y">
              {importHistory.map((item) => (
                <div
                  key={item.id}
                  className="py-3 grid gap-2 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-medium capitalize">{item.import_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.source_file_name || "Manual paste"}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Status: {item.status}</p>
                    <p>Rows: {item.total_rows}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>Inserted: {item.inserted_rows}</p>
                    <p>Updated: {item.updated_rows}</p>
                  </div>
                  <div className="text-xs text-right text-muted-foreground">
                    {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CsvUploadSection() {
  const qc = useQueryClient();
  const [activeUpload, setActiveUpload] = useState<UploadType | null>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const currentFY = currentFinancialYear();

  const preview = () => {
    if (!activeUpload) return;
    const rows = parseCsv(csvText);
    const nextIssues: ValidationIssue[] = [];
    const seen = new Set<string>();

    rows.forEach((row, index) => {
      const employeeCode = normalizeEmployeeCode(
        row.employeecode || row.code || row.empid || row.employeeid || "",
      );
      if (!employeeCode) {
        nextIssues.push({ row: index + 2, message: "Missing employee code" });
      }

      const dedupeKey =
        activeUpload === "employees"
          ? employeeCode
          : `${employeeCode}:${row.financialyear || currentFY}:${normalizeMonth(row.month || "")}`;

      if (seen.has(dedupeKey)) {
        nextIssues.push({ row: index + 2, message: "Duplicate row detected in the file" });
      }
      seen.add(dedupeKey);

      if (activeUpload === "employees" && !(row.employeename || row.name || "").trim()) {
        nextIssues.push({ row: index + 2, message: "Employee name is required" });
      }
      if (activeUpload !== "employees") {
        if (!row.month) nextIssues.push({ row: index + 2, message: "Month is required" });
        if (!row.amount && !row.targetamount && !row.salesamount)
          nextIssues.push({ row: index + 2, message: "Amount is required" });
      }
    });

    setPreviewRows(rows);
    setIssues(nextIssues);
  };

  const upload = async () => {
    if (!activeUpload || !previewRows.length) return;
    setLoading(true);
    const previewData = previewRows.slice(0, 25);
    let logId: string | null = null;

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: log, error: logError } = await supabase
        .from("imports_log")
        .insert({
          import_type: activeUpload,
          source_file_name: fileName,
          uploaded_by: userData.user?.id ?? null,
          status: "processing",
          total_rows: previewRows.length,
          duplicate_rows: issues.length,
          preview: previewData as never,
          errors: issues as never,
        })
        .select("id")
        .single();
      if (logError) throw logError;
      logId = log.id;

      if (activeUpload === "employees") {
        const { data: existingEmployees, error: employeesError } = await supabase
          .from("employees")
          .select("employee_code");
        if (employeesError) throw employeesError;
        const knownCodes = new Set((existingEmployees ?? []).map((item) => item.employee_code));
        const baseRows = previewRows
          .map((row) => ({
            employee_code: normalizeEmployeeCode(
              row.employeecode || row.code || row.empid || row.employeeid || "",
            ),
            employee_name: (row.employeename || row.name || "").trim(),
            designation: (row.designation || "").trim() || null,
            role: normalizeRole((row.role || "representative").trim()) as PortalRole,
            hq: (row.hq || "").trim() || null,
            state: (row.state || "").trim() || null,
            active: (row.status || "active").trim().toLowerCase() !== "inactive",
          }))
          .filter((row) => row.employee_code && row.employee_name);

        const { error } = await supabase
          .from("employees")
          .upsert(baseRows, { onConflict: "employee_code" });
        if (error) throw error;

        const managerRows = previewRows
          .map((row) => {
            const employee_code = normalizeEmployeeCode(
              row.employeecode || row.code || row.empid || row.employeeid || "",
            );
            const manager_code = normalizeEmployeeCode(row.managercode || row.managerid || "");
            if (!employee_code || !manager_code) return null;
            return { employee_code, manager_code };
          })
          .filter((row): row is { employee_code: string; manager_code: string } => !!row);

        const baseCodes = new Set(baseRows.map((item) => item.employee_code));
        const invalidManagers = managerRows.filter(
          (row) =>
            !baseCodes.has(row.manager_code) &&
            !knownCodes.has(row.manager_code),
        );
        if (invalidManagers.length) {
          throw new Error(
            `Unknown manager code(s): ${[...new Set(invalidManagers.map((row) => row.manager_code))].join(", ")}`,
          );
        }

        if (managerRows.length) {
          const { error: managerError } = await supabase.from("employees").upsert(
            managerRows.map((row) => ({
              employee_code: row.employee_code,
              manager_code: row.manager_code,
            })),
            { onConflict: "employee_code" },
          );
          if (managerError) throw managerError;
        }
      }

      if (activeUpload === "sales" || activeUpload === "targets") {
        const { data: knownEmployees, error: employeesError } = await supabase
          .from("employees")
          .select("employee_code");
        if (employeesError) throw employeesError;
        const validCodes = new Set((knownEmployees ?? []).map((item) => item.employee_code));

        if (activeUpload === "sales") {
          const rows = previewRows
            .map((row) => {
              const employee_code = normalizeEmployeeCode(
                row.employeecode || row.code || row.empid || row.employeeid || "",
              );
              const month = normalizeMonth(row.month || "");
              const financial_year = row.financialyear || currentFY;
              if (!validCodes.has(employee_code)) return null;
              return {
                employee_code,
                month,
                financial_year,
                sales_amount: Number(row.salesamount || row.amount || 0),
                previous_year_sales: Number(row.previousyearsales || row.pysales || 0),
              };
            })
            .filter(Boolean);

          const { error } = await supabase
            .from("monthly_sales")
            .upsert(rows as never, { onConflict: "employee_code,financial_year,month" });
          if (error) throw error;
        } else {
          const rows = previewRows
            .map((row) => {
              const employee_code = normalizeEmployeeCode(
                row.employeecode || row.code || row.empid || row.employeeid || "",
              );
              const month = normalizeMonth(row.month || "");
              const financial_year = row.financialyear || currentFY;
              if (!validCodes.has(employee_code)) return null;
              return {
                employee_code,
                month,
                financial_year,
                target_amount: Number(row.targetamount || row.amount || 0),
              };
            })
            .filter(Boolean);

          const { error } = await supabase
            .from("monthly_targets")
            .upsert(rows as never, { onConflict: "employee_code,financial_year,month" });
          if (error) throw error;
        }
      }

      if (logId) {
        await supabase
          .from("imports_log")
          .update({
            status: issues.length ? "completed_with_errors" : "completed",
            inserted_rows: Math.max(0, previewRows.length - issues.length),
            error_rows: issues.length,
          })
          .eq("id", logId);
      }

      toast.success("Import completed");
      setCsvText("");
      setPreviewRows([]);
      setIssues([]);
      setActiveUpload(null);
      setFileName(null);
      qc.invalidateQueries();
    } catch (error) {
      if (logId) {
        await supabase
          .from("imports_log")
          .update({
            status: "failed",
            errors: [
              { message: error instanceof Error ? error.message : "Import failed" },
            ] as never,
          })
          .eq("id", logId);
      }
      toast.error(error instanceof Error ? error.message : "CSV import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => {
            setActiveUpload("employees");
            setCsvText("");
            setPreviewRows([]);
            setIssues([]);
            setFileName(null);
          }}
          className={[
            "kpi-card p-4 text-left flex items-start gap-3 border transition-all",
            activeUpload === "employees"
              ? "border-primary bg-primary/5 shadow-inner"
              : "border-border hover:bg-accent/5",
          ].join(" ")}
        >
          <div className="size-9 rounded-xl bg-primary/10 grid place-items-center text-primary mt-0.5">
            <Users className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Employee Master</h3>
            <p className="text-xs text-muted-foreground">
              Upload employee code, name, manager, state, HQ, and role
            </p>
          </div>
        </button>

        <button
          onClick={() => {
            setActiveUpload("targets");
            setCsvText("");
            setPreviewRows([]);
            setIssues([]);
            setFileName(null);
          }}
          className={[
            "kpi-card p-4 text-left flex items-start gap-3 border transition-all",
            activeUpload === "targets"
              ? "border-primary bg-primary/5 shadow-inner"
              : "border-border hover:bg-accent/5",
          ].join(" ")}
        >
          <div className="size-9 rounded-xl bg-amber-500/10 grid place-items-center text-amber-500 mt-0.5">
            <FileText className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Monthly Targets</h3>
            <p className="text-xs text-muted-foreground">
              Upload target amount by employee, month, and financial year
            </p>
          </div>
        </button>

        <button
          onClick={() => {
            setActiveUpload("sales");
            setCsvText("");
            setPreviewRows([]);
            setIssues([]);
            setFileName(null);
          }}
          className={[
            "kpi-card p-4 text-left flex items-start gap-3 border transition-all",
            activeUpload === "sales"
              ? "border-primary bg-primary/5 shadow-inner"
              : "border-border hover:bg-accent/5",
          ].join(" ")}
        >
          <div className="size-9 rounded-xl bg-emerald-500/10 grid place-items-center text-emerald-500 mt-0.5">
            <CheckCircle className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Monthly Sales</h3>
            <p className="text-xs text-muted-foreground">
              Upload sales amount and previous year sales
            </p>
          </div>
        </button>
      </div>

      {activeUpload && (
        <div className="kpi-card p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold capitalize">Upload {activeUpload} Data</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeUpload === "employees" &&
                "Required headers: EmployeeCode, EmployeeName, Designation, ManagerCode, HQ, State, Role, Status"}
              {activeUpload === "targets" &&
                "Required headers: EmployeeCode, Month, TargetAmount, FinancialYear"}
              {activeUpload === "sales" &&
                "Required headers: EmployeeCode, Month, SalesAmount, PreviousYearSales, FinancialYear"}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setFileName(file.name);
                  setCsvText(await file.text());
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="csv-input">Or paste CSV content</Label>
              <Input
                id="csv-input"
                value={fileName ?? ""}
                onChange={() => undefined}
                placeholder="Selected file will appear here"
                disabled
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="csv-paste">CSV Text</Label>
            <textarea
              id="csv-paste"
              rows={8}
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder={
                activeUpload === "employees"
                  ? "EmployeeCode,EmployeeName,Designation,ManagerCode,HQ,State,Role,Status"
                  : activeUpload === "sales"
                    ? "EmployeeCode,Month,SalesAmount,PreviousYearSales,FinancialYear"
                    : "EmployeeCode,Month,TargetAmount,FinancialYear"
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={preview} disabled={!csvText.trim()}>
              Preview
            </Button>
            <Button size="sm" onClick={upload} disabled={loading || !previewRows.length}>
              {loading ? "Processing..." : "Process Upload"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setActiveUpload(null);
                setCsvText("");
                setPreviewRows([]);
                setIssues([]);
                setFileName(null);
              }}
            >
              Cancel
            </Button>
          </div>

          {(previewRows.length > 0 || issues.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Preview</h4>
                <span className="text-xs text-muted-foreground">
                  {previewRows.length} rows, {issues.length} validation issue(s)
                </span>
              </div>

              {issues.length > 0 && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
                  {issues.slice(0, 8).map((issue) => (
                    <p key={`${issue.row}-${issue.message}`}>
                      Row {issue.row}: {issue.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-secondary text-muted-foreground font-semibold border-b">
                    <tr>
                      {Object.keys(previewRows[0] ?? {})
                        .slice(0, 6)
                        .map((header) => (
                          <th key={header} className="p-3 text-left">
                            {header}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.slice(0, 8).map((row, index) => (
                      <tr key={index}>
                        {Object.values(row)
                          .slice(0, 6)
                          .map((value, columnIndex) => (
                            <td key={columnIndex} className="p-3">
                              {value}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
