export interface MessageLesson {
  id: number;
  coachId: number;
  studentId: number;
  coachName?: string | null;
  studentName?: string | null;
  topic?: string | null;
  status?: string | null;
  scheduledAt: Date | string;
}

/** Keep the dashboard's existing order within each participant group. */
export function groupMessageLessons(lessons: MessageLesson[], role: "student" | "coach", counts: Record<number, number> = {}) {
  const groups = new Map<number, { id: number; name: string; lessons: MessageLesson[]; unread: number }>();
  for (const lesson of lessons) {
    const id = role === "student" ? lesson.coachId : lesson.studentId;
    const name = role === "student" ? lesson.coachName || `Coach #${id}` : lesson.studentName || `Student #${id}`;
    const group = groups.get(id) || { id, name, lessons: [], unread: 0 };
    group.lessons.push(lesson);
    group.unread += counts[lesson.id] || 0;
    groups.set(id, group);
  }
  return Array.from(groups.values());
}

export function messageClassTitle(lesson: MessageLesson) {
  if (lesson.status === "subscription_dm") return "Direct chat";
  return lesson.topic?.trim() || `Class #${lesson.id}`;
}
