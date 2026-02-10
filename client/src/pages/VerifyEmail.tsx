import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const token = new URLSearchParams(searchParams).get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      setMessage(data.message);
    },
    onError: (err) => {
      setStatus("error");
      setMessage(err.message);
    },
  });

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link. No token provided.");
      return;
    }

    // Verify the email
    verifyMutation.mutate({ token });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <CardTitle className="text-2xl">Verifying Your Email</CardTitle>
              <CardDescription>Please wait while we verify your account...</CardDescription>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-2xl">Email Verified!</CardTitle>
              <CardDescription>Your account has been successfully verified</CardDescription>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl">Verification Failed</CardTitle>
              <CardDescription>We couldn't verify your email</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {message && (
            <Alert variant={status === "error" ? "destructive" : "default"}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {status === "success" && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              You can now sign in and start booking lessons with elite chess coaches.
            </p>
          )}

          {status === "error" && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              The verification link may have expired or is invalid. Please try registering again or contact support.
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          {status === "success" && (
            <Button
              className="w-full"
              onClick={() => {
                // Check if there's a stored redirect URL
                const storedRedirect = localStorage.getItem("postLoginRedirect");
                if (storedRedirect) {
                  setLocation(`/sign-in?redirect=${encodeURIComponent(storedRedirect)}`);
                } else {
                  setLocation("/sign-in");
                }
              }}
            >
              Sign In Now
            </Button>
          )}

          {status === "error" && (
            <>
              <Button
                className="w-full"
                onClick={() => setLocation("/register")}
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/")}
              >
                Go Home
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
