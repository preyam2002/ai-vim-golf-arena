import { describe, expect, test } from "vitest";
import {
  createInitialState,
  executeKeystroke,
  tokenizeKeystrokes,
} from "./vim-engine";

function runGolfTest(
  initialText: string,
  keystrokes: string,
  expectedText: string
) {
  let state = createInitialState(initialText);
  const tokens = tokenizeKeystrokes(keystrokes);
  for (const token of tokens) {
    state = executeKeystroke(state, token);
  }
  expect(state.lines.join("\n")).toBe(expectedText);
}

describe("vim-golf scenarios", () => {
  test("Delete Every Other Line (Manual)", () =>
    runGolfTest("a\nb\nc\nd\ne", "jddjdd", "a\nc\ne"));

  test("Indent All Lines", () =>
    runGolfTest("a\nb\nc", "ggVG>", "  a\n  b\n  c"));

  test("Append to End of Lines", () =>
    runGolfTest("item1\nitem2", "A;<Esc>j.", "item1;\nitem2;"));

  test("Change Word", () =>
    runGolfTest("hello world", "wcwvim<Esc>", "hello vim"));

  test("Visual Block Insert", () =>
    runGolfTest("a\nb\nc", "<C-v>jjIx <Esc>", "x a\nx b\nx c"));

  test("Challenge 9v00680e54330000000006c0 env-to-json sequence", () =>
    runGolfTest(
      `# API Settings
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
      String.raw`ggO{<Esc>Go}<CR><Esc>:%s/^# .*$//g<CR>:%g/^$/d<CR>:%s/\(.*\)=\(.*\)/ "\1": "\2",/g<CR>$x<Esc>gg4>>Gkk<<`,
      `{
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
}
`
    ));
});
