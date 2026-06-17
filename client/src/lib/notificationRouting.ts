/**
 * Notification routing — pure, dependency-free so it is unit-testable.
 *
 * Routing is based on the notification TYPE, not the user's current active role,
 * so a "both" account always lands on the correct side of the marketplace.
 *
 * For `new_message`, the recipient's role is stored on the notification
 * (`recipientRole`) at creation time — the only reliable signal of which side
 * a "both" account was acting as when they received the message.
 */
export function getNotificationUrl(
  type: string,
  userType: string | undefined,
  recipientRole?: "coach" | "student" | null,
): string {
  // Always sent to the coach
  if (type === "new_content_request") return "/coach/dashboard#content-requests";
  if (type === "new_subscriber") return "/coach/dashboard#students";
  // Always sent to the student
  if (type === "content_delivered") return "/dashboard#content-library";

  // Prefer the stored recipientRole; fall back to userType (default coach for "both").
  const isCoach = recipientRole
    ? recipientRole === "coach"
    : userType === "coach" || userType === "both";

  switch (type) {
    case "new_message":
      return isCoach ? "/coach/dashboard#inbox" : "/dashboard#messages";
    case "new_review":
      return isCoach ? "/coach/dashboard#reviews" : "/dashboard";
    case "lesson_booked":
    case "lesson_confirmed":
    case "lesson_cancelled":
    case "lesson_completed":
      return isCoach ? "/coach/dashboard#schedule" : "/dashboard#lessons";
    default:
      return isCoach ? "/coach/dashboard" : "/dashboard";
  }
}
