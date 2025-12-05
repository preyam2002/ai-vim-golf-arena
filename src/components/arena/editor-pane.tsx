interface EditorPaneProps {
  title: string;
  content: string;
  cursorLine?: number;
  cursorCol?: number;
  className?: string;
}

export function EditorPane({
  title,
  content,
  cursorLine,
  cursorCol,
  className = "",
}: EditorPaneProps) {
  const lines = content.split("\n");

  return (
    <div
      className={`neon-card flex flex-col rounded-2xl border border-white/10 bg-black/50 backdrop-blur-lg shadow-[0_30px_80px_-70px_var(--primary)] ${className}`}
    >
      <div className="flex-none flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-white/5 via-black/40 to-black/60 px-4 py-2">
        <span className="font-display text-sm font-semibold text-white">{title}</span>
        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
          {lines.length} lines, {content.length} chars
        </span>
      </div>
      <div className="flex-1 overflow-auto bg-black/60">
        <pre className="p-4 font-mono text-[13px] leading-relaxed">
          {lines.map((line, lineIdx) => (
            <div key={lineIdx} className="flex">
              <span className="mr-4 w-8 select-none text-right text-muted-foreground/70">
                {lineIdx + 1}
              </span>
              <span className="flex-1">
                {line.split("").map((char, colIdx) => {
                  const isCursor =
                    cursorLine === lineIdx && cursorCol === colIdx;
                  return (
                    <span
                      key={colIdx}
                      className={
                        isCursor
                          ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--primary)]"
                          : ""
                      }
                    >
                      {char || " "}
                    </span>
                  );
                })}
                {cursorLine === lineIdx && cursorCol === line.length && (
                  <span className="bg-primary text-primary-foreground"> </span>
                )}
                {line === "" && cursorLine !== lineIdx && (
                  <span className="text-muted-foreground/30">{"↵"}</span>
                )}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
