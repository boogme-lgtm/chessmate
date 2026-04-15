import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function SignIn() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const rawRedirect = new URLSearchParams(searchParams).get("redirect") || "/";
  // Prevent open redirect: only allow relative paths
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : "/";
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      setError("");
      // Clear stored redirect from localStorage
      localStorage.removeItem("postLoginRedirect");
      // Invalidate auth query to force refetch on next page
      console.log("[SignIn] Login successful, invalidating auth cache");
      await utils.auth.me.invalidate();
      // Redirect immediately - the next page will load fresh user data
      console.log("[SignIn] Redirecting to:", redirect);
      window.location.href = redirect;
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    loginMutation.mutate({
      email,
      password,
    });
  };

  return (
    <div className="mesh-bg min-h-screen flex items-center justify-center p-4 relative">
      <div className="mesh-accent" />
      <div className="w-full max-w-[400px] glass-heavy rounded-[20px] p-7 relative z-10">
        <div className="text-center mb-6 space-y-3">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663188415081/Xkyng35xnYFybYAdmyVo96/boogme-logo-transparent_1ab89b8a.svg"
            alt="BooGMe"
            className="h-12 w-auto mx-auto"
          />
          <div>
            <h2 className="text-[24px] font-normal text-[#FAF8F5]">Welcome back</h2>
            <p className="body-muted text-[13px] mt-1">Sign in to your BooGMe account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.2)] px-3 py-2.5 text-[13px] text-[#F87171]">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[12px] text-white/60">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loginMutation.isPending}
              required
              autoFocus
              className="glass-input"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[12px] text-white/60">Password</label>
              <Link
                href="/forgot-password"
                className="text-[12px] text-[#C27A4A] hover:text-[#D08B5C] transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loginMutation.isPending}
                required
                className="glass-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-[#FAF8F5] transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-glass-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-60"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign In
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-[10px] uppercase tracking-[1.5px] text-white/25 bg-transparent">
                Or continue with
              </span>
            </div>
          </div>

          <button
            type="button"
            className="glass rounded-[10px] w-full py-3 inline-flex items-center justify-center gap-2 text-[14px] text-[#FAF8F5]/80 hover:text-[#FAF8F5] transition-colors"
            onClick={() => {
              localStorage.setItem("postLoginRedirect", redirect);
              window.location.href = getLoginUrl();
            }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <p className="text-[13px] text-center text-white/35 pt-1">
            Don't have an account?{" "}
            <Link
              href={`/register?redirect=${encodeURIComponent(redirect)}`}
              className="text-[#C27A4A] hover:text-[#D08B5C] transition-colors font-medium"
            >
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
