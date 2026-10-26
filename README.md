<div align="center">
  <img src="./logo.png" alt="CodeBrain" width="120" />
  <h1>CodeBrain</h1>
</div>

CodeBrain answers natural-language questions about a public GitHub repository. It fetches the repository's files, splits them into chunks along AST boundaries, embeds each chunk, and stores the vectors in PostgreSQL. A question is embedded with the same model, matched against those vectors, and the closest chunks are passed to an LLM that answers from that context and cites the files and line ranges it used. Answers stream to the browser over Server-Sent Events.

Live instance: https://codebrain-gamma.vercel.app

Layout:

- `server/` — Express API, indexing and query pipelines, Vitest tests
- `client/` — React chat UI

## Contents

- [The short version](#the-short-version)
- [Architecture](#architecture)
- [Evaluation](#evaluation)
- [Tech stack](#tech-stack)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Limitations](#limitations)

---

## The short version

My first evaluation scored retrieval at **0 of 20**. I spent a while blaming the retrieval. The real problem was earlier in the pipeline: CodeBrain said "indexed successfully" while silently storing only part of the repository. On my test repo it stored 100 of 157 chunks, and the missing ones included the answers.

I rebuilt the embedding step so it plans around Google's rate limits instead of reacting to them, and so it saves either the whole repository or nothing. Together with two smaller retrieval changes, the same 14 questions now score:

| Metric            | Before         | After              |
| ----------------- | -------------- | ------------------ |
| Context recall    | 0 of 20 (0%)   | **18 of 20 (90%)** |
| Context precision | 0 of 55 (0%)   | **18 of 55 (33%)** |
| Faithfulness      | 13 of 14 (93%) | **13 of 14 (93%)** |

Every number here was counted by hand. The details, including what still fails, are below.

---

## Architecture

Two pipelines, one per endpoint.

### Indexing — `POST /api/v1/codebrain/index`

Body: `{ "repoUrl": "https://github.com/owner/repo" }`

Before any work, the controller returns early if the repository is already indexed. It rejects a repository with no supported files (422) or with more than 900 chunks (422). The 900 cap keeps one request inside the free tier's daily embedding quota.

1. **Fetch** (`github.service.ts`) — one recursive call to the GitHub Git Trees API for `HEAD`, rejected with 422 if GitHub reports the tree as truncated. Paths are filtered by `shouldIncludeFile`, which drops `node_modules/`, `dist/`, `build/`, `.git/`, `.next/`, `coverage/`, `.cache/`, `vendor/`, lock files, and binary/media extensions. Remaining blobs are fetched 10 at a time and base64-decoded. Files keep their original order, so two runs on the same repository produce the same chunks in the same order.
2. **Chunk** (`chunking.service.ts`) — each file is parsed with `@typescript-eslint/parser` and split at top-level AST boundaries. Only `.ts`, `.tsx`, `.js` and `.jsx` produce chunks. Per file, all `import` declarations are merged into a single chunk, and each top-level function, class, exported declaration and initialized variable becomes its own chunk. One-line chunks are dropped. Bare expression statements such as `app.use(...)` or `router.post(...)` are not chunked, and so are not retrievable. Each chunk carries `content`, `filePath`, `startLine`, `endLine`, `type` (`function | class | import | type | other`) and `extension`.
3. **Embed** (`embeding.service.ts`) — `gemini-embedding-001` at `outputDimensionality: 768`. Chunks are packed into batches by estimated size (about 12,000 tokens or 90 chunks per batch, whichever comes first; tokens estimated as characters ÷ 4). Before each batch is sent, the code checks whether it would push that minute's total over a 14,000-token budget. If it would, it waits a minute first. A per-minute 429 from Google is retried twice with the delay Google asks for. A daily-quota 429, or any error it can't identify, stops the whole run with an honest message. A single chunk too large to ever fit in a batch is rejected with 422 before anything is sent.
4. **Store** (`storage.service.ts`) — a single multi-row `INSERT` into the `chunk` table, run only after every batch has embedded. If embedding fails anywhere, nothing is stored. A half-indexed repository can't exist.

### Query — `POST /api/v1/codebrain/ask`

Body: `{ "repoUrl": "...", "question": "..." }`

1. **Retrieve** (`retrieval.service.ts`) — the question is embedded with the same model and dimensionality, then matched using pgvector's `<=>` operator: `ORDER BY embedding <=> $2 LIMIT 5`, filtered by `repoUrl`, excluding import chunks. Returns `content`, `filePath`, `startLine`, `endLine` and `type` for the five nearest chunks.
2. **Generate** (`llm.service.ts`) — one prompt is assembled from a fixed instruction block, the retrieved chunks (each prefixed with its file path and line range) and the question, then sent to `gemini-2.5-flash` via `generateContentStream`. Each token is written to the response as an SSE `data:` frame.
3. **Render** (`client/src/api/askQuestion.api.ts`) — the client reads the stream with `fetch` and a `ReadableStream` reader, splitting on `\n\n`. `EventSource` is not used, because the request needs a POST body. Output is rendered as Markdown.

Every route is wrapped in `asyncHandler`, which forwards rejected promises to `errorMiddleware`. That middleware maps `ApiError` to its own status code and anything else to a generic 500. All responses use the `ApiResponse` envelope: `{ statusCode, message, data, success }`.

---

## Evaluation

I built a golden set of 14 questions about [Critch](https://github.com/kasamthapa/critch), one of my own projects. I ran every question and scored each result by hand against three metrics: context recall, context precision, and faithfulness. I did it by hand rather than with an eval framework because I wanted to understand where each number comes from before trusting a tool to produce it.

### Method

- Every question is scoped to server-side code, so the answer key is unambiguous.
- The expected chunks come from the chunker's real output. A retrieved chunk counts as a hit only if file, start line and end line all match.
- Eleven questions have a known answer in the code (20 expected chunks in total). Three ask about features Critch doesn't have and are scored on faithfulness only.
- Recall and precision are pooled: total hits ÷ total expected, and total hits ÷ total retrieved (11 questions × 5 chunks = 55).

### What the first score was really measuring

The baseline scored 0 of 20, and I wrote two findings to explain it: import blocks were outranking implementations, and abstract questions pulled in generic chunks. Those patterns were real in the results. But when I checked the database, the repository wasn't fully there. The embedding step sent chunks to Google in batches of 10. When a batch failed on a rate limit, it was logged and skipped, and indexing still reported success. Critch had 157 chunks and only 100 were stored.

So the baseline mixed two causes: answers missing from the index, and weak retrieval. I can't separate them now. That's why the findings below are about the re-run, not the baseline.

### The fix: plan for the limits instead of reacting to them

Google's free tier has two per-minute limits on embeddings: 100 requests and 30,000 tokens. It also has a daily limit of 1,000 requests. These were the limits listed in Google's documentation when I measured.

My first theory was that one limit explained everything. It didn't. A different test repository only ever hit the request limit. Critch hits both, because some of its chunks are large: one batch of 10 chunks came to about 17,700 estimated tokens. Sent right after the batches before it in the same minute, that pushed past 30,000, and Google refused it with a 429 that carries no detail about which limit was hit.

Reacting to that error wasn't enough, because the error doesn't say what to wait for. So the embedding step now plans ahead. It packs batches by size instead of by count, keeps a running total of tokens sent this minute, and waits before a batch that would cross the budget. The budget (14,000 estimated tokens per minute) is deliberately below Google's 30,000, because characters ÷ 4 is only an estimate. It stays under the limit even if the real count is double. That margin is an assumption, tested by one successful run, not proven.

Before each real run, I wrote down what I expected to happen and compared it afterwards:

| Test                         | Before                | After      | Prediction held?                               |
| ---------------------------- | --------------------- | ---------- | ---------------------------------------------- |
| MERN-Movies-App (117 chunks) | 100 stored, "success" | 117 of 117 | Yes: one per-minute 429, retried, then success |
| Critch (157 chunks)          | 100 stored, "success" | 157 of 157 | Yes: 4 planned waits, no 429                   |

I also checked that a failed run really saves nothing: an earlier Critch run that hit the unidentified 429 left 0 rows, not a partial repository.

### Re-run results

Same 14 questions, same counting method. Before scoring, I checked that the answer chunks were actually in the database: 15 of the 16 distinct answer chunks were present. The missing one is a one-line export that the chunker now drops, so it can't be retrieved.

| Metric            | Baseline       | Re-run                                   |
| ----------------- | -------------- | ---------------------------------------- |
| Context recall    | 0 of 20 (0%)   | 18 of 20 (90%); 18 of 19 reachable (95%) |
| Context precision | 0 of 55 (0%)   | 18 of 55 (33%)                           |
| Faithfulness      | 13 of 14 (93%) | 13 of 14 (93%)                           |

**Three things changed between the two runs, not one:** the index is complete, one-line chunks are dropped, and retrieval skips import chunks. The jump from 0 to 18 is their combined effect. I didn't test them one at a time, so I won't claim how much each contributed.

**Precision looks low, but it's close to its ceiling.** Retrieval always returns 5 chunks, and most questions have only one correct answer. With 20 expected chunks across 55 retrieved slots, the best possible precision is 20 of 55 (36%). The re-run got 18.

**Faithfulness is the same number, but it means something different.** In the baseline, most passes were the model honestly saying "the code you asked about isn't here". In the re-run, the passes explain the actual implementation: the bcrypt hashing flow, the full refresh-token cycle, the cursor pagination, and the "average of averages" fix in the reputation score.

### What still fails

**The one faithfulness failure didn't change.** Asked how users are notified about account activity (Critch has no notifications), the model described the dashboard's flash-message and error banners as if they were the notification system. Every fact it cited was real. It invented nothing, but it presented unrelated code as a complete answer. This is confident misattribution, and it's more dangerous than an obvious hallucination because nothing looks wrong on a skim. The other two "feature doesn't exist" questions passed: the model said plainly that it found nothing.

**Line numbers in citations are unreliable.** I added a column that wasn't in the baseline: are the cited line numbers correct in the real file? Of the 7 answers I checked, 3 were correct and 4 were off. The described behaviour was right every time, but in one answer the model cited lines past the end of the file. In two answers about the same function, it gave different line numbers for the same code. This happens in long and short chunks alike. I scored it separately so the faithfulness rule stayed identical to the baseline.

**Two answer chunks were missed.** One (`uploadOnCloudinary`) was in the index but not retrieved. The model said its implementation wasn't provided rather than guessing at it. The other is the dropped one-line export.

### Next steps

1. **Number every line in the prompt**, so the model copies line numbers instead of counting them.
2. **Handle "this feature doesn't exist" explicitly** in the instructions, targeting the one remaining faithfulness failure.
3. **Fix the chunker gaps:** keep meaningful one-liners, and chunk top-level calls like `router.post(...)`, which are currently never indexed.

---

## Tech stack

| Layer        | Technology                                        |
| ------------ | ------------------------------------------------- |
| Server       | Node.js, Express 5, TypeScript                    |
| Client       | React 19, Vite, Tailwind CSS                      |
| Parsing      | `@typescript-eslint/parser`                       |
| Embeddings   | `gemini-embedding-001`, 768 dimensions            |
| LLM          | `gemini-2.5-flash` via `@google/genai`            |
| Vector store | PostgreSQL + pgvector, HNSW (`vector_cosine_ops`) |
| DB access    | `pg`, raw SQL, no ORM                             |
| Streaming    | Server-Sent Events                                |
| Tests        | Vitest                                            |

---

## Local setup

Requires Node.js and a PostgreSQL database with the `pgvector` extension available.

```bash
git clone https://github.com/kasamthapa/codebrain
cd codebrain
```

No migrations are checked in, so create the schema by hand before starting the server:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunk (
  id          bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  "repoUrl"   varchar,
  content     varchar,
  "filePath"  varchar,
  "startLine" smallint,
  "endLine"   smallint,
  type        text,
  extension   text,
  embedding   vector(768)
);

CREATE INDEX chunk_embedding_idx ON chunk USING hnsw (embedding vector_cosine_ops);
```

Server:

```bash
cd server && npm install && cp .env.example .env
npm run dev
```

Client, in a second terminal:

```bash
cd client && npm install
npm run dev
```

The server refuses to start if any required variable is missing. With both running, index a repository once, then ask questions against the same `repoUrl`:

```bash
curl -X POST http://localhost:8080/api/v1/codebrain/index -H "Content-Type: application/json" -d '{"repoUrl":"https://github.com/owner/repo"}'
```

Indexing a repository of a few hundred chunks takes several minutes on the free tier, because of the planned waits.

Other scripts: `npm test` (Vitest), `npm run build` (`tsc -b`), `npm run lint`, `npm run format`.

---

## Environment variables

Server, in `server/.env`:

| Variable         | Required | Description                                                                                         |
| ---------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `PORT`           | yes      | Port the API listens on                                                                             |
| `GEMINI_API_KEY` | yes      | Google AI Studio key, used for both embeddings and answer generation                                |
| `DATABASE_URL`   | yes      | PostgreSQL connection string; the database needs `pgvector`                                         |
| `GITHUB_TOKEN`   | yes      | GitHub token used to read repository trees and blobs                                                |
| `CORS_ORIGIN`    | yes      | Allowed browser origin                                                                              |
| `EVAL_LOG`       | no       | When set to `"true"`, logs the file path and line range of each retrieved chunk for evaluation runs |

Client, in `client/.env`:

| Variable            | Required | Description                                                                         |
| ------------------- | -------- | ----------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | yes      | API base, including the route prefix, e.g. `http://localhost:8080/api/v1/codebrain` |

---

## Limitations

- Only `.ts`, `.tsx`, `.js` and `.jsx` files produce chunks.
- Top-level calls such as `router.post(...)` and `app.use(...)` are never chunked, and one-line statements are dropped, so neither can be retrieved.
- Repositories over 900 chunks are refused, and so is any repository containing a single chunk too large to embed.
- The free tier's daily embedding quota is shared by every user of one API key. One large repository can use it up for everyone until it resets.
- Token counts are estimated (characters ÷ 4), not measured, so the per-minute budget is a safety margin rather than an exact limit.
- Indexing is slow by design. It waits rather than risk a refused batch.
- Re-indexing an already indexed repository does nothing; there is no refresh path.
- Retrieval always returns 5 chunks, filtered only by repository, so every file competes in the same pool.
- Cited line numbers can be wrong even when the explanation is right (see Evaluation).
- There is no conversation memory. Each question is answered independently.

---

Built by [Kasam Thapa Magar](https://github.com/kasamthapa)
