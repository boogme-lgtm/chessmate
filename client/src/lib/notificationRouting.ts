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
  // Always sent to the coach — use ?role=coach so Dashboard forces the coach view.
  // NOTE: /coach/dashboard redirects to /dashboard and loses the hash, so we
  // route everything through /dashboard?role= instead.
  if (type === "new_content_request") return "/dashboard?role=coach#content-requests";
  if (type === "new_subscriber")      return "/dashboard?role=coach#students";
  // Always sent to the student
  if (type === "content_delivered")   return "/dashboard?role=student#content-library";

  // Prefer the stored recipientRole; fall back to userType (default coach for "both").
  const isCoach = recipientRole
    ? recipientRole === "coach"
    : userType === "coach" || userType === "both";

  switch (type) {
    case "new_message":
      return isCoach ? "/dashboard?role=coach#inbox" : "/dashboard?role=student#messages";
    case "new_review":
      return isCoach ? "/dashboard?role=coach#reviews" : "/dashboard?role=student";
    case "lesson_booked":
    case "lesson_confirmed":
    case "lesson_cancelled":
    case "lesson_completed":
      return isCoach
        ? "/dashboard?role=coach#schedule"
        : "/dashboard?role=student#lessons";
    default:
      return isCoach ? "/dashboard?role=coach" : "/dashboard?role=student";
  }
}
