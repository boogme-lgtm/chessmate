import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Payment Cancelled Page
 * Shown when user cancels Stripe checkout
 */
export default function LessonPaymentCancel() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full"
      >
        <Card className="border-orange-500/20 bg-card">
          <CardContent className="pt-8 pb-8 space-y-6">
            {/* Cancel Icon */}
            <div className="flex justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}
              >
                <XCircle className="w-20 h-20 text-orange-500" />
              </motion.div>
            </div>

            {/* Cancel Message */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-light tracking-tight">
                Payment Cancelled
              </h1>
              <p className="text-lg text-muted-foreground font-light">
                Your booking was not completed
              </p>
            </div>

            {/* Explanation */}
            <div className="bg-muted/30 rounded-lg p-6 text-center">
              <p className="text-muted-foreground font-light">
                No charges were made to your account. Your selected time slot has not been reserved.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button asChild className="flex-1" size="lg">
                <Link href="/coaches">Browse Coaches</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1" size="lg">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
