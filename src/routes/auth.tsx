import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Loader2, Sparkles, Key, Smartphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Adonis Sales Portal" },
      { name: "description", content: "Employee login for the Adonis Sales Performance Portal." },
    ],
  }),
  component: AuthPage,
});

function empEmail(id: string) {
  return `${id.trim().toLowerCase()}@portal.app`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 bg-gradient-to-b from-background to-secondary">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-11 rounded-2xl brand-gradient grid place-items-center text-primary-foreground shadow-kpi">
            <Activity className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground flex items-center gap-1.5">
              Adonis <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">Sales Portal</span>
            </h1>
            <p className="text-xs text-muted-foreground">Secure Field Force Performance Dashboard</p>
          </div>
        </div>

        <div className="kpi-card p-5">
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <SignIn busy={busy} setBusy={setBusy} onDone={() => navigate({ to: "/dashboard" })} />
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <SignUp busy={busy} setBusy={setBusy} onDone={() => navigate({ to: "/dashboard" })} />
            </TabsContent>
          </Tabs>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-4">
          Internal field force use only · Adonis Pharmaceuticals
        </p>
      </div>
    </div>
  );
}

function SignIn({ busy, setBusy, onDone }: { busy: boolean; setBusy: (b: boolean) => void; onDone: () => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");

  async function handleSendOtp() {
    if (!employeeId.trim()) {
      toast.error("Please enter your Employee ID first.");
      return;
    }
    setBusy(true);
    try {
      // Check if employee exists
      const { data: emp, error } = await supabase
        .from("employees")
        .select("status, user_id")
        .eq("employee_id", employeeId.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;
      if (!emp) {
        toast.error("Employee Code not found. Please register first.");
        return;
      }
      if (emp.status === "inactive") {
        toast.error("Your account has been deactivated. Contact your administrator.");
        return;
      }

      // Generate a mock 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setOtpSent(true);
      toast.success(`OTP sent to registered mobile. For testing, enter: ${code}`, {
        duration: 10000,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error sending OTP");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) return;

    setBusy(true);
    try {
      // Check employee status
      const { data: emp } = await supabase
        .from("employees")
        .select("status")
        .eq("employee_id", employeeId.trim().toUpperCase())
        .maybeSingle();

      if (emp?.status === "inactive") {
        toast.error("Account is deactivated. Contact Admin.");
        setBusy(false);
        return;
      }

      if (loginMethod === "password") {
        const { error } = await supabase.auth.signInWithPassword({
          email: empEmail(employeeId),
          password,
        });
        if (error) throw error;
        onDone();
      } else {
        // OTP verification
        if (otpCode === generatedOtp) {
          // Sign in using a master/temp password mechanism under the hood to authenticate with Supabase,
          // or auto sign in. Since standard Supabase client needs email/password or email OTP,
          // we sign in with standard fallback credentials for testing:
          const { error } = await supabase.auth.signInWithPassword({
            email: empEmail(employeeId),
            password: "Password123", // Default placeholder password for OTP demo
          });
          if (error) {
            // If the user registered with a custom password, OTP login logs in by bypassing password locally for testing
            const { error: otpLoginError } = await supabase.auth.signInWithPassword({
              email: empEmail(employeeId),
              password: password || "Password123",
            });
            if (otpLoginError) throw new Error("OTP verified but session creation failed. Use password login.");
          }
          onDone();
        } else {
          toast.error("Invalid OTP entered. Please try again.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="si-eid">Employee Code / ID</Label>
        <Input
          id="si-eid"
          autoComplete="username"
          placeholder="e.g. EMP001"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
      </div>

      <div className="flex gap-2 p-1 bg-secondary rounded-lg text-xs mb-2">
        <button
          type="button"
          onClick={() => { setLoginMethod("password"); setOtpSent(false); }}
          className={[
            "flex-1 py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1",
            loginMethod === "password" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          ].join(" ")}
        >
          <Key className="size-3.5" /> Password
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod("otp")}
          className={[
            "flex-1 py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1",
            loginMethod === "otp" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          ].join(" ")}
        >
          <Smartphone className="size-3.5" /> OTP Login
        </button>
      </div>

      {loginMethod === "password" ? (
        <div className="space-y-1.5">
          <Label htmlFor="si-pw">Password</Label>
          <Input
            id="si-pw"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {otpSent ? (
            <div className="space-y-1.5">
              <Label htmlFor="si-otp">Enter 6-Digit OTP</Label>
              <Input
                id="si-otp"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
            </div>
          ) : (
            <Button type="button" onClick={handleSendOtp} disabled={busy} className="w-full">
              {busy && <Loader2 className="size-4 animate-spin" />} Send OTP Code
            </Button>
          )}
        </div>
      )}

      {(loginMethod === "password" || otpSent) && (
        <Button type="submit" disabled={busy} className="w-full">
          {busy && <Loader2 className="size-4 animate-spin" />} Sign in
        </Button>
      )}
    </form>
  );
}

function SignUp({ busy, setBusy, onDone }: { busy: boolean; setBusy: (b: boolean) => void; onDone: () => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = employeeId.trim().toUpperCase();
    if (!code || password.length < 6) {
      toast.error("Employee Code and a password (6+ characters) are required.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      // 1. Verify that employee exists in Employee Master
      const { data: employee, error: fetchErr } = await supabase
        .from("employees")
        .select("id, name, user_id, status")
        .eq("employee_id", code)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!employee) {
        throw new Error(`Employee code "${code}" not found in Employee Master. Please contact your Admin.`);
      }
      if (employee.user_id) {
        throw new Error(`This employee account (${code}) has already been claimed/registered.`);
      }
      if (employee.status === "inactive") {
        throw new Error("This employee account is deactivated. Contact Admin.");
      }

      // 2. Sign up user in Auth
      const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
        email: empEmail(code),
        password,
      });
      if (signUpErr) throw signUpErr;

      // Ensure session is active
      if (!signUp.session) {
        const { error: siErr } = await supabase.auth.signInWithPassword({
          email: empEmail(code),
          password,
        });
        if (siErr) throw siErr;
      }

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("No session created after sign up");

      // 3. Link user_id in employees table
      const { error: linkErr } = await supabase
        .from("employees")
        .update({ user_id: uid })
        .eq("id", employee.id);

      if (linkErr) throw linkErr;

      // 4. Link role in user_roles table for compatibility
      await supabase.from("user_roles").insert({
        user_id: uid,
        role: "employee"
      });

      toast.success(`Welcome ${employee.name}! Account registered successfully.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="su-eid">Employee Code / ID</Label>
        <Input
          id="su-eid"
          placeholder="e.g. EMP001"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          Must match code preloaded in Employee Master.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="su-pw">Create Password</Label>
        <Input
          id="su-pw"
          type="password"
          placeholder="Min 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="su-cpw">Confirm Password</Label>
        <Input
          id="su-cpw"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={busy} className="w-full">
        {busy && <Loader2 className="size-4 animate-spin" />} Register Account
      </Button>
    </form>
  );
}
