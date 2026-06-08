import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

function AdminNav({ active }: { active: "applications" | "waitlist" | "disputes" | "system" }) {
  const links = [
    { href: "/admin/applications", label: "Applications", key: "applications" },
    { href: "/admin/waitlist", label: "Waitlist", key: "waitlist" },
    { href: "/admin/disputes", label: "Disputes & Payouts", key: "disputes" },
    { href: "/admin/system", label: "System", key: "system" },
  ] as const;
  return (
    <nav className="flex gap-2 mb-8 border-b border-border pb-4">
      {links.map((l) => (
        <Link key={l.key} href={l.href}>
          <span className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            active === l.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}>{l.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default function AdminSystem() {
  const { user, loading } = useAuth();
  const [to, setTo] = useState("");
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Default the recipient to the admin's own email once auth resolves.
  useEffect(() => {
    if (user?.email && !to) setTo(user.email);
  }, [user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  const testEmail = trpc.admin.system.testEmail.useMutation({
    onSuccess: (res) => {
      setLastResult(JSON.stringify(res));
      if (res.success) {
        toast.success(`Email sent — delivery is working. id: ${(res as any).id ?? "—"}`);
      } else {
        toast.error(`Send failed: ${JSON.stringify((res as any).error)}`, { duration: 10000 });
      }
    },
    onError: (err) => {
      setLastResult(JSON.stringify({ thrown: err.message }));
      toast.error(err.message);
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {user ? "Admin privileges are required to view this page." : "Please log in to continue."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold">System</h1>
          <p className="text-muted-foreground mt-2">Diagnostics &amp; delivery checks</p>
        </div>

        <AdminNav active="system" />

        <Card className="border-border/40">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-4 w-4" /> Email delivery test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sends a test email via Resend and shows the raw result. A{" "}
              <code className="font-mono">success: false</code> with a{" "}
              <code className="font-mono">401</code> means{" "}
              <code className="font-mono">RESEND_API_KEY</code> is missing or wrong in this
              environment.
            </p>
            <div>
              <Label htmlFor="test-email-to">Recipient</Label>
              <Input
                id="test-email-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="you@example.com"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => testEmail.mutate({ to })}
                disabled={testEmail.isPending || !to}
                className="gap-2"
              >
                {testEmail.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Test Email
              </Button>
            </div>
            {lastResult && (
              <pre className="text-xs bg-secondary/50 rounded-md p-3 overflow-x-auto">
                {lastResult}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
