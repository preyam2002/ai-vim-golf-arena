import { describe, it, expect } from "vitest"
import {
  createInitialState,
  executeKeystroke,
  extractKeystroke,
} from "../src/lib/vim-engine"

type Case = {
  name: string
  startText: string
  targetText: string
  keystrokes: string
}

function replaySequence(startText: string, keystrokes: string) {
  let state = createInitialState(startText)
  let remaining = keystrokes

  while (remaining.length > 0) {
    const stroke = extractKeystroke(remaining, state.mode)
    if (!stroke) {
      throw new Error(
        `Unable to extract keystroke from: "${remaining.slice(0, 40)}..."`,
      )
    }
    state = executeKeystroke(state, stroke)
    remaining = remaining.slice(stroke.length)
  }

  return state.lines.join("\n")
}

const cases: Case[] = [
  {
    name: "static-1 numbering",
    startText: "apple\nbanana\ncherry",
    targetText: "1. apple\n2. banana\n3. cherry",
    keystrokes: ":%s/^/\\=line('.').'. '/<CR>",
  },
  {
    name: "static-7 delete empty lines",
    startText: "line1\n\nline2\n\n\nline3",
    targetText: "line1\nline2\nline3",
    keystrokes: ":g/^$/d<CR>",
  },
  {
    name: "static-8 append semicolons",
    startText: "let x = 1\nlet y = 2\nlet z = 3",
    targetText: "let x = 1;\nlet y = 2;\nlet z = 3;",
    keystrokes: ":%s/$/;/<CR>",
  },
  {
    name: "9v00680e54330000000006c0 env to json",
    startText: `# API Settings
JOBS_API_URL=http://localhost:5000
JOBS_BASE_URL=http://localhost:8000
SCRAPERS_BASE_URL=http://localhost:9900

# Database Settings
JOBS_DATABASE_URI=mongodb://mongouser:mongopassword@127.0.0.1:27017/app

# Redis Settings
JOBS_REDIS_DSN=redis://127.0.0.1:6000

# Data API
DATA_BASE_URL=http://127.0.0.1:8900

# Minio config
JOBS_MINIO_SECURE=false
JOBS_MINIO_ACCESS_KEY=miniouser
JOBS_MINIO_SECRET_KEY=miniosecret
JOBS_MINIO_HOST=127.0.0.1:9500
JOBS_MINIO_DEFAULT_BUCKET=jobs
JOBS_MINIO_REGION=us-west-1
JOBS_MINIO_CREATE_BUCKETS=false
JOBS_MINIO_RESULTS_FORMAT=results/{job.id}.json
JOBS_MINIO_ARGUMENTS_FORMAT=arguments/{job.id}.json
JOBS_MINIO_SERVICES_PATH=services/{job.service.bucket_name}
JOBS_MINIO_LOGS_BUCKET=

# RabbitMQ Settings
JOBS_RABBITMQ_URI=amqp://rabbitmquser:rabbitmqpassword@127.0.0.1:5672

# Package registry
REGISTRY_TOKEN=g_dka000111222333444

LOG_FORMAT=text

# Slack notifications
SLACK_TOKEN=
LOGGING_CHANNEL=

# Metadata API
TEST_METADATA_BASE_URL=http://127.0.0.1:8801
`,
    targetText: `{
    "JOBS_API_URL": "http://localhost:5000",
    "JOBS_BASE_URL": "http://localhost:8000",
    "SCRAPERS_BASE_URL": "http://localhost:9900",
    "JOBS_DATABASE_URI": "mongodb://mongouser:mongopassword@127.0.0.1:27017/app",
    "JOBS_REDIS_DSN": "redis://127.0.0.1:6000",
    "DATA_BASE_URL": "http://127.0.0.1:8900",
    "JOBS_MINIO_SECURE": "false",
    "JOBS_MINIO_ACCESS_KEY": "miniouser",
    "JOBS_MINIO_SECRET_KEY": "miniosecret",
    "JOBS_MINIO_HOST": "127.0.0.1:9500",
    "JOBS_MINIO_DEFAULT_BUCKET": "jobs",
    "JOBS_MINIO_REGION": "us-west-1",
    "JOBS_MINIO_CREATE_BUCKETS": "false",
    "JOBS_MINIO_RESULTS_FORMAT": "results/{job.id}.json",
    "JOBS_MINIO_ARGUMENTS_FORMAT": "arguments/{job.id}.json",
    "JOBS_MINIO_SERVICES_PATH": "services/{job.service.bucket_name}",
    "JOBS_MINIO_LOGS_BUCKET": "",
    "JOBS_RABBITMQ_URI": "amqp://rabbitmquser:rabbitmqpassword@127.0.0.1:5672",
    "REGISTRY_TOKEN": "g_dka000111222333444",
    "LOG_FORMAT": "text",
    "SLACK_TOKEN": "",
    "LOGGING_CHANNEL": "",
    "TEST_METADATA_BASE_URL": "http://127.0.0.1:8801"
}`,
    keystrokes:
      'ggO{<Esc>Go}<CR><Esc>:%s/^# .*$/d/g<CR>:%g/^$/d<CR>:%s/\\(.*\\)=\\(.*\\)/    "\\1": "\\2",/g<CR>$x<Esc>',
  },
]

describe("db.json sequences", () => {
  cases.forEach(({ name, startText, targetText, keystrokes }) => {
    it(`replays ${name}`, () => {
      const finalText = replaySequence(startText, keystrokes)
      expect(finalText).toBe(targetText)
    })
  })
})




