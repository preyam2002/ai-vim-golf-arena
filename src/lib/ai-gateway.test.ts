import { describe, it, expect } from "vitest";
import { cleanKeystrokes } from "./ai-gateway";

describe("cleanKeystrokes", () => {
  it("should handle plain text", () => {
    expect(cleanKeystrokes("cwfoo<Esc>")).toBe("cwfoo<Esc>");
  });

  it("should remove markdown code blocks", () => {
    const input = "```\ncwfoo<Esc>\n```";
    expect(cleanKeystrokes(input)).toBe("cwfoo<Esc>");
  });

  it("should remove markdown code blocks with language", () => {
    const input = "```vim\ncwfoo<Esc>\n```";
    expect(cleanKeystrokes(input)).toBe("cwfoo<Esc>");
  });

  it("should handle multiple lines in code block", () => {
    const input = "```\ncwfoo<Esc>\njj\n```";
    // It currently takes only the first line of the cleaned output?
    // The original implementation did `cleaned.split("\n")[0].trim()`.
    // We want to preserve all keystrokes if they are valid.
    // But let's see what the current implementation does first.
    // Actually, for now let's just expect what we WANT it to do.
    expect(cleanKeystrokes(input)).toBe("cwfoo<Esc>\njj");
  });

  it("should handle text surrounded by commentary", () => {
    const input = "Here is the solution:\n```\ncwfoo<Esc>\n```\nHope it helps!";
    expect(cleanKeystrokes(input)).toBe("cwfoo<Esc>");
  });
});
