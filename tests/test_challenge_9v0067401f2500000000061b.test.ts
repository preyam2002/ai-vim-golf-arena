import { describe, it, expect } from "vitest"
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
} from "../src/lib/vim-engine"

const START_TEXT = `10,9,8,7,6,5,4,3,2,1
Ten,Nine,Eight,Seven,Six,Five,Four,Three,Two,One
Tenth,Ninth,Eighth,Seventh,Sixth,Fifth,Fourth,Third,Second,First
X,IX,VIII,VII,VI,V,IV,III,II,I`

const TARGET_TEXT = `1,2,3,4,5,6,7,8,9,10
One,Two,Three,Four,Five,Six,Seven,Eight,Nine,Ten
First,Second,Third,Fourth,Fifth,Sixth,Seventh,Eighth,Ninth,Tenth
I,II,III,IV,V,VI,VII,VIII,IX,X`

type Case = {
  name: string
  keystrokes: string
  shouldSucceed: boolean
}

function replaySequence(startText: string, keystrokes: string) {
  let state = createInitialState(startText)
  let remaining = keystrokes

  while (remaining.length > 0) {
    const stroke = extractKeystroke(remaining, state.mode)
    if (!stroke) {
      throw new Error(
        `Unable to extract keystroke from: "${remaining.slice(0, 80)}..."`,
      )
    }
    state = executeKeystroke(state, stroke)
    remaining = remaining.slice(stroke.length)
  }

  return state.lines.join("\n")
}

const cases: Case[] = [
  {
    name: "openai/gpt-5-mini (reverse with join/split)",
    keystrokes: ":%s/.*/\\=join(reverse(split(submatch(0),',')),',')<CR>",
    shouldSucceed: true,
  },
  {
    name: "deepseek/deepseek-r1 (reverse with join/split, global)",
    keystrokes: ":%s/.*/\\=join(reverse(split(submatch(0), ',')), ',')/g<CR>",
    shouldSucceed: true,
  },
  {
    name: "google/gemini-2.0-flash (long substitution chain)",
    keystrokes:
      ":g/,/m0<CR>:%s/\\v(\\w+),(\\w+),(\\w+),(\\w+),(\\w+),(\\w+),(\\w+),(\\w+),(\\w+),(\\w+)/\\10,\\9,\\8,\\7,\\6,\\5,\\4,\\3,\\2,\\1/g<CR>:%s/Ten/One/g<CR>:%s/Nine/Two/g<CR>:%s/Eight/Three/g<CR>:%s/Seven/Four/g<CR>:%s/Six/Five/g<CR>:%s/Five/Six/g<CR>:%s/Four/Seven/g<CR>:%s/Three/Eight/g<CR>:%s/Two/Nine/g<CR>:%s/One/Ten/g<CR>:%s/Tenth/First/g<CR>:%s/Ninth/Second/g<CR>:%s/Eighth/Third/g<CR>:%s/Seventh/Fourth/g<CR>:%s/Sixth/Fifth/g<CR>:%s/Fifth/Sixth/g<CR>:%s/Fourth/Seventh/g<CR>:%s/Third/Eighth/g<CR>:%s/Second/Ninth/g<CR>:%s/First/Tenth/g<CR>:%s/IX/II/g<CR>:%s/VIII/III/g<CR>:%s/VII/IV/g<CR>:%s/VI/V/g<CR>:%s/V/VI/g<CR>:%s/IV/VII/g<CR>:%s/III/VIII/g<CR>:%s/II/IX/g<CR>",
    shouldSucceed: false,
  },
  {
    name: "anthropic/claude-sonnet-4.5 (backref reorder)",
    keystrokes:
      ":%s/\\v([^,\\n]+)(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?\\n([^,\\n]+)(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?\\n([^,\\n]+)(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?\\n([^,\\n]+)(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?(,([^,\\n]+))?/\\21\\20\\19\\18\\17\\16\\15\\14\\13\\12\\11\\10\\9\\8\\7\\6\\5\\4\\3\\2\\1\\n/g<CR>",
    shouldSucceed: false,
  },
  {
    name: "xai/grok-4-fast-reasoning (external command chain)",
    keystrokes:
      ":%s/,/\\r/g<CR>V9j!tac|tr '\\012' ,<CR>qajV9j!tac|tr '\\012' ,<CR>q@a@a",
    shouldSucceed: true,
  },
  {
    name: "mistral/mistral-large-latest (numeric/word/roman remap with deletes)",
    keystrokes:
      ":%s/\\v(\\d+)/\\=11-submatch(1)/g<CR>ggdd:%s/\\v(\\w+)/\\=split(\"One Two Three Four Five Six Seven Eight Nine Ten\")[submatch(1)-1]/g<CR>:%s/\\v(\\w+)/\\=split(\"First Second Third Fourth Fifth Sixth Seventh Eighth Ninth Tenth\")[submatch(1)-1]/g<CR>:%s/\\v(\\w+)/\\=split(\"I II III IV V VI VII VIII IX X\")[10-submatch(1)]/g<CR>",
    shouldSucceed: false,
  },
]

describe("challenge 9v0067401f2500000000061b cached solutions", () => {
  cases.forEach(({ name, keystrokes, shouldSucceed }) => {
    it(`${name} ${shouldSucceed ? "matches" : "does not match"} target`, () => {
      const finalText = replaySequence(START_TEXT, keystrokes)
      if (shouldSucceed) {
        expect(finalText).toBe(TARGET_TEXT)
      } else {
        expect(finalText).not.toBe(TARGET_TEXT)
      }
    })
  })
})


