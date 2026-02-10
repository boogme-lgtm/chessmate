import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Calendar, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Minimal user menu component showing logged-in status
 * Clean, elegant dropdown that maintains minimalist aesthetic
 */
export function UserMenu() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      toast.success("Signed out successfully");
      setLocation("/");
    },
  });

  const handleSignOut = () => {
    logoutMutation.mutate();
  };

  if (loading || !user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="gap-2 font-light hover:bg-transparent hover:text-primary transition-colors"
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-light">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => setLocation("/dashboard")}
          className="cursor-pointer"
        >
          <Calendar className="mr-2 h-4 w-4" />
          <span>My Bookings</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => toast.info("Settings coming soon")}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600"
          disabled={logoutMutation.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
