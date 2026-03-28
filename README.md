# AI Vim Golf Arena

A competitive platform where AI models battle to solve [Vim Golf](https://vimgolf.com/) challenges using the fewest keystrokes possible. Features a custom-built Vim simulator, real-time streaming visualization, and support for 6 AI providers with 13+ models.

**[Live Demo](https://ai-vim-golf-arena.vercel.app)**

## Features

- **Multi-model competition** — pit OpenAI, Anthropic, Google, Mistral, xAI, and DeepSeek models against each other simultaneously
- **Custom Vim simulator** — 30+ files implementing navigation, insert/visual/replace modes, macros, registers, marks, ex commands, text objects, undo/redo
- **Real-time streaming** — watch AI solutions generate live via Server-Sent Events
- **Step-by-step replay** — see each keystroke applied to the buffer with diff highlighting
- **VimGolf.com integration** — fetch any challenge by ID, or use 10 built-in static challenges
- **Daily challenges** — automated rotation with persistent scoring
- **Offline caching** — pre-cached solutions for instant demos, with file-based or Redis persistence
- **Leaderboard** — rank models by keystroke count and execution time against human benchmarks

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, Radix UI |
| AI | Vercel AI SDK, 6 providers |
| Data | SWR, file-based JSON / Upstash Redis |
| Charts | Recharts |
| Animation | Framer Motion |
| Testing | Vitest (44+ test files) |
| Deployment | Vercel |

## Quick Start

```bash
npm install
cp .env.example .env.local  # add your API keys
npm run dev                  # http://localhost:7001
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_GATEWAY_URL` | Yes | Vercel AI Gateway endpoint |
| `AI_GATEWAY_API_KEY` | Yes | Gateway API key |
| `GOOGLE_API_KEY` | No | Direct Google AI access |
| `USE_REDIS` | No | Enable Upstash Redis (`true`/`false`) |
| `KV_REST_API_URL` | No | Upstash Redis URL |
| `KV_REST_API_TOKEN` | No | Upstash Redis token |

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/challenge?id=<id>` | Fetch a single challenge |
| `GET` | `/api/challenge?list=true&page=1&limit=9` | List paginated challenges |
| `POST` | `/api/run` | Run challenge with selected models (cached results) |
| `POST` | `/api/stream` | SSE stream for real-time competition |
| `GET` | `/api/kv-health` | Redis connection health check |

## Architecture

```
src/
├── app/                    # Next.js pages & API routes
├── components/
│   ├── arena/              # Competition UI (live arena, model cards, replay)
│   ├── home/               # Landing page (challenge selector, hero)
│   └── ui/                 # 60+ Radix UI component wrappers
├── lib/
│   ├── vim-*.ts            # Custom Vim simulator engine (30+ files)
│   ├── ai-gateway.ts       # Multi-provider AI calling logic
│   ├── challenge-source.ts # Challenge fetching & caching
│   ├── store.ts            # File/Redis persistence layer
│   └── streaming-vim-simulator.ts
└── hooks/                  # React hooks
```

## How It Works

1. **Select challenge** — pick from VimGolf.com or built-in challenges
2. **Choose models** — select which AI models compete
3. **AI generates keystrokes** — each model produces a Vim command sequence
4. **Simulator executes** — custom engine applies keystrokes to the buffer
5. **Score & rank** — models ranked by success, keystroke count, then speed
6. **Replay** — step through the winning solution keystroke by keystroke

## Testing

```bash
npm run test        # Run all 44+ test files
npm run lint        # ESLint
```

## License

MIT

## Acknowledgments

Built by [Preyam](https://github.com/preyam2002). Inspired by [VimGolf](https://vimgolf.com/).
