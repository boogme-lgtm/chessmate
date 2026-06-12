/**
 * AnnotationToolbar (Sprint 50) — NAG glyph toggle buttons for analysis mode.
 *
 * Works with GLYPHS ("!", "?!", "±", …) — the same representation PgnNode.nags
 * uses after parsing and that MoveList renders — NOT raw "$N" tokens. The
 * serializer converts glyphs back to suffix text / $N tokens on save.
 */

const NAGS: Array<{ glyph: string; title: string }> = [
  { glyph: "!", title: "Good move" },
  { glyph: "?", title: "Mistake" },
  { glyph: "!!", title: "Brilliant move" },
  { glyph: "??", title: "Blunder" },
  { glyph: "!?", title: "Interesting move" },
  { glyph: "?!", title: "Dubious move" },
  { glyph: "=", title: "Equal position" },
  { glyph: "±", title: "White is better" },
  { glyph: "∓", title: "Black is better" },
];

export function AnnotationToolbar({
  activeNags,
  onToggleNag,
  disabled,
}: {
  activeNags: string[];
  onToggleNag: (glyph: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {NAGS.map(({ glyph, title }) => (
        <button
          key={glyph}
          type="button"
          title={title}
          disabled={disabled}
          onClick={() => onToggleNag(glyph)}
          className={`text-xs font-mono px-2 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            activeNags.includes(glyph)
              ? "bg-primary/20 border-primary/50 text-primary"
              : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          {glyph}
        </button>
      ))}
    </div>
  );
}
