import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminWaitlist() {
  const { data: waitlistEntries, isLoading, error } = trpc.admin.waitlist.list.useQuery();

  const exportToCSV = () => {
    if (!waitlistEntries || waitlistEntries.length === 0) {
      toast.error("No data to export");
      return;
    }

    // Create CSV header
    const headers = ["Email", "Name", "User Type", "Referral Source", "Signup Date", "Confirmation Email Sent", "Nurture Email 1", "Nurture Email 2", "Nurture Email 3", "Nurture Email 4", "Nurture Email 5"];
    
    // Create CSV rows
    const rows = waitlistEntries.map(entry => [
      entry.email,
      entry.name || "N/A",
      entry.userType,
      entry.referralSource || "N/A",
      format(new Date(entry.createdAt), "yyyy-MM-dd HH:mm:ss"),
      entry.confirmationEmailSent ? "Yes" : "No",
      entry.nurtureEmail1Sent ? "Yes" : "No",
      entry.nurtureEmail2Sent ? "Yes" : "No",
      entry.nurtureEmail3Sent ? "Yes" : "No",
      entry.nurtureEmail4Sent ? "Yes" : "No",
      entry.nurtureEmail5Sent ? "Yes" : "No",
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `boogme-waitlist-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("CSV exported successfully");
  };

  if (error) {
    return (
      <div className="container py-12">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to view this page. Admin access required.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Waitlist Management</h1>
        <p className="text-muted-foreground">View and export all waitlist signups</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Waitlist Entries
              </CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${waitlistEntries?.length || 0} total signups`}
              </CardDescription>
            </div>
            <Button
              onClick={exportToCSV}
              disabled={isLoading || !waitlistEntries || waitlistEntries.length === 0}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : waitlistEntries && waitlistEntries.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Referral</TableHead>
                    <TableHead>Signup Date</TableHead>
                    <TableHead>Emails Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waitlistEntries.map((entry) => {
                    const emailsSent = [
                      entry.confirmationEmailSent,
                      entry.nurtureEmail1Sent,
                      entry.nurtureEmail2Sent,
                      entry.nurtureEmail3Sent,
                      entry.nurtureEmail4Sent,
                      entry.nurtureEmail5Sent,
                    ].filter(Boolean).length;

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.email}</TableCell>
                        <TableCell>{entry.name || "—"}</TableCell>
                        <TableCell>
                          <span className="capitalize">{entry.userType}</span>
                        </TableCell>
                        <TableCell>{entry.referralSource || "—"}</TableCell>
                        <TableCell>
                          {format(new Date(entry.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {emailsSent}/6
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No waitlist entries yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
