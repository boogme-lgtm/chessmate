import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MessageThreadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: number;
  otherPartyName: string;
}

/**
 * Per-lesson message thread dialog. Polls every 10s while the dialog
 * is open so new messages from the other party show up without a
 * manual refresh.
 */
export default function MessageThread({
  open,
  onOpenChange,
  lessonId,
  otherPartyName,
}: MessageThreadProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState("");
  const [contentType, setContentType] = useState<"text" | "pgn">("text");
  const listEndRef = useRef<HTMLDivElement>(null);

  const thread = trpc.messages.getForLesson.useQuery(
    { lessonId },
    {
      enabled: open,
      refetchInterval: open ? 10000 : false,
    }
  );

  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      setDraft("");
      setContentType("text");
      utils.messages.getForLesson.invalidate({ lessonId });
      utils.messages.getUnreadCounts.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Auto-scroll to the latest message when new messages arrive
  useEffect(() => {
    if (thread.data && listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [thread.data]);

  const handleSend = () => {
    const content = draft.trim();
    if (!content) return;
    send.mutate({ lessonId, content, contentType });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Conversation with {otherPartyName}</DialogTitle>
          <DialogDescription>
            Messages are visible only to you and {otherPartyName}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border border-border/60 rounded-md p-3 space-y-3 bg-background/50">
          {thread.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : thread.data && thread.data.length > 0 ? (
            thread.data.map((msg: any) => {
              const isMine = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      isMine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.contentType === "pgn" ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs opacity-80">
                          <FileText className="h-3 w-3" /> PGN
                        </div>
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {msg.content}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    <div className="text-[10px] opacity-60 mt-1 text-right">
                      {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-center text-muted-foreground py-12">
              No messages yet. Start the conversation.
            </p>
          )}
          <div ref={listEndRef} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant={contentType === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => setContentType("text")}
            >
              Text
            </Button>
            <Button
              variant={contentType === "pgn" ? "default" : "outline"}
              size="sm"
              onClick={() => setContentType("pgn")}
            >
              PGN
            </Button>
          </div>
          <Textarea
            placeholder={
              contentType === "pgn"
                ? "Paste a PGN (e.g. 1. e4 e5 2. Nf3 Nc6 ...)"
                : "Type a message…"
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={contentType === "pgn" ? 5 : 3}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && contentType === "text") {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSend}
              disabled={send.isPending || draft.trim().length === 0}
              size="sm"
              className="gap-2"
            >
              {send.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
