import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset Password · Pharmaceutical Sales Portal" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const code = new URL(window.location.href).searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !String(error.message).toLowerCase().includes("invalid")) {
          toast.error(error.message);
        }
      }
      if (mounted) setReady(true);
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-background to-secondary/40">
      <div className="w-full max-w-md kpi-card p-6 space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Reset Password</p>
          <h1 className="text-2xl font-semibold mt-1">Choose a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Open the reset email link first, then set a new password here.
          </p>
        </div>

        {!ready ? (
          <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            Preparing your secure reset session...
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              <KeyRound className="size-4" />
              Update password
            </Button>
          </form>
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
