/**
 * Vim Parity Tests for Challenge 9v0068583e17000000000702
 * Challenge: π (Pi)
 *
 * This is the famous Pi calculation challenge - transform a VimScript
 * Pi calculation function into the actual digits of Pi.
 *
 * Note: This challenge likely requires executing the VimScript to produce
 * the output, which is an advanced feature. We'll test what commands
 * are used in solving it.
 */
import { describe, it, expect } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
} from "../src/lib/vim-engine";
import { runVimParityAsync } from "../src/lib/vim-parity";

// Challenge data from popular-challenges.json
const startText = `fu! Pi()
let x=''
let k=3999
let p=0
let q=0
let t=1000
let j=0
let a=[2]
wh a[j]!=0 && k!=0
        let p=1+2*k
        wh j<403
                if !(k!=(j>2))
                        let x.=printf("%.3d",a[j-2]%t+q/p/t)
                en
                let q=a[j]*k+q%p*t
                let a[j]=q/p
                call add(a,0)
                let j+=1
        endw
        let j=0
        let q=0
        let a[j]+=2
        let k-=1
endw
retu x
endf`;

const targetText = `141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647093844609550582231725359408128481117450284102701938521105559644622948954930381964428810975665933446128475648233786783165271201909145648566923460348610454326648213393607260249141273724587006606315588174881520920962829254091715364367892590360011330530548820466521384146951941511609433057270365759591953092186117381932611793105118548074462379962749567351885752724891227938183011949129833673362440656643086021394946395224737190702179860943702770539217176293176752384674818467669405132000568127145263560827785771342757789609173637178721468440901224953430146549585371050792279689258923542019956112129021960864034418159813629774771309960518707211349999998372978049951059731732816096318595024459455346908302642522308253344685035261931188171010003137838752886587533208381420617177669147303598253490428755468731159562863882353787593751957781857780532171226806613001927876611195909216420198938095257201065485863278865936153381827968230301952035301852968995773622599413891249721775283479131515574857242454150695950829533116861727855889075098381754637464939319255060400927701671139009848824012
π`;

// Enable real Vim parity checking
process.env.PARITY_USE_REAL_VIM = "1";
process.env.PARITY_ALL = "1";
process.env.VIM_BIN = "nvim";

describe("Challenge 9v0068583e17000000000702 - Pi challenge parity", () => {
  // This challenge is unique - it requires executing VimScript
  // The best score is 16 keystrokes, likely using :source or :so

  it("basic deletion - dG from top deletes all", async () => {
    const parityResult = await runVimParityAsync({
      startText,
      keystrokes: "ggdG",
      vimBin: "nvim",
      timeoutMs: 3000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("change entire file - ggcG", async () => {
    const parityResult = await runVimParityAsync({
      startText,
      keystrokes: "ggcGtest<Esc>",
      vimBin: "nvim",
      timeoutMs: 3000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("visual line select all and delete", async () => {
    const parityResult = await runVimParityAsync({
      startText,
      keystrokes: "ggVGd",
      vimBin: "nvim",
      timeoutMs: 3000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  // Note: The actual Pi challenge solution likely uses :so % to execute the
  // VimScript, then deletes the function and inserts π. Testing basic
  // operations that would be part of this.

  it("insert at end of file", async () => {
    const parityResult = await runVimParityAsync({
      startText,
      keystrokes: "Goπ<Esc>",
      vimBin: "nvim",
      timeoutMs: 3000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("delete function definition lines", async () => {
    const parityResult = await runVimParityAsync({
      startText,
      keystrokes: ":1,26d<CR>",
      vimBin: "nvim",
      timeoutMs: 3000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });
});

describe("Challenge 9v0068583e17000000000702 - ex command parity", () => {
  // The Pi challenge likely uses :so % to source the current file
  // Let's test related ex commands

  const commandTests = [
    {
      name: ":1,5d - delete range",
      keystrokes: ":1,5d<CR>",
    },
    {
      name: ":%d - delete all lines",
      keystrokes: ":%d<CR>",
    },
    {
      name: ":$d - delete last line",
      keystrokes: ":$d<CR>",
    },
    {
      name: ":1d|$d - delete first and last",
      keystrokes: ":1d<CR>:$d<CR>",
    },
  ];

  commandTests.forEach(({ name, keystrokes }) => {
    it(`${name} - matches nvim`, async () => {
      const parityResult = await runVimParityAsync({
        startText,
        keystrokes,
        vimBin: "nvim",
        timeoutMs: 3000,
      });

      if (parityResult.engineNormalized !== parityResult.vimNormalized) {
        console.log(`\n=== Command mismatch: ${name} ===`);
        console.log(
          "Engine:",
          JSON.stringify(parityResult.engineNormalized.slice(0, 200))
        );
        console.log(
          "Vim:   ",
          JSON.stringify(parityResult.vimNormalized.slice(0, 200))
        );
      }
      expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
    });
  });
});

describe("Challenge 9v0068583e17000000000702 - Unicode parity", () => {
  // The challenge uses π symbol, test Unicode handling

  it("insert π character", async () => {
    const parityResult = await runVimParityAsync({
      startText: "test",
      keystrokes: "Aπ<Esc>",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("substitute with π", async () => {
    const parityResult = await runVimParityAsync({
      startText: "pi symbol here",
      keystrokes: ":%s/pi/π/<CR>",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });

  it("yank and paste line with special chars", async () => {
    const parityResult = await runVimParityAsync({
      startText: 'let x.=printf("%.3d",a[j-2]%t+q/p/t)',
      keystrokes: "yypP",
      vimBin: "nvim",
      timeoutMs: 2000,
    });

    expect(parityResult.engineNormalized).toBe(parityResult.vimNormalized);
  });
});
