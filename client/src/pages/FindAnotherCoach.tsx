import { useAuth } from "@/_core/hooks/useAuth";
import StudentMatchingPanel from "@/components/StudentMatchingPanel";
import { Link } from "wouter";

export default function FindAnotherCoach() {
  const { user, loading } = useAuth();
  return (
    <main className="container max-w-5xl py-8 space-y-6">
      <Link href="/dashboard?role=student" className="text-sm text-ember underline">Back to dashboard</Link>
      <h1 className="text-3xl font-semibold">Find Another Coach</h1>
      {loading ? <p role="status">Loading your account.</p>
        : user && user.userType !== "coach" ? <StudentMatchingPanel />
        : <p>Sign in with your student account to view and edit matching answers.</p>}
      <Link href="/coaches" className="inline-block text-ember underline">Browse all coaches</Link>
    </main>
  );
}
