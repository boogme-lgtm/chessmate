import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-lg mx-4 surface-flat rounded-2xl p-10 text-center">
        <h1 className="text-7xl font-thin tracking-tighter text-primary mb-2">404</h1>

        <h2 className="text-xl font-thin tracking-tighter mb-4">
          Page Not Found
        </h2>

        <p className="text-muted-foreground font-light leading-relaxed mb-8">
          Sorry, the page you are looking for doesn't exist.
          <br />
          It may have been moved or deleted.
        </p>

        <Button
          onClick={() => setLocation("/")}
          className="btn-editorial-primary px-6 py-2.5"
        >
          <Home className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </div>
    </div>
  );
}
