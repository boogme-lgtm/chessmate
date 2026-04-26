import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";

export default function ReferralLanding() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (code) {
      localStorage.setItem("boogme_referral_code", code);
      toast.success("Referral applied! Sign up to get 10% off your first lesson.");
    }
    setLocation("/");
  }, [code, setLocation]);

  return null;
}
