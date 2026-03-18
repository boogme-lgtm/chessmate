import { useEffect, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Calendar, Clock, User, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import LessonPaymentCancel from "./LessonPaymentCancel";

/**
 * Payment Success Page
 * Shown after successful Stripe checkout
 */
export default function LessonPaymentSuccess() {
  const [, params] = useRoute("/lessons/:id");
  const [location, navigate] = useLocation();
  const lessonId = params?.id ? parseInt(params.id) : null;
  
  // Check if payment was cancelled
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const paymentStatus = searchParams.get('payment');

  const { data: lesson, isLoading } = trpc.booking.getBookingById.useQuery(
    { id: lessonId! },
    { enabled: !!lessonId && paymentStatus !== 'cancelled' }
  );

  // Show cancel page if payment was cancelled (after all hooks)
  if (paymentStatus === 'cancelled') {
    return <LessonPaymentCancel />;
  }

  // Removed auto-redirect - let users navigate manually via buttons

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">Lesson not found</p>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <Card className="border-green-500/20 bg-card">
          <CardContent className="pt-8 pb-8 space-y-6">
            {/* Success Icon */}
            <div className="flex justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <CheckCircle2 className="w-20 h-20 text-green-500" />
              </motion.div>
            </div>

            {/* Success Message */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-light tracking-tight">
                Payment Successful!
              </h1>
              <p className="text-lg text-muted-foreground font-light">
                Your lesson has been booked
              </p>
            </div>

            {/* Lesson Details */}
            <div className="bg-muted/30 rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground font-light">Coach</p>
                  <p className="font-light">{lesson.coachName || "Coach"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground font-light">Date & Time</p>
                  <p className="font-light">
                    {new Date(lesson.scheduledAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="font-light">
                    {new Date(lesson.scheduledAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground font-light">Duration</p>
                  <p className="font-light">{lesson.durationMinutes} minutes</p>
                </div>
              </div>
            </div>

            {/* Payment Protection Notice */}
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-sm text-center font-light text-green-600 dark:text-green-400">
                Your payment is held securely until after your lesson. You'll only be charged once both you and your coach confirm the lesson was completed.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button asChild className="flex-1" size="lg">
                <Link href="/dashboard">View My Bookings</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1" size="lg">
                <Link href="/coaches">Book Another Lesson</Link>
              </Button>
            </div>


          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
