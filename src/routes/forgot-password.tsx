import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Forgot Password · Pharmaceutical Sales Portal" }],
  }),
  component: ForgotPasswordPage,
});

function employeeEmail(employeeCode: string) {
  return `${employeeCode.trim().toLowerCase()}@portal.app`;
}

function ForgotPasswordPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const code = employeeCode.trim().toUpperCase();
    if (!code) {
      toast.error("Enter your employee code.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(employeeEmail(code), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSentTo(employeeEmail(code));
      toast.success("Password reset link sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send reset link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-background to-secondary/40">
      <div className="w-full max-w-md kpi-card p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Forgot Password</p>
          <h1 className="text-2xl font-semibold mt-1">Recover access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            We will send a secure reset link to the employee email alias.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="forgot-code">Employee Code</Label>
            <Input
              id="forgot-code"
              placeholder="e.g. EMP001"
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Send reset link
          </Button>
        </form>

        {sentTo && (
          <div className="rounded-xl border bg-muted/30 p-3 text-sm flex items-start gap-2">
            <Mail className="size-4 mt-0.5 shrink-0 text-primary" />
            <p>
              Reset instructions were sent to <span className="font-medium">{sentTo}</span>.
            </p>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          Back to{" "}
          <Link to="/auth" className="text-foreground underline underline-offset-4">
            sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
