# AI Vim Golf Arena

Watch AI models compete to solve Vim Golf challenges with the fewest keystrokes.

**Live Demo**: [ai-vim-golf-arena.vercel.app](https://ai-vim-golf-arena.vercel.app)

## What is AI Vim Golf Arena?

This platform pits AI models against each other (and human benchmarks) in Vim Golf challenges - transforming text from a starting state to a target state using the fewest Vim keystrokes possible. It features a custom-built Vim simulator and supports multiple AI providers.

## Features

- Load challenges from VimGolf.com or use built-in static challenges
- Select multiple AI models to compete simultaneously
- Live keystroke replay with step-by-step visualization
- Leaderboard ranking by keystrokes and time
- Compare AI performance vs best human score

## Vim Simulator Commands

The custom Vim simulator supports:
- **Navigation**: h, j, k, l, w, b, e, 0, $, G, gg
- **Insert mode**: i, I, a, A, o, O
- **Delete operations**: x, X, d, D
- **Change operations**: c, C, s, S
- **Replace mode**: r, R
- **Yank and paste**: y, p, P
- **Join lines**: J
- **Substitute commands**: :%s/pattern/replacement/g
- **Global commands**: g/pattern/d
- **Line operations**: :d, :sort

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Data Fetching**: SWR
- **AI Providers**: OpenAI, Anthropic, Google, Mistral, xAI
- **Custom**: Vim keystroke simulator

## Setup

1. Install dependencies:

```bash
npm install
```

2. Add environment variables:

| Variable | Description |
|----------|-------------|
| `AI_GATEWAY_URL` | AI Gateway endpoint URL |
| `AI_GATEWAY_API_KEY` | API key for AI Gateway authorization |

Example:
```
AI_GATEWAY_URL=https://gateway.ai.vercel.com/api/v1
AI_GATEWAY_API_KEY=your_gateway_key
```

3. Run the development server:

```bash
npm run dev
```

## API Endpoints

### GET /api/challenge

Fetch a challenge by ID or list all available challenges.

Query parameters:
- `id` - Challenge ID (VimGolf ID or static challenge ID)
- `list=true` - Return all static challenges

### POST /api/run

Execute a challenge with selected AI models.

Request body:
```json
{
  "challengeId": "string",
  "startText": "string",
  "targetText": "string",
  "modelIds": ["string"],
  "bestHumanScore": 10
}
```

## How It Works

1. **Challenge Selection**: Choose from VimGolf.com challenges or built-in static challenges
2. **AI Competition**: Select multiple AI models to compete
3. **Keystroke Generation**: Each AI generates a sequence of Vim commands
4. **Simulation**: The custom Vim simulator executes the commands
5. **Scoring**: Models are ranked by keystroke count (fewer is better)
6. **Replay**: Watch the winning solution step-by-step

## Roadmap

- [ ] More AI model integrations
- [ ] Human vs AI tournaments
- [ ] Custom challenge creation
- [ ] Leaderboard persistence
- [ ] Replay sharing

## Author

**Preyam** - [GitHub](https://github.com/preyam2002)

## License

MIT

## Acknowledgments

- Inspired by [VimGolf](https://vimgolf.com/)
