import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: number;
  otherPartyName: string;
  reviewingAs: "student" | "coach";
}

interface StarRatingProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function StarRating({ label, value, onChange }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            className="p-0.5"
            onMouseEnter={() => setHover(i)}
            onClick={() => onChange(i)}
            aria-label={`${label}: ${i} star${i > 1 ? "s" : ""}`}
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                i <= active
                  ? "fill-yellow-500 text-yellow-500"
                  : "text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
        {value > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">{value}/5</span>
        )}
      </div>
    </div>
  );
}

/**
 * Airbnb-style mutual review form. Used after a lesson is completed
 * by either the student or the coach. Both reviews are hidden until
 * both sides submit.
 */
export default function ReviewDialog({
  open,
  onOpenChange,
  lessonId,
  otherPartyName,
  reviewingAs,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [knowledgeRating, setKnowledgeRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [preparednessRating, setPreparednessRating] = useState(0);
  const [comment, setComment] = useState("");

  const utils = trpc.useUtils();
  const submit = trpc.review.submit.useMutation({
    onSuccess: (data) => {
      if (data.bothSubmitted) {
        toast.success("Review submitted! Both reviews are now visible.");
      } else {
        toast.success("Review submitted! It will become visible once the other party reviews.");
      }
      utils.review.getPending.invalidate();
      utils.coach.getReviews.invalidate();
      onOpenChange(false);
      reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const reset = () => {
    setRating(0);
    setKnowledgeRating(0);
    setCommunicationRating(0);
    setPreparednessRating(0);
    setComment("");
  };

  const handleSubmit = () => {
    if (rating < 1) {
      toast.error("Please select an overall rating");
      return;
    }
    submit.mutate({
      lessonId,
      rating,
      comment: comment.trim() || undefined,
      knowledgeRating: knowledgeRating || undefined,
      communicationRating: communicationRating || undefined,
      preparednessRating: preparednessRating || undefined,
    });
  };

  const title =
    reviewingAs === "student"
      ? `Review your lesson with ${otherPartyName}`
      : `Review your student ${otherPartyName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Your review is kept private until both parties submit theirs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <StarRating label="Overall experience" value={rating} onChange={setRating} />

          {reviewingAs === "student" && (
            <>
              <StarRating
                label="Chess knowledge"
                value={knowledgeRating}
                onChange={setKnowledgeRating}
              />
              <StarRating
                label="Communication"
                value={communicationRating}
                onChange={setCommunicationRating}
              />
              <StarRating
                label="Preparedness"
                value={preparednessRating}
                onChange={setPreparednessRating}
              />
            </>
          )}

          {reviewingAs === "coach" && (
            <StarRating
              label="Engagement & effort"
              value={communicationRating}
              onChange={setCommunicationRating}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="review-comment">Comments (optional)</Label>
            <Textarea
              id="review-comment"
              placeholder="Share what went well or what could improve…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              {comment.length}/2000 characters
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submit.isPending}
          >
            Later
          </Button>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? "Submitting…" : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
