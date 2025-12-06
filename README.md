# Vimgolf AI Arena

Watch AI models compete to solve Vim Golf challenges with the fewest keystrokes.

## Features

- Load challenges from VimGolf.com or use built-in static challenges
- Select multiple AI models to compete simultaneously
- Live keystroke replay with step-by-step visualization
- Leaderboard ranking by keystrokes and time
- Compare AI performance vs best human score
- Custom Vim keystroke simulator supporting:
  - Navigation (h, j, k, l, w, b, e, 0, $, G, gg)
  - Insert mode (i, I, a, A, o, O)
  - Delete operations (x, X, d, D)
  - Change operations (c, C, s, S)
  - Replace mode (r, R)
  - Yank and paste (y, p, P)
  - Join lines (J)
  - Substitute commands (:%s/pattern/replacement/g)
  - Global commands (g/pattern/d)
  - Line operations (:d, :sort)

## Setup

1. Install dependencies:

\`\`\`bash
npm install
\`\`\`

2. Add environment variables in the **Vars** section of the v0 sidebar:

| Variable           | Description                          |
| ------------------ | ------------------------------------ |
| AI_GATEWAY_URL     | AI Gateway endpoint URL              |
| AI_GATEWAY_API_KEY | API key for AI Gateway authorization |

Example (Vercel AI Gateway, OpenAI-compatible):

```
AI_GATEWAY_URL=https://gateway.ai.vercel.com/api/v1
AI_GATEWAY_API_KEY=your_gateway_key
```

3. Run the development server:

\`\`\`bash
npm run dev
\`\`\`

## API Endpoints

### GET /api/challenge

Fetch a challenge by ID or list all available challenges.

Query parameters:

- `id` - Challenge ID (VimGolf ID or static challenge ID)
- `list=true` - Return all static challenges

### POST /api/run

Execute a challenge with selected AI models.

Request body:

\`\`\`json
{
"challengeId": "string",
"startText": "string",
"targetText": "string",
"modelIds": ["string"],
"bestHumanScore": 10
}
\`\`\`

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- SWR for data fetching
- Custom Vim simulator
