# Sprint 48 Handoff — Message Copy Button

## Context

The messaging system between coaches and students is working well. PGN files now send in full (Sprint 47 raised the limit to 500,000 chars and migrated the DB column to `mediumtext`). The one missing UX feature is a **copy-to-clipboard button** on message bubbles — critical for PGN workflows where the recipient needs to paste the PGN into a chess GUI.

## Task: S48-1 — Copy button on message bubbles

**File to edit:** `client/src/components/MessageThread.tsx`

### Current message bubble structure (lines ~108–143)

```tsx
<div className={`max-w-[80%] rounded-lg px-3 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
  {msg.contentType === "pgn" ? (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs opacity-80">
        <FileText className="h-3 w-3" /> PGN
      </div>
      <pre className="text-xs whitespace-pre-wrap font-mono">{msg.content}</pre>
    </div>
  ) : (
    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
  )}
  <div className="text-[10px] opacity-60 mt-1 text-right">
    {format(new Date(msg.createdAt), "MMM d, h:mm a")}
  </div>
</div>
```

### Required changes

1. **Add a `copiedId` state** to track which message was just copied:
   ```tsx
   const [copiedId, setCopiedId] = useState<number | null>(null);
   ```

2. **Add a `handleCopy` function**:
   ```tsx
   const handleCopy = (id: number, content: string) => {
     navigator.clipboard.writeText(content);
     setCopiedId(id);
     toast.success("Copied to clipboard");
     setTimeout(() => setCopiedId(null), 2000);
   };
   ```

3. **Wrap the bubble in a `group` div** and add a copy button:
   - The outer bubble div should become `relative group`
   - Add a copy button positioned `absolute top-1 right-1`
   - For PGN messages: show `<Clipboard className="h-3 w-3" /> Copy PGN` (small text + icon)
   - For text messages: show just `<Clipboard className="h-3 w-3" />` (icon only)
   - Button classes: `opacity-0 group-hover:opacity-100 transition-opacity` for text messages (hover to reveal)
   - For PGN messages: always visible (`opacity-60 hover:opacity-100`) since users will always need to copy
   - When `copiedId === msg.id`: show `<Check className="h-3 w-3" />` instead of clipboard icon
   - Button color: inherit from bubble (`text-primary-foreground` for own messages, `text-foreground` for others)

4. **Add imports**: `Clipboard`, `Check` from `lucide-react`; `toast` from `sonner`; `useState` (already imported)

### Design notes
- Keep the button subtle — it should not distract from reading the message
- The PGN block already has a header row (`<FileText /> PGN`) — place the copy button inline in that header row on the right side, not floating over the pre block
- For text bubbles, the copy button floats top-right over the bubble and only appears on hover
- Match the existing dark cyberpunk aesthetic — no white backgrounds, no card borders

### No backend changes needed
This is purely a frontend change in `MessageThread.tsx`. No tRPC procedures, no DB schema changes.

### Tests
Add to `server/sprint48.test.ts` — since this is a pure frontend feature with no server logic, a simple smoke test confirming the messages endpoint still returns `contentType` in the response is sufficient. Alternatively, skip the test file if there is truly nothing server-side to test and note this in the PR.

### Acceptance criteria
- [ ] Hovering any text message bubble reveals a copy icon button (top-right)
- [ ] PGN message bubbles always show "Copy PGN" in the PGN header row
- [ ] Clicking copy writes `msg.content` to clipboard and shows a "Copied to clipboard" toast
- [ ] The icon briefly changes to a checkmark for 2 seconds after copying
- [ ] No visual regression on the existing message layout
- [ ] TypeScript compiles clean, all existing tests pass
