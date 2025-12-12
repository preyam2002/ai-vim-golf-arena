import { describe, test, expect } from "vitest";

// Inline the convertTokenToRawKeys function to test it
function convertTokenToRawKeys(token: string): string {
  let result = token;

  const keyMap: Record<string, string> = {
    "<Esc>": "\x1b",
    "<ESC>": "\x1b",
    "<CR>": "\r",
    "<Enter>": "\r",
    "<Tab>": "\t",
    "<BS>": "\x08",
    "<Backspace>": "\x08",
    "<Del>": "\x1b[3~",
    "<Delete>": "\x1b[3~",
    "<Up>": "\x1b[A",
    "<Down>": "\x1b[B",
    "<Left>": "\x1b[D",
    "<Right>": "\x1b[C",
    "<Home>": "\x1b[H",
    "<End>": "\x1b[F",
    "<PageUp>": "\x1b[5~",
    "<PageDown>": "\x1b[6~",
    "<Space>": " ",
    "<Bar>": "|",
    "<Bslash>": "\\",
    "<Lt>": "<",
    "<Gt>": ">",
    "<NL>": "\n",
    "<Nul>": "\x00",
    "<C-a>": "\x01",
    "<C-b>": "\x02",
    "<C-c>": "\x03",
    "<C-d>": "\x04",
    "<C-e>": "\x05",
    "<C-f>": "\x06",
    "<C-g>": "\x07",
    "<C-h>": "\x08",
    "<C-i>": "\t",
    "<C-j>": "\n",
    "<C-k>": "\x0b",
    "<C-l>": "\x0c",
    "<C-m>": "\r",
    "<C-n>": "\x0e",
    "<C-o>": "\x0f",
    "<C-p>": "\x10",
    "<C-q>": "\x11",
    "<C-r>": "\x12",
    "<C-s>": "\x13",
    "<C-t>": "\x14",
    "<C-u>": "\x15",
    "<C-v>": "\x16",
    "<C-w>": "\x17",
    "<C-x>": "\x18",
    "<C-y>": "\x19",
    "<C-z>": "\x1a",
    "<C-[>": "\x1b",
    "<C-\\>": "\x1c",
    "<C-]>": "\x1d",
    "<C-^>": "\x1e",
    "<C-_>": "\x1f",
  };

  for (const [notation, rawByte] of Object.entries(keyMap)) {
    const regex = new RegExp(
      notation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi"
    );
    result = result.replace(regex, rawByte);
  }

  return result;
}

describe("convertTokenToRawKeys", () => {
  test("should preserve :%s command", () => {
    const input = ":%s/^/\\=v:lnum . '. '/g<CR>";
    const output = convertTokenToRawKeys(input);
    console.log("Input:", JSON.stringify(input));
    console.log("Output:", JSON.stringify(output));
    console.log("Output hex:", Buffer.from(output).toString("hex"));

    // Check that %s is preserved
    expect(output).toContain("%s");
    expect(output).toContain("/^/");
  });
});
