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

  const createBooking = trpc.lesson.book.useMutation();
  const createCheckout = trpc.payment.createCheckout.useMutation();

  const profile = coach.profile;
  const hourlyRateCents = profile?.hourlyRateCents || 5000;
  const lessonDurations = profile?.lessonDurations 
    ? JSON.parse(profile.lessonDurations)
    : [60];

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
      setStep("payment");

      // Create the booking
      const booking = await createBooking.mutateAsync({
        coachId: coach.id,
        scheduledAt: selectedSlot.start,
        durationMinutes: selectedDuration,
        topic: notes || undefined,
      });

      // Create Stripe checkout session
      const checkout = await createCheckout.mutateAsync({
        lessonId: booking.lessonId,
      });

      // Redirect to Stripe checkout
      if (checkout.url) {
        window.open(checkout.url, "_blank");
      } else {
        throw new Error("Failed to create checkout session");
      }
      
      toast.success("Redirecting to secure payment...");
      
      // Close modal after short delay
      setTimeout(() => {
        onOpenChange(false);
        resetModal();
      }, 2000);

    } catch (error: any) {
      toast.error(error.message || "Failed to create booking");
      setStep("details");
    }
  };

  const resetModal = () => {
    setStep("calendar");
    setSelectedSlot(null);
    setSelectedDuration(60);
    setNotes("");
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
            {step === "payment" && "Processing..."}
          </DialogTitle>
          <DialogDescription>
            {step === "calendar" && `Choose an available time slot with ${coach.name}`}
            {step === "details" && "Review your booking and add any notes for your coach"}
            {step === "payment" && "Creating your booking and redirecting to payment..."}
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
                  Your payment is held securely until after your lesson. You'll only be charged once both you and your coach confirm the lesson was completed.
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
                disabled={createBooking.isPending || createCheckout.isPending}
                className="flex-1"
              >
                {createBooking.isPending || createCheckout.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Continue to Payment"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Payment Processing */}
        {step === "payment" && (
          <div className="py-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <CheckCircle2 className="h-8 w-8 text-green-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Creating your booking...</h3>
              <p className="text-sm text-muted-foreground">
                You'll be redirected to our secure payment page in a moment.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
