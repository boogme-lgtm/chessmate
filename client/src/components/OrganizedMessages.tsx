import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { groupMessageLessons, messageClassTitle, type MessageLesson } from "@shared/messageOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MessageThread from "@/components/MessageThread";

export default function OrganizedMessages({ viewerRole = "student" }: {
  viewerRole?: "student" | "coach";
}) {
  const classes = trpc.messages.getClasses.useInfiniteQuery({ role: viewerRole }, {
    getNextPageParam: page => page.nextCursor, refetchInterval: 30000,
  });
  const lessons = classes.data?.pages.flatMap(page => page.items) || [];
  const unreadCounts: Record<number, number> = {};
  lessons.forEach(lesson => { unreadCounts[lesson.id] = Number(lesson.unread) || 0; });
  const groups = groupMessageLessons(lessons, viewerRole, unreadCounts);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const groupRefs = useRef(new Map<number, HTMLButtonElement>());
  const previousGroup = useRef<number | null>(null);
  useEffect(() => {
    if (selectedId !== null) {
      previousGroup.current = selectedId;
      backRef.current?.focus();
    } else if (previousGroup.current !== null) {
      groupRefs.current.get(previousGroup.current)?.focus();
    }
  }, [selectedId]);
  const selected = groups.find(group => group.id === selectedId);
  const [openLesson, setOpenLesson] = useState<MessageLesson | null>(null);
  return <Card className="bg-ink-raised border-border/20 rounded-sm">
    <CardContent className="p-4 sm:p-6 min-w-0">
      <h3 className="text-base font-semibold text-bone mb-4">Messages</h3>
      {classes.isLoading ? <p role="status">Loading coaches and classes…</p> : classes.isError ? <div role="alert">Could not load classes. <Button size="sm" onClick={() => classes.refetch()}>Retry</Button></div> : !groups.length ? <EmptyMessages viewerRole={viewerRole} /> : <>
        {selected ? <>
          <Button ref={backRef} variant="outline" size="sm" onClick={() => setSelectedId(null)} className="mb-3">Back to {viewerRole === "student" ? "coaches" : "students"}</Button>
          <h4 className="font-medium text-bone break-words mb-3">{selected.name}</h4>
          <ClassList lessons={selected.lessons} unreadCounts={unreadCounts} viewerRole={viewerRole} onOpen={setOpenLesson} />
        </> : <div className="space-y-2">
          {groups.map(group => <button key={group.id} ref={element => { if (element) groupRefs.current.set(group.id, element); else groupRefs.current.delete(group.id); }} type="button" onClick={() => setSelectedId(group.id)}
            className="flex w-full min-w-0 items-center gap-3 rounded-sm border border-border/30 p-3 text-left hover:bg-ink-deep/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember">
            <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-bone break-words">{group.name}</span>
              <span className="text-xs text-bone-muted">{group.lessons.filter(l => l.status !== "subscription_dm").length} classes{group.lessons.some(l => l.status === "subscription_dm") ? " · Direct chat" : ""}</span></span>
            {group.unread > 0 && <span className="text-xs text-ember shrink-0">{group.unread} unread</span>}
          </button>)}
        </div>}
      </>}
      {classes.hasNextPage && <Button variant="outline" size="sm" className="mt-3" disabled={classes.isFetchingNextPage} onClick={() => classes.fetchNextPage()}>{classes.isFetchingNextPage ? "Loading…" : "Load older classes"}</Button>}
      {openLesson && <MessageThread key={openLesson.id} open onOpenChange={open => { if (!open) setOpenLesson(null); }}
        lessonId={openLesson.id} otherPartyName={selected?.name || "Your coach"} viewerRole={viewerRole} classTitle={messageClassTitle(openLesson)} />}
    </CardContent>
  </Card>;
}

/** Students get a way to their first coach; coaches learn where messages come from. */
function EmptyMessages({ viewerRole }: { viewerRole: "student" | "coach" }) {
  if (viewerRole === "coach") {
    return <p className="text-sm text-bone-muted">No conversations yet. Messages appear here when students book lessons with you.</p>;
  }
  return <div>
    <p className="text-sm text-bone-muted mb-3">No conversations yet. Messages with your coach appear here once you book a lesson.</p>
    <Link href="/coaches" className="text-xs text-ember hover:text-ember/80 transition-colors">Find a coach →</Link>
  </div>;
}

function ClassList({ lessons, unreadCounts, viewerRole, onOpen }: {
  lessons: MessageLesson[]; unreadCounts?: Record<number, number>; viewerRole: "student" | "coach"; onOpen: (lesson: MessageLesson) => void;
}) {
  // Batches respect the existing API bound without silently dropping old classes.
  const batches = Array.from({ length: Math.ceil(lessons.length / 200) }, (_, i) => lessons.slice(i * 200, (i + 1) * 200));
  return <div className="space-y-2">{batches.map((batch, i) => <ClassBatch key={i} lessons={batch} unreadCounts={unreadCounts} viewerRole={viewerRole} onOpen={onOpen} />)}</div>;
}

function ClassBatch({ lessons, unreadCounts, viewerRole, onOpen }: Parameters<typeof ClassList>[0]) {
  const summaries = trpc.messages.getSummaries.useQuery({ lessonIds: lessons.map(l => l.id) }, { refetchInterval: 30000 });
  if (summaries.isLoading) return <p className="text-sm text-bone-muted" role="status">Loading classes…</p>;
  if (summaries.isError) return <div role="alert">Could not load correspondence. <Button size="sm" onClick={() => summaries.refetch()}>Retry</Button></div>;
  return <>{lessons.map(lesson => {
    const summary = summaries.data?.find(s => s.lessonId === lesson.id);
    const current = { ...lesson, topic: summary?.topic ?? lesson.topic };
    const unread = unreadCounts?.[lesson.id] || 0;
    return <div key={lesson.id} className="border border-border/30 rounded-sm p-3 min-w-0">
      <button type="button" onClick={() => onOpen(current)} className="text-left w-full min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember">
        <span className="block font-medium text-sm text-bone break-words">{messageClassTitle(current)}</span>
        {lesson.status !== "subscription_dm" && <span className="block text-xs text-bone-muted">{format(new Date(lesson.scheduledAt), "MMM d, yyyy · h:mm a")} · {lesson.status?.replaceAll("_", " ")}</span>}
        {summary?.latestContent ? <span className="block text-xs text-bone-muted truncate mt-1">{summary.latestContentType === "pgn" ? "PGN material" : summary.latestContent}</span>
          : <span className="block text-xs text-bone-muted mt-1">No correspondence</span>}
        {Number(summary?.materialCount) > 0 && <span className="block text-xs text-bone-muted">{summary?.materialCount} PGN materials in this thread</span>}
        {unread > 0 && <span className="block text-xs text-ember">{unread} unread</span>}
      </button>
      {viewerRole === "coach" && lesson.status !== "subscription_dm" && <TitleEditor lesson={current} />}
    </div>;
  })}</>;
}

function TitleEditor({ lesson }: { lesson: MessageLesson }) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (!editing && wasEditing.current) editRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  const [title, setTitle] = useState(lesson.topic || "");
  const utils = trpc.useUtils();
  const save = trpc.messages.setClassTitle.useMutation({
    onSuccess: () => { setEditing(false); utils.messages.getSummaries.invalidate(); utils.messages.getClasses.invalidate(); utils.lesson.myLessons.invalidate(); utils.lesson.coachLessons.invalidate(); toast.success("Class title saved"); },
    onError: error => toast.error(error.message),
  });
  return editing ? <form className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); if (!save.isPending && title.trim()) save.mutate({ lessonId: lesson.id, title }); }}>
    <label htmlFor={`class-title-${lesson.id}`} className="text-xs text-bone-muted">Class title (255 characters maximum)</label>
    <Input autoFocus id={`class-title-${lesson.id}`} value={title} maxLength={255} disabled={save.isPending} onChange={event => setTitle(event.target.value)}
      onKeyDown={event => { if (event.key === "Escape" && !save.isPending) { event.preventDefault(); setEditing(false); } }} />
    <div className="flex gap-2"><Button size="sm" disabled={save.isPending || !title.trim()} type="submit">{save.isPending ? "Saving…" : "Save"}</Button>
      <Button size="sm" variant="outline" type="button" disabled={save.isPending} onClick={() => setEditing(false)}>Cancel</Button></div>
  </form> : <Button ref={editRef} size="sm" variant="outline" className="mt-2" onClick={() => { setTitle(lesson.topic || ""); setEditing(true); }}>Edit class title</Button>;
}
