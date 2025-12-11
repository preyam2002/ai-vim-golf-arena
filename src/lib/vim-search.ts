import { SearchMatch, VimOptions } from "./vim-types";

export function performSearch(
  lines: string[],
  pattern: string,
  startLine: number,
  startCol: number,
  direction: "forward" | "backward",
  options?: VimOptions
): SearchMatch[] {
  const matches: SearchMatch[] = [];

  const escapePattern = (text: string) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const buildRegex = (source: string, flags: string) => {
    try {
      return new RegExp(source, flags);
    } catch (_e) {
      // Fallback to literal match when the pattern is not a valid regex.
      return new RegExp(escapePattern(source), flags);
    }
  };

  try {
    const shouldIgnoreCase =
      !!options?.ignorecase &&
      (!options?.smartcase || pattern.toLowerCase() === pattern);
    const flags = `g${shouldIgnoreCase ? "i" : ""}`;
    const regex = buildRegex(pattern, flags);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;

      while ((match = regex.exec(line)) !== null) {
        matches.push({
          line: i,
          col: match.index,
          length: match[0].length,
        });
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    }
  } catch (e) {
    // Invalid regex, return empty matches
    return [];
  }

  // Sort matches by position (line first, then column)
  matches.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.col - b.col;
  });

  // Filter and reorder based on direction and cursor position
  // Filter and reorder based on direction and cursor position
  if (direction === "backward") {
    // For backward search: matches before cursor, in reverse order
    const beforeCursor = matches.filter(
      (m) => m.line < startLine || (m.line === startLine && m.col < startCol)
    );
    const afterCursor = matches.filter(
      (m) => m.line > startLine || (m.line === startLine && m.col >= startCol)
    );
    // Return beforeCursor reversed + afterCursor reversed (wrap around)
    return [...beforeCursor.reverse(), ...afterCursor.reverse()];
  } else {
    // For forward search: matches after cursor, in forward order
    const afterCursor = matches.filter(
      (m) => m.line > startLine || (m.line === startLine && m.col > startCol)
    );
    const beforeCursor = matches.filter(
      (m) => m.line < startLine || (m.line === startLine && m.col <= startCol)
    );
    // Return afterCursor + beforeCursor (wrap around)
    return [...afterCursor, ...beforeCursor];
  }
}
