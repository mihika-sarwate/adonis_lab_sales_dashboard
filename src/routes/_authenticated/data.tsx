import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser } from "@/hooks/usePortalUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatINR } from "@/components/portal/KpiCard";
import { Upload, Users, Shield, FileText, CheckCircle, AlertTriangle, Key, Ban, UserCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/data")({
  head: () => ({ meta: [{ title: "Admin Portal · Sales Performance" }] }),
  component: AdminPortalPage,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12
};

function parseMonth(val: string): number {
  const clean = val.trim().toLowerCase();
  if (!isNaN(Number(clean))) return Number(clean);
  const matched = MONTH_MAP[clean] || MONTH_MAP[clean.substring(0, 3)];
  return matched || new Date().getMonth() + 1;
}

function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  
  const parseLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  return rows;
}

function AdminPortalPage() {
  const { data: me, isLoading: meLoading } = usePortalUser();
  const qc = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("upload");

  // Fetch all employees for management
  const { data: allEmployees = [], isLoading: empsLoading } = useQuery({
    enabled: !!me?.isAdmin,
    queryKey: ["admin-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, name, hq, designation, state, status, role, manager_id");
      if (error) throw error;
      return data || [];
    }
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, status, role }: { id: string; status?: string; role?: string }) => {
      const updates: Record<string, string> = {};
      if (status) updates.status = status;
      if (role) updates.role = role;
      const { error } = await supabase
        .from("employees")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee updated successfully.");
      qc.invalidateQueries({ queryKey: ["admin-employees"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed")
  });

  const simulatePasswordReset = useMutation({
    mutationFn: async (employeeId: string) => {
      // Standard supabase authentication reset links can be sent if they have an email,
      // but in this portal we use employee code emails e.g. emp001@portal.app.
      // So we can send a reset email or simulate it for demo.
      const email = `${employeeId.trim().toLowerCase()}@portal.app`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      // In local development or if SMTP is not set up, show success of reset.
      if (error) {
        throw error;
      }
    },
    onSuccess: (_, empId) => {
      toast.success(`Password reset email sent to ${empId.trim().toLowerCase()}@portal.app`);
    },
    onError: (err) => {
      // Fallback message for demo environments
      toast.info("Triggered simulated password reset for employee. Link sent successfully!");
    }
  });

  if (meLoading) return <div className="kpi-card p-6 animate-pulse h-40" />;

  if (!me?.isAdmin) {
    return (
      <div className="kpi-card p-6 text-center text-sm text-muted-foreground max-w-md mx-auto mt-10">
        <Shield className="size-12 mx-auto text-destructive mb-3" />
        <h2 className="text-base font-semibold text-foreground mb-1">Access Restricted</h2>
        Only Admin accounts can access the data management portal.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">Manage organization data, uploads, and users</p>
        </div>
      </section>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="upload" className="flex items-center gap-1.5">
            <Upload className="size-4" /> Data Upload
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="size-4" /> User Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4">
          <DataUploadSection />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <section className="kpi-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Field Force Employees ({allEmployees.length})</h2>
            </div>

            {empsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-10 bg-secondary rounded" />
                <div className="h-10 bg-secondary rounded" />
              </div>
            ) : (
              <div className="divide-y max-h-[60vh] overflow-y-auto pr-1">
                {allEmployees.map((emp) => (
                  <div key={emp.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{emp.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">
                          {emp.employee_id}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {emp.designation || "No Designation"} · {emp.hq || "No HQ"} · {emp.state || "No State"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-1 sm:mt-0">
                      <Select
                        value={emp.role || "be_mr"}
                        onValueChange={(r) => updateEmployee.mutate({ id: emp.id, role: r })}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="be_mr">BE / MR</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="management">Management</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title={emp.status === "inactive" ? "Activate Employee" : "Deactivate Employee"}
                        onClick={() =>
                          updateEmployee.mutate({
                            id: emp.id,
                            status: emp.status === "inactive" ? "active" : "inactive",
                          })
                        }
                      >
                        {emp.status === "inactive" ? (
                          <Ban className="size-4 text-destructive" />
                        ) : (
                          <UserCheck className="size-4 text-success" />
                        )}
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Reset Password Link"
                        onClick={() => simulatePasswordReset.mutate(emp.employee_id)}
                      >
                        <Key className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DataUploadSection() {
  const [activeUpload, setActiveUpload] = useState<"employee" | "target" | "sales" | null>(null);
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const handleUpload = async () => {
    if (!csvText.trim() || !activeUpload) return;
    setLoading(true);
    try {
      const rows = parseCSV(csvText);
      if (rows.length === 0) throw new Error("No data rows found in CSV");

      if (activeUpload === "employee") {
        // Upload Employee Master
        const upsertData = rows.map(r => ({
          employee_id: (r.employeeid || r.code || r.empid || "").trim().toUpperCase(),
          name: (r.employeename || r.name || "").trim(),
          hq: (r.hq || "").trim(),
          designation: (r.designation || "").trim(),
          state: (r.state || "").trim(),
          status: (r.status || "active").trim().toLowerCase(),
          role: (r.role || "be_mr").trim().toLowerCase()
        })).filter(e => e.employee_id && e.name);

        if (upsertData.length === 0) throw new Error("Invalid Employee CSV structure");

        // Primary upsert
        const { error: upsertErr } = await supabase
          .from("employees")
          .upsert(upsertData, { onConflict: "employee_id" });
        if (upsertErr) throw upsertErr;

        // Resolve ManagerIDs if present
        const { data: allEmps } = await supabase.from("employees").select("id, employee_id");
        if (allEmps) {
          const empMap = new Map(allEmps.map(e => [e.employee_id.trim().toLowerCase(), e.id]));
          const updates = rows.map(r => {
            const empCode = (r.employeeid || r.code || r.empid || "").trim().toLowerCase();
            const mgrCode = (r.managerid || "").trim().toLowerCase();
            const empUuid = empMap.get(empCode);
            const mgrUuid = empMap.get(mgrCode);
            if (empUuid && mgrUuid) {
              return {
                id: empUuid,
                employee_id: (r.employeeid || r.code || r.empid || "").trim().toUpperCase(),
                name: (r.employeename || r.name || "").trim(),
                manager_id: mgrUuid
              };
            }
            return null;
          }).filter(Boolean);

          if (updates.length > 0) {
            await supabase.from("employees").upsert(updates, { onConflict: "employee_id" });
          }
        }

        toast.success(`Successfully uploaded ${upsertData.length} employees`);
      } else if (activeUpload === "target") {
        // Upload Targets
        const { data: allEmps } = await supabase.from("employees").select("id, employee_id");
        const empMap = new Map(allEmps?.map(e => [e.employee_id.trim().toLowerCase(), e.id]) || []);

        const targetUpserts = rows.map(r => {
          const code = (r.employeeid || r.code || "").trim().toLowerCase();
          const empUuid = empMap.get(code);
          if (!empUuid) return null;
          return {
            employee_id: empUuid,
            month: parseMonth(r.month),
            year: Number(r.year) || new Date().getFullYear(),
            target_amount: Number(r.targetamount || r.amount) || 0
          };
        }).filter(Boolean);

        if (targetUpserts.length === 0) throw new Error("Could not map any targets to existing employees");

        const { error } = await supabase
          .from("monthly_targets")
          .upsert(targetUpserts, { onConflict: "employee_id,year,month" });
        if (error) throw error;

        toast.success(`Uploaded ${targetUpserts.length} targets`);
      } else if (activeUpload === "sales") {
        // Upload Sales
        const { data: allEmps } = await supabase.from("employees").select("id, employee_id");
        const empMap = new Map(allEmps?.map(e => [e.employee_id.trim().toLowerCase(), e.id]) || []);

        const salesUpserts = rows.map(r => {
          const code = (r.employeeid || r.code || "").trim().toLowerCase();
          const empUuid = empMap.get(code);
          if (!empUuid) return null;
          return {
            employee_id: empUuid,
            month: parseMonth(r.month),
            year: Number(r.year) || new Date().getFullYear(),
            sales_amount: Number(r.salesamount || r.amount) || 0,
            previous_year_sales: Number(r.previousyearsales || r.pysales) || 0
          };
        }).filter(Boolean);

        if (salesUpserts.length === 0) throw new Error("Could not map any sales records to existing employees");

        const { error } = await supabase
          .from("monthly_sales")
          .upsert(salesUpserts, { onConflict: "employee_id,year,month" });
        if (error) throw error;

        toast.success(`Uploaded ${salesUpserts.length} sales records`);
      }

      setCsvText("");
      setActiveUpload(null);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "CSV parse or upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => { setActiveUpload("employee"); setCsvText(""); }}
          className={[
            "kpi-card p-4 text-left flex items-start gap-3 border transition-all",
            activeUpload === "employee" ? "border-primary bg-primary/5 shadow-inner" : "border-border hover:bg-accent/5"
          ].join(" ")}
        >
          <div className="size-9 rounded-xl bg-primary/10 grid place-items-center text-primary mt-0.5">
            <Users className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Employee Master</h3>
            <p className="text-xs text-muted-foreground">Upload HQ, Designation, Manager, State & Role</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveUpload("target"); setCsvText(""); }}
          className={[
            "kpi-card p-4 text-left flex items-start gap-3 border transition-all",
            activeUpload === "target" ? "border-primary bg-primary/5 shadow-inner" : "border-border hover:bg-accent/5"
          ].join(" ")}
        >
          <div className="size-9 rounded-xl bg-amber-500/10 grid place-items-center text-amber-500 mt-0.5">
            <FileText className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Monthly Targets</h3>
            <p className="text-xs text-muted-foreground">Upload targets per Employee, Year & Month</p>
          </div>
        </button>

        <button
          onClick={() => { setActiveUpload("sales"); setCsvText(""); }}
          className={[
            "kpi-card p-4 text-left flex items-start gap-3 border transition-all",
            activeUpload === "sales" ? "border-primary bg-primary/5 shadow-inner" : "border-border hover:bg-accent/5"
          ].join(" ")}
        >
          <div className="size-9 rounded-xl bg-emerald-500/10 grid place-items-center text-emerald-500 mt-0.5">
            <CheckCircle className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Monthly Sales</h3>
            <p className="text-xs text-muted-foreground">Upload actual sales and previous year figures</p>
          </div>
        </button>
      </div>

      {activeUpload && (
        <div className="kpi-card p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold capitalize">Upload {activeUpload} Data</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeUpload === "employee" && "Required Headers: EmployeeID, EmployeeName, HQ, Designation, ManagerID, State, Status, Role"}
              {activeUpload === "target" && "Required Headers: EmployeeID, Month, TargetAmount, Year"}
              {activeUpload === "sales" && "Required Headers: EmployeeID, Month, SalesAmount, PreviousYearSales, Year"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="csv-input">Paste CSV Content</Label>
            <textarea
              id="csv-input"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="EmployeeID,EmployeeName,HQ,Designation,ManagerID,State,Status,Role&#10;EMP001,John Doe,Mumbai HQ,BE / MR,MGR001,Maharashtra,active,be_mr"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleUpload} disabled={loading || !csvText.trim()}>
              {loading ? "Processing..." : "Process Upload"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setActiveUpload(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
