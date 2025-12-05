import type { Challenge } from "./types"

export const staticChallenges: Challenge[] = [
  {
    id: "static-1",
    title: "Simple Addition",
    description: "Add a number to each line",
    startText: "apple\nbanana\ncherry",
    targetText: "1. apple\n2. banana\n3. cherry",
    bestHumanScore: 15,
  },
  {
    id: "static-2",
    title: "Swap Words",
    description: "Swap the two words on each line",
    startText: "hello world\nfoo bar\nping pong",
    targetText: "world hello\nbar foo\npong ping",
    bestHumanScore: 22,
  },
  {
    id: "static-3",
    title: "Remove Duplicates",
    description: "Remove duplicate lines",
    startText: "one\ntwo\ntwo\nthree\nthree\nthree",
    targetText: "one\ntwo\nthree",
    bestHumanScore: 12,
  },
  {
    id: "static-4",
    title: "Uppercase Conversion",
    description: "Convert all text to uppercase",
    startText: "hello world\nthis is vim golf",
    targetText: "HELLO WORLD\nTHIS IS VIM GOLF",
    bestHumanScore: 10,
  },
  {
    id: "static-5",
    title: "Add Quotes",
    description: "Wrap each word in quotes",
    startText: "apple banana cherry",
    targetText: '"apple" "banana" "cherry"',
    bestHumanScore: 18,
  },
  {
    id: "static-6",
    title: "Reverse Lines",
    description: "Reverse the order of lines",
    startText: "first\nsecond\nthird\nfourth",
    targetText: "fourth\nthird\nsecond\nfirst",
    bestHumanScore: 8,
  },
  {
    id: "static-7",
    title: "Delete Empty Lines",
    description: "Remove all empty lines",
    startText: "line1\n\nline2\n\n\nline3",
    targetText: "line1\nline2\nline3",
    bestHumanScore: 10,
  },
  {
    id: "static-8",
    title: "Add Semicolons",
    description: "Add semicolon at the end of each line",
    startText: "let x = 1\nlet y = 2\nlet z = 3",
    targetText: "let x = 1;\nlet y = 2;\nlet z = 3;",
    bestHumanScore: 9,
  },
]

export function getRandomChallenge(): Challenge {
  const index = Math.floor(Math.random() * staticChallenges.length)
  return staticChallenges[index]
}

export function getChallengeById(id: string): Challenge | undefined {
  return staticChallenges.find((c) => c.id === id)
}
