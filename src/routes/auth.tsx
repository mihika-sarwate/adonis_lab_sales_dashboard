import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Activity, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Pharmaceutical Sales Portal" },
      {
        name: "description",
        content: "Secure access for pharmaceutical field force and leadership teams.",
      },
    ],
  }),
  component: AuthPage,
});

function employeeEmail(employeeCode: string) {
  return `${employeeCode.trim().toLowerCase()}@portal.app`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 bg-gradient-to-b from-background via-background to-secondary/40">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-11 rounded-2xl brand-gradient grid place-items-center text-primary-foreground shadow-kpi">
            <Activity className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground">
              Pharma{" "}
              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                Sales Portal
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Secure performance management for the field force
            </p>
          </div>
        </div>

        <div className="kpi-card p-5">
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <SignIn busy={busy} setBusy={setBusy} onDone={() => navigate({ to: "/dashboard" })} />
            </TabsContent>
            <TabsContent value="register" className="mt-4">
              <SignUp busy={busy} setBusy={setBusy} onDone={() => navigate({ to: "/dashboard" })} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-4 flex flex-col gap-2 text-center text-xs text-muted-foreground">
          <Link
            to="/forgot-password"
            className="inline-flex items-center justify-center gap-1 hover:text-foreground"
          >
            <Mail className="size-3.5" />
            Forgot password
          </Link>
          <Link
            to="/reset-password"
            className="inline-flex items-center justify-center gap-1 hover:text-foreground"
          >
            <KeyRound className="size-3.5" />
            Reset password
          </Link>
        </div>
      </div>
    </div>
  );
}

function SignIn({
  busy,
  setBusy,
  onDone,
}: {
  busy: boolean;
  setBusy: (value: boolean) => void;
  onDone: () => void;
}) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const code = employeeCode.trim().toUpperCase();
    if (!code || !password) {
      toast.error("Employee code and password are required.");
      return;
    }

    setBusy(true);
    try {
      const { data: lookup, error: lookupError } = await supabase.rpc("lookup_signup_employee", {
        _employee_code: code,
      });

      if (lookupError) throw lookupError;
      const employee = lookup?.[0];
      if (!employee) throw new Error("Employee code not found.");
      if (!employee.active) throw new Error("This account has been deactivated.");

      const { error } = await supabase.auth.signInWithPassword({
        email: employeeEmail(code),
        password,
      });
      if (error) throw error;

      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="signin-code">Employee Code</Label>
        <Input
          id="signin-code"
          autoComplete="username"
          placeholder="e.g. EMP001"
          value={employeeCode}
          onChange={(event) => setEmployeeCode(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <Button type="submit" disabled={busy} className="w-full">
        {busy && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

function SignUp({
  busy,
  setBusy,
  onDone,
}: {
  busy: boolean;
  setBusy: (value: boolean) => void;
  onDone: () => void;
}) {
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const code = employeeCode.trim().toUpperCase();
    if (!code || password.length < 8) {
      toast.error("Employee code and an 8+ character password are required.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { data: lookup, error: lookupError } = await supabase.rpc("lookup_signup_employee", {
        _employee_code: code,
      });

      if (lookupError) throw lookupError;
      const employee = lookup?.[0];
      if (!employee) throw new Error("Employee code not found in the employee master.");
      if (!employee.active) throw new Error("This employee is inactive.");
      if (employee.auth_user_id) throw new Error("This employee account has already been claimed.");

      const { data: signUp, error: signUpError } = await supabase.auth.signUp({
        email: employeeEmail(code),
        password,
      });
      if (signUpError) throw signUpError;

      if (!signUp.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: employeeEmail(code),
          password,
        });
        if (signInError) throw signInError;
      }

      const { error: claimError } = await supabase.rpc("claim_employee_account", {
        _employee_code: code,
        _role: employee.role,
      });
      if (claimError) throw claimError;

      toast.success(`Welcome ${employee.employee_name}! Your account is ready.`);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="signup-code">Employee Code</Label>
        <Input
          id="signup-code"
          autoComplete="username"
          placeholder="e.g. EMP001"
          value={employeeCode}
          onChange={(event) => setEmployeeCode(event.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          Use the employee code provided by admin.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-password">Create Password</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-confirm">Confirm Password</Label>
        <Input
          id="signup-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>

      <Button type="submit" disabled={busy} className="w-full">
        {busy && <Loader2 className="size-4 animate-spin" />}
        Create account
      </Button>
    </form>
  );
}
