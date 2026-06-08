import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Shield, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import BookingCalendar from "./BookingCalendar";

interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coach: {
    id: number;
    name: string | null;
    profile?: {
      hourlyRateCents: number | null;
      minAdvanceHours?: number | null;
      maxAdvanceDays?: number | null;
      bufferMinutes?: number | null;
      lessonDurations?: string | null;
    };
  };
}

/**
 * Booking Modal Component
 * Handles the complete booking flow: calendar → details → payment
 * Simple 3-step process with clear progress indication
 */
export default function BookingModal({ open, onOpenChange, coach }: BookingModalProps) {
  const [step, setStep] = useState<"calendar" | "details" | "payment">("calendar");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [notes, setNotes] = useState("");
  const [bookedLessonId, setBookedLessonId] = useState<number | null>(null);

  const createBooking = trpc.lesson.book.useMutation();
  const createCheckout = trpc.payment.createCheckout.useMutation();

  const profile = coach.profile;
  const hourlyRateCents = profile?.hourlyRateCents || 5000;
  const lessonDurations = (() => {
    if (!profile?.lessonDurations) return [60];
    try { return JSON.parse(profile.lessonDurations); } catch { return [60]; }
  })();

  const calculatePrice = (duration: number) => {
    return ((hourlyRateCents / 100) * (duration / 60)).toFixed(2);
  };

  const handleSelectSlot = (slot: TimeSlot, duration: number) => {
    setSelectedSlot(slot);
    setSelectedDuration(duration);
    setStep("details");
  };

  const handleBack = () => {
    if (step === "details") {
      setStep("calendar");
    } else if (step === "payment") {
      setStep("details");
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;

    try {
      // Create the booking — status starts as 'pending_payment'.
      // Student pays first, then coach accepts/declines (payment-first model).
      const result = await createBooking.mutateAsync({
        coachId: coach.id,
        scheduledAt: selectedSlot.start,
        durationMinutes: selectedDuration,
        topic: notes || undefined,
      });

      // Persist the lesson id so "Pay Now" can start checkout, then show the
      // persistent payment prompt (no auto-dismiss — the student must choose).
      setBookedLessonId(result.lessonId);
      setStep("payment");
    } catch (error: any) {
      toast.error(error.message || "Failed to create booking");
      setStep("details");
    }
  };

  const handlePayNow = async () => {
    if (!bookedLessonId) return;
    try {
      const { url } = await createCheckout.mutateAsync({ lessonId: bookedLessonId });
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Could not start checkout. Please pay from your dashboard.");
      }
    } catch (error: any) {
      toast.error(error.message || "Could not start checkout. Please pay from your dashboard.");
    }
  };

  const resetModal = () => {
    setStep("calendar");
    setSelectedSlot(null);
    setSelectedDuration(60);
    setNotes("");
    setBookedLessonId(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetModal();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "calendar" && "Select a Time"}
            {step === "details" && "Booking Details"}
            {step === "payment" && "Complete Your Payment"}
          </DialogTitle>
          <DialogDescription>
            {step === "calendar" && `Choose an available time slot with ${coach.name}`}
            {step === "details" && "Review your booking and add any notes for your coach"}
            {step === "payment" && "Your lesson is reserved — payment is required to confirm it"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Calendar */}
        {step === "calendar" && (
          <BookingCalendar
            coachId={coach.id}
            hourlyRateCents={hourlyRateCents}
            minAdvanceHours={profile?.minAdvanceHours}
            maxAdvanceDays={profile?.maxAdvanceDays}
            bufferMinutes={profile?.bufferMinutes}
            lessonDurations={lessonDurations}
            onSelectSlot={handleSelectSlot}
          />
        )}

        {/* Step 2: Details */}
        {step === "details" && selectedSlot && (
          <div className="space-y-6">
            {/* Booking Summary */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Coach</span>
                <span className="font-medium">{coach.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Date & Time</span>
                <span className="font-medium">
                  {format(selectedSlot.start, "EEEE, MMMM d 'at' h:mm a")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="font-medium">{selectedDuration} minutes</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold">${calculatePrice(selectedDuration)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes for your coach (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Share your goals, specific topics you'd like to cover, or any questions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Payment Protection */}
            <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Shield className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-green-600 mb-1">Payment Protection</div>
                <div className="text-muted-foreground">
                  Your payment is collected upfront and held securely. If the coach declines or you cancel before the lesson, you'll receive a full refund. After the lesson, you have 24 hours to raise any issues.
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleConfirmBooking}
                disabled={createBooking.isPending}
                className="flex-1"
              >
                {createBooking.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Request...
                  </>
                ) : (
                  "Send Booking Request"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Booking created — persistent payment prompt (S44-1) */}
        {step === "payment" && selectedSlot && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 shrink-0" />
              <div>
                <h3 className="text-lg font-semibold">Lesson reserved</h3>
                <p className="text-sm text-muted-foreground">
                  Complete payment to confirm. Until you pay, this stays in{" "}
                  <span className="font-medium">Awaiting Payment</span> on your dashboard
                  and {coach.name} is not notified.
                </p>
              </div>
            </div>

            {/* Lesson summary */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Coach</span>
                <span className="font-medium">{coach.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Date & Time</span>
                <span className="font-medium">
                  {format(selectedSlot.start, "EEEE, MMMM d 'at' h:mm a")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="font-medium">{selectedDuration} minutes</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold">${calculatePrice(selectedDuration)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={createCheckout.isPending}
              >
                Pay Later
              </Button>
              <Button
                onClick={handlePayNow}
                disabled={createCheckout.isPending}
                className="flex-1"
              >
                {createCheckout.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redirecting…
                  </>
                ) : (
                  "Pay Now"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
