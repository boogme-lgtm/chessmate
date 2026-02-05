import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useLocation } from "wouter";

export default function Unsubscribe() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState<string>("");
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);

  const unsubscribeMutation = trpc.waitlist.unsubscribe.useMutation({
    onSuccess: () => {
      setIsUnsubscribed(true);
    },
  });

  useEffect(() => {
    // Get email from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleUnsubscribe = () => {
    if (email) {
      unsubscribeMutation.mutate({ email });
    }
  };

  if (isUnsubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>You've Been Unsubscribed</CardTitle>
            <CardDescription>
              You won't receive any more emails from BooGMe.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-6">
              We're sorry to see you go. If you change your mind, you can always rejoin our waitlist.
            </p>
            <Button onClick={() => setLocation("/")} className="w-full">
              Return to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Unsubscribe from BooGMe Emails</CardTitle>
          <CardDescription>
            We're sorry to see you go. Click below to stop receiving emails from us.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {email ? (
            <>
              <p className="text-sm text-muted-foreground mb-6 text-center">
                Email: <span className="font-medium text-foreground">{email}</span>
              </p>
              <Button
                onClick={handleUnsubscribe}
                disabled={unsubscribeMutation.isPending}
                className="w-full"
                variant="destructive"
              >
                {unsubscribeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Unsubscribing...
                  </>
                ) : (
                  "Unsubscribe"
                )}
              </Button>
              {unsubscribeMutation.isError && (
                <p className="text-sm text-destructive mt-4 text-center">
                  Failed to unsubscribe. Please try again or contact support.
                </p>
              )}
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                No email address provided. Please use the unsubscribe link from your email.
              </p>
              <Button onClick={() => setLocation("/")} variant="outline" className="w-full">
                Return to Homepage
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
