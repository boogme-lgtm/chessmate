import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Shield, Trash2, User, Bell } from "lucide-react";
import { COUNTRIES } from "@shared/countries";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Toronto", "America/Vancouver",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome",
  "Europe/Amsterdam", "Europe/Brussels", "Europe/Vienna", "Europe/Stockholm",
  "Europe/Oslo", "Europe/Copenhagen", "Europe/Helsinki", "Europe/Warsaw",
  "Europe/Prague", "Europe/Budapest", "Europe/Bucharest", "Europe/Sofia",
  "Europe/Athens", "Europe/Lisbon", "Europe/Dublin", "Europe/Moscow",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok", "Asia/Singapore",
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Asia/Hong_Kong",
  "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland",
];

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && !user) setLocation("/");
  }, [authLoading, user, setLocation]);

  if (authLoading || !user) return null;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="container py-8 max-w-2xl space-y-8">
          <div>
            <h1 className="text-3xl font-semibold">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
          </div>

          <ProfileSection />
          <PasswordSection loginMethod={(user as any)?.loginMethod} />
          <NotificationSection />
          <DangerSection loginMethod={(user as any)?.loginMethod} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function ProfileSection() {
  const { data: profile, isLoading } = trpc.user.getProfile.useQuery();
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => toast.success("Profile updated"),
    onError: (err) => toast.error(err.message),
  });

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setBio(profile.bio || "");
      setCountry(profile.country || "");
      setTimezone(profile.timezone || "");
    }
  }, [profile]);

  if (isLoading) return <SettingsSkeleton />;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-4 w-4" /> Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input value={profile?.email || ""} disabled className="mt-1 opacity-60" />
          <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
        </div>
        <div>
          <Label>Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="mt-1 resize-none" rows={3} maxLength={500} />
          <p className="text-xs text-muted-foreground mt-1">{bio.length}/500</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={() => updateProfile.mutate({ name: name || undefined, bio: bio || undefined, country: country || undefined, timezone: timezone || undefined })}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordSection({ loginMethod }: { loginMethod?: string }) {
  const isOAuth = loginMethod === "google" || loginMethod === "oauth";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-4 w-4" /> Password & Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOAuth ? (
          <div className="flex items-center gap-3 py-2">
            <Badge variant="secondary" className="text-xs">Google</Badge>
            <span className="text-sm text-muted-foreground">Signed in with Google — no password to manage</span>
          </div>
        ) : (
          <>
            <div>
              <Label>Current password</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>New password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1" />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSubmit} disabled={changePassword.isPending || !currentPassword || !newPassword}>
                {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Change Password
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationSection() {
  const { data: profile } = trpc.user.getProfile.useQuery();
  const updatePrefs = trpc.user.updateNotificationPreferences.useMutation({
    onSuccess: () => toast.success("Preferences saved"),
    onError: (err) => toast.error(err.message),
  });

  const [prefs, setPrefs] = useState({
    bookingConfirmations: true,
    lessonReminders: true,
    newReviews: true,
    marketing: false,
  });

  useEffect(() => {
    if (profile?.notificationPreferences) {
      setPrefs(profile.notificationPreferences);
    }
  }, [profile]);

  const toggle = (key: keyof typeof prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    updatePrefs.mutate(updated);
  };

  const items = [
    { key: "bookingConfirmations" as const, label: "Booking confirmations", desc: "Email when a lesson is booked or confirmed" },
    { key: "lessonReminders" as const, label: "Lesson reminders", desc: "24-hour reminder before upcoming lessons" },
    { key: "newReviews" as const, label: "New reviews", desc: "Email when someone leaves a review" },
    { key: "marketing" as const, label: "Platform updates", desc: "Product news and feature announcements" },
  ];

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-4 w-4" /> Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch checked={prefs[item.key]} onCheckedChange={() => toggle(item.key)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DangerSection({ loginMethod }: { loginMethod?: string }) {
  const isOAuth = loginMethod === "google" || loginMethod === "oauth";
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();

  const deleteAccount = trpc.user.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted");
      setTimeout(() => setLocation("/"), 1000);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-destructive">
          <Trash2 className="h-4 w-4" /> Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          This will permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">Delete Account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account, lessons, reviews, and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {!isOAuth && (
              <div>
                <Label>Enter your password to confirm</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAccount.mutate({ password: isOAuth ? undefined : password })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!isOAuth && !password}
              >
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function SettingsSkeleton() {
  return (
    <Card className="border-border/40">
      <CardContent className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
