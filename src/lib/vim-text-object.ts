import { isWordChar, isWhitespace } from "./vim-utils";

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
    const isWord =
      object === "w" ? isWordChar : (c: string) => !isWhitespace(c);

    let start = col;
    let end = col;

    // Find word boundaries
    while (start > 0 && isWord(currentLine[start - 1])) start--;
    while (end < currentLine.length && isWord(currentLine[end])) end++;

    if (modifier === "a") {
      // Include trailing whitespace
      while (end < currentLine.length && isWhitespace(currentLine[end])) end++;
      // If no trailing whitespace, include leading
      if (
        end === col ||
        (end < currentLine.length && !isWhitespace(currentLine[end]))
      ) {
        while (start > 0 && isWhitespace(currentLine[start - 1])) start--;
      }
      // Ensure we capture exactly one trailing space if present (common for aw)
      if (end < currentLine.length && isWhitespace(currentLine[end])) {
        end++;
      }
    }

    return {
      startLine: line,
      startCol: start,
      endLine: line,
      endCol: Math.max(start, end - 1),
    };
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
    let openPos = -1,
      closePos = -1;
    let depth = 0;

    // Find opening bracket before or at cursor
    for (let i = col; i >= 0; i--) {
      if (currentLine[i] === close) depth++;
      if (currentLine[i] === open) {
        if (depth === 0) {
          openPos = i;
          break;
        }
        depth--;
      }
    }

    // Find closing bracket after cursor
    depth = 0;
    for (let i = openPos + 1; i < currentLine.length; i++) {
      if (currentLine[i] === open) depth++;
      if (currentLine[i] === close) {
        if (depth === 0) {
          closePos = i;
          break;
        }
        depth--;
      }
    }

    if (openPos !== -1 && closePos !== -1) {
      if (modifier === "i") {
        return {
          startLine: line,
          startCol: openPos + 1,
          endLine: line,
          endCol: closePos - 1,
        };
      } else {
        return {
          startLine: line,
          startCol: openPos,
          endLine: line,
          endCol: closePos,
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

  // Tag object (t)
  if (object === "t") {
    let currL = line;
    let currC = col;
    const stack: string[] = [];

    // Helper to extract tag name from tag string (e.g. "div class='...'" -> "div")
    const getTagName = (content: string) => {
      const match = content.match(/^([a-zA-Z0-9\-]+)/);
      return match ? match[1] : "";
    };

    // Search backward for opening tag that encloses the cursor
    while (currL >= 0) {
      const lText = lines[currL];
      // Find last < before current position
      // We need to loop because there might be multiple tags on the line
      let searchPos = currC;

      // If we moved up a line, search from end of line
      if (currL < line) {
        searchPos = lText.length;
      }

      while (true) {
        const openIdx = lText.lastIndexOf("<", searchPos - 1);
        if (openIdx === -1) break;

        const closeIdx = lText.indexOf(">", openIdx);
        if (closeIdx !== -1) {
          // We found a tag: <...>
          const fullTag = lText.slice(openIdx + 1, closeIdx);

          if (fullTag.startsWith("/")) {
            // Closing tag, e.g. /div
            const tagName = getTagName(fullTag.slice(1));
            if (tagName) stack.push(tagName);
          } else if (!fullTag.endsWith("/")) {
            // Opening tag (ignore self-closing like <br/>)
            const tagName = getTagName(fullTag);
            if (tagName) {
              if (stack.length > 0 && stack[stack.length - 1] === tagName) {
                // Matches a recently seen closing tag, so this is a nested/adjacent tag pair
                stack.pop();
              } else if (stack.length === 0) {
                // Found a candidate opening tag and stack is empty!
                // This means we are inside this tag (or after it, but we scan backwards so inside/after).
                // Wait, if we are AFTER it (e.g. <b>bold</b> cursor), we would have seen </b> first and pushed to stack.
                // So if stack is empty, we must be inside it?
                // Example: <b>bold</b> cursor.
                // Scan back: </b> -> push b. <b> -> pop b. Stack empty.
                // Continue scan back...
                // So if we pop, we continue.
                // If we find <b> and stack is empty, it means we haven't seen its closing tag yet.
                // So we are inside it.

                // Now find the matching closing tag forward
                const startLine = currL;
                const startCol = openIdx;
                const openTagLength = closeIdx - openIdx + 1; // <div...>

                // Search forward for </tagName>
                let fwdL = startLine;
                let fwdC = startCol + openTagLength;
                let depth = 0;
                let foundClose = false;
                let endLine = -1;
                let endCol = -1;

                while (fwdL < lines.length) {
                  const fText = lines[fwdL];
                  const fStart = fwdL === startLine ? fwdC : 0;

                  // Find next <
                  const nextOpen = fText.indexOf("<", fStart);
                  if (nextOpen !== -1) {
                    const nextClose = fText.indexOf(">", nextOpen);
                    if (nextClose !== -1) {
                      const fTag = fText.slice(nextOpen + 1, nextClose);
                      if (fTag.startsWith("/")) {
                        const fTagName = getTagName(fTag.slice(1));
                        if (fTagName === tagName) {
                          if (depth === 0) {
                            foundClose = true;
                            endLine = fwdL;
                            endCol = nextClose;
                            break;
                          } else {
                            depth--;
                          }
                        }
                      } else if (!fTag.endsWith("/")) {
                        const fTagName = getTagName(fTag);
                        if (fTagName === tagName) {
                          depth++;
                        }
                      }
                      // Continue searching on this line after the tag
                      fwdC = nextClose + 1;
                      continue;
                    }
                  }

                  // If no more tags on this line, go to next line
                  fwdL++;
                  fwdC = 0;
                }

                if (foundClose) {
                  // We found the pair!
                  // Check if cursor is strictly inside?
                  // Actually, if we found the opening tag by scanning backward and stack was empty,
                  // and we found the closing tag forward, we are definitely inside (or on the tags).

                  if (modifier === "i") {
                    // Inner tag: exclude the tags themselves
                    // Start: after opening tag
                    // End: before closing tag

                    // Handle case where content starts on same line or next
                    let innerStartLine = startLine;
                    let innerStartCol = startCol + openTagLength;
                    let innerEndLine = endLine;
                    let innerEndCol = endCol - (tagName.length + 3) + 1; // </tag> length is tagName + 3 (< / >)
                    // Wait, endCol is index of >.
                    // Closing tag starts at endCol - (tagName.length + 2).
                    // </div > ? No, </div>. Length 3+3=6.
                    // Index of < is endCol - (length - 1).

                    // Easier: find start of closing tag
                    const closeTagStart = lines[endLine].lastIndexOf(
                      "<",
                      endCol
                    );
                    innerEndCol = closeTagStart - 1;

                    return {
                      startLine: innerStartLine,
                      startCol: innerStartCol,
                      endLine: innerEndLine,
                      endCol: innerEndCol,
                    };
                  } else {
                    // Around tag: include tags
                    return {
                      startLine: startLine,
                      startCol: startCol,
                      endLine: endLine,
                      endCol: endCol,
                    };
                  }
                }
              }
            }
          }
        }

        // Move searchPos back
        searchPos = openIdx;
      }

      currL--;
      if (currL >= 0) currC = lines[currL].length;
    }
  }

  return null;
}
