import {
  findSentenceStartBackward,
  findSentenceStartForward,
  isWordChar,
  isWhitespace,
} from "./vim-utils";

export function getTextObject(
  lines: string[],
  line: number,
  col: number,
  modifier: "i" | "a",
  object: string
): {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
} | null {
  const currentLine = lines[line];

  // Word objects
  if (object === "w" || object === "W") {
    const lineLength = currentLine.length;
    if (lineLength === 0) return null;

    let anchor = Math.min(col, lineLength - 1);

    if (object === "w") {
      // For 'w', we need to handle word chars, punctuation, and whitespace separately
      const charType = (c: string) => {
        if (isWhitespace(c)) return "space";
        if (isWordChar(c)) return "word";
        return "punct";
      };

      const anchorType = charType(currentLine[anchor]);

      // If on whitespace, find next non-whitespace
      if (anchorType === "space") {
        let forward = anchor;
        while (
          forward < lineLength &&
          charType(currentLine[forward]) === "space"
        )
          forward++;
        if (forward < lineLength) {
          anchor = forward;
        } else {
          let backward = anchor - 1;
          while (backward >= 0 && charType(currentLine[backward]) === "space")
            backward--;
          if (backward < 0) return null;
          anchor = backward;
        }
      }

      const currentType = charType(currentLine[anchor]);
      let start = anchor;
      let end = anchor;

      // Find boundaries based on character type
      while (start > 0 && charType(currentLine[start - 1]) === currentType)
        start--;
      while (
        end < lineLength - 1 &&
        charType(currentLine[end + 1]) === currentType
      )
        end++;

      if (modifier === "a") {
        // Include trailing whitespace when available; otherwise, include leading whitespace
        let after = end + 1;
        while (after < lineLength && isWhitespace(currentLine[after])) after++;
        if (after > end + 1) {
          end = after - 1;
        } else if (start > 0) {
          let before = start - 1;
          while (before >= 0 && isWhitespace(currentLine[before])) before--;
          start = before + 1;
        }
      }

      return {
        startLine: line,
        startCol: start,
        endLine: line,
        endCol: Math.max(start, end),
      };
    } else {
      // For 'W', treat all non-whitespace as a word
      const isWord = (c: string) => !isWhitespace(c);
      const isWordAt = (idx: number) =>
        idx >= 0 && idx < lineLength && isWord(currentLine[idx]);

      // If cursor is on whitespace, find next word
      if (!isWordAt(anchor)) {
        let forward = anchor;
        while (forward < lineLength && !isWordAt(forward)) forward++;
        if (forward < lineLength) {
          anchor = forward;
        } else {
          let backward = anchor - 1;
          while (backward >= 0 && !isWordAt(backward)) backward--;
          if (backward < 0) return null;
          anchor = backward;
        }
      }

      let start = anchor;
      let end = anchor;

      // Find word boundaries
      while (start > 0 && isWord(currentLine[start - 1])) start--;
      while (end < lineLength - 1 && isWord(currentLine[end + 1])) end++;

      if (modifier === "a") {
        // Include trailing whitespace when available; otherwise, include leading
        // whitespace to mirror Vim's aw/aW behavior.
        let after = end + 1;
        while (after < lineLength && isWhitespace(currentLine[after])) after++;
        if (after > end + 1) {
          end = after - 1;
        } else if (start > 0) {
          let before = start - 1;
          while (before >= 0 && isWhitespace(currentLine[before])) before--;
          start = before + 1;
        }
      }

      return {
        startLine: line,
        startCol: start,
        endLine: line,
        endCol: Math.max(start, end),
      };
    }
  }

  // Quote objects
  if (object === '"' || object === "'" || object === "`") {
    let start = -1,
      end = -1;

    // Find surrounding quotes
    for (let i = col; i >= 0; i--) {
      if (currentLine[i] === object) {
        start = i;
        break;
      }
    }

    for (let i = col + 1; i < currentLine.length; i++) {
      if (currentLine[i] === object) {
        end = i;
        break;
      }
    }

    if (start !== -1 && end !== -1) {
      if (modifier === "i") {
        return {
          startLine: line,
          startCol: start + 1,
          endLine: line,
          endCol: end - 1,
        };
      } else {
        return { startLine: line, startCol: start, endLine: line, endCol: end };
      }
    }
  }

  // Bracket objects
  const bracketPairs: Record<string, { open: string; close: string }> = {
    "(": { open: "(", close: ")" },
    ")": { open: "(", close: ")" },
    "{": { open: "{", close: "}" },
    "}": { open: "{", close: "}" },
    "[": { open: "[", close: "]" },
    "]": { open: "[", close: "]" },
    "<": { open: "<", close: ">" },
    ">": { open: "<", close: ">" },
  };

  if (bracketPairs[object]) {
    const { open, close } = bracketPairs[object];
    let openLine = -1,
      openCol = -1;
    let closeLine = -1,
      closeCol = -1;
    let depth = 0;

    // Search backwards from cursor position for opening bracket
    let searchLine = line;
    let searchCol = col;

    searchLoop: while (searchLine >= 0) {
      const searchText = lines[searchLine];
      const startCol = searchLine === line ? searchCol : searchText.length - 1;

      for (let i = startCol; i >= 0; i--) {
        if (searchText[i] === close) {
          depth++;
        } else if (searchText[i] === open) {
          if (depth === 0) {
            openLine = searchLine;
            openCol = i;
            break searchLoop;
          }
          depth--;
        }
      }
      searchLine--;
    }

    // If we found an opening bracket, search forward for closing bracket
    if (openLine !== -1) {
      depth = 0;
      searchLine = openLine;
      searchCol = openCol + 1;

      searchLoop2: while (searchLine < lines.length) {
        const searchText = lines[searchLine];
        const startCol = searchLine === openLine ? searchCol : 0;

        for (let i = startCol; i < searchText.length; i++) {
          if (searchText[i] === open) {
            depth++;
          } else if (searchText[i] === close) {
            if (depth === 0) {
              closeLine = searchLine;
              closeCol = i;
              break searchLoop2;
            }
            depth--;
          }
        }
        searchLine++;
        searchCol = 0;
      }
    }

    if (openLine !== -1 && closeLine !== -1) {
      if (modifier === "i") {
        // Inner: exclude the brackets themselves
        let startLine = openLine;
        let startCol = openCol + 1;
        let endLine = closeLine;
        let endCol = closeCol - 1;

        // Handle case where open and close are on same line
        if (startLine === endLine && startCol > endCol) {
          // Empty inner object
          return {
            startLine: startLine,
            startCol: startCol,
            endLine: endLine,
            endCol: startCol - 1,
          };
        }

        return {
          startLine: startLine,
          startCol: startCol,
          endLine: endLine,
          endCol: endCol,
        };
      } else {
        // Around: include the brackets
        return {
          startLine: openLine,
          startCol: openCol,
          endLine: closeLine,
          endCol: closeCol,
        };
      }
    }
  }

  // Paragraph object
  if (object === "p") {
    let startLine = line;
    let endLine = line;

    // Find start of paragraph (first non-empty line before empty line)
    while (startLine > 0 && lines[startLine - 1].trim() !== "") {
      startLine--;
    }

    // Find end of paragraph
    while (endLine < lines.length - 1 && lines[endLine + 1].trim() !== "") {
      endLine++;
    }

    if (modifier === "a") {
      // Include trailing empty lines
      while (endLine < lines.length - 1 && lines[endLine + 1].trim() === "") {
        endLine++;
      }
    }

    return {
      startLine,
      startCol: 0,
      endLine,
      endCol: lines[endLine].length - 1,
    };
  }

  // Sentence object
  if (object === "s") {
    const start = findSentenceStartBackward(lines, line, col);
    const endBoundary = findSentenceStartForward(lines, line, col);

    let endLine =
      endBoundary.line - (endBoundary.col === 0 ? 1 : 0) >= start.line
        ? endBoundary.line - (endBoundary.col === 0 ? 1 : 0)
        : start.line;
    const endColCandidate =
      endBoundary.col === 0
        ? Math.max(0, (lines[endLine]?.length ?? 1) - 1)
        : endBoundary.col - 1;

    let startLine = start.line;
    let startCol = start.col;
    let endCol = Math.max(0, endColCandidate);

    if (modifier === "a") {
      // Include trailing whitespace up to start of next sentence
      let l = endLine;
      let c = endCol + 1;
      while (l < lines.length) {
        const text = lines[l] || "";
        while (c < text.length && isWhitespace(text[c])) c++;
        if (c < text.length) break;
        l++;
        c = 0;
        if (text.trim() === "") break;
      }
      endLine = l === lines.length ? lines.length - 1 : l;
      endCol =
        l >= lines.length
          ? Math.max(0, (lines[endLine]?.length || 1) - 1)
          : Math.max(0, c - 1);
    } else {
      // Trim leading whitespace for "inner" sentence
      while (
        startCol < (lines[startLine]?.length ?? 0) &&
        isWhitespace(lines[startLine][startCol])
      ) {
        startCol++;
      }
    }

    return {
      startLine,
      startCol,
      endLine,
      endCol,
    };
  }

  // Tag object (t)
  if (object === "t") {
    const lineOffsets: number[] = [];
    let acc = 0;
    for (const l of lines) {
      lineOffsets.push(acc);
      acc += l.length + 1; // account for the newline separator
    }

    const toIndex = (l: number, c: number) => lineOffsets[l] + c;
    const toLineCol = (idx: number) => {
      let lineIdx = 0;
      while (
        lineIdx < lineOffsets.length - 1 &&
        lineOffsets[lineIdx + 1] <= idx
      ) {
        lineIdx++;
      }
      return { line: lineIdx, col: idx - lineOffsets[lineIdx] };
    };

    const text = lines.join("\n");
    const cursorIdx = toIndex(line, col);

    const tagRe = /<\/?([a-zA-Z0-9\-]+)[^>]*>/g;
    const stack: { name: string; start: number; end: number }[] = [];
    let best: {
      openStart: number;
      openEnd: number;
      closeStart: number;
      closeEnd: number;
    } | null = null;

    let match: RegExpExecArray | null;
    while ((match = tagRe.exec(text))) {
      const full = match[0];
      const name = match[1];
      const isClosing = full[1] === "/";
      const start = match.index;
      const end = start + full.length - 1;

      if (!isClosing) {
        stack.push({ name, start, end });
      } else {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === name) {
            const open = stack[i];
            stack.splice(i, stack.length - i);
            const pair = {
              openStart: open.start,
              openEnd: open.end,
              closeStart: start,
              closeEnd: end,
            };
            if (cursorIdx >= open.start && cursorIdx <= end) {
              // prefer the outermost enclosing tag; we'll refine selection
              // later based on cursor position.
              if (!best || pair.openStart < best.openStart) {
                best = pair;
              }
            }
            break;
          }
        }
      }
    }

    if (best) {
      const innerStart = best.openEnd + 1;
      const innerEnd = best.closeStart - 1;

      let startIdx = modifier === "i" ? innerStart : best.openStart;
      let endIdx = modifier === "i" ? innerEnd : best.closeEnd;

      if (modifier === "i") {
        // Prefer deleting the content of the first nested tag instead of
        // removing the tag itself so constructs like <a><b>text</b></a> keep
        // their child tags intact.
        const innerRe = /<\/?([a-zA-Z0-9\-]+)[^>]*>/g;
        innerRe.lastIndex = innerStart;
        const innerStack: { name: string; start: number; end: number }[] = [];
        let child: {
          openStart: number;
          openEnd: number;
          closeStart: number;
          closeEnd: number;
        } | null = null;

        let innerMatch: RegExpExecArray | null;
        while (
          (innerMatch = innerRe.exec(text)) &&
          innerMatch.index < best.closeStart
        ) {
          const full = innerMatch[0];
          const name = innerMatch[1];
          const isClosing = full[1] === "/";
          const start = innerMatch.index;
          const end = start + full.length - 1;

          if (!isClosing) {
            innerStack.push({ name, start, end });
          } else {
            for (let i = innerStack.length - 1; i >= 0; i--) {
              if (innerStack[i].name === name) {
                const open = innerStack[i];
                innerStack.splice(i, innerStack.length - i);
                child = {
                  openStart: open.start,
                  openEnd: open.end,
                  closeStart: start,
                  closeEnd: end,
                };
                break;
              }
            }
            if (child) break;
          }
        }

        const cursorInContent =
          cursorIdx > best.openEnd && cursorIdx < best.closeStart;

        if (child) {
          const cursorInsideChild =
            (cursorIdx >= child.openStart && cursorIdx <= child.openEnd) ||
            (cursorIdx > child.openEnd && cursorIdx < child.closeStart);

          if (!cursorInContent || cursorInsideChild) {
            startIdx = child.openEnd + 1;
            endIdx = child.closeStart - 1;
          }
        }
      }

      if (text.includes("<div><b>bold</b><i>italic</i></div>")) {
        console.error("tag-range-2", { startIdx, endIdx, cursorIdx, modifier });
      }

      const startPos = toLineCol(Math.max(0, startIdx));
      const endPos = toLineCol(Math.max(0, endIdx));

      return {
        startLine: startPos.line,
        startCol: startPos.col,
        endLine: endPos.line,
        endCol: endPos.col,
      };
    }
  }

  return null;
}
