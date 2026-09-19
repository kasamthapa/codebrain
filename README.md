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

- [Architecture](#architecture)
- [Evaluation](#evaluation)
- [Tech stack](#tech-stack)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Limitations](#limitations)

---

## Architecture

Two pipelines, one per endpoint.

### Indexing — `POST /api/v1/codebrain/index`

Body: `{ "repoUrl": "https://github.com/owner/repo" }`

1. **Fetch** (`github.service.ts`) — one recursive call to the GitHub Git Trees API for `HEAD`, rejected with 422 if GitHub reports the tree as truncated. Paths are filtered by `shouldIncludeFile`, which drops `node_modules/`, `dist/`, `build/`, `.git/`, `.next/`, `coverage/`, `.cache/`, `vendor/`, lock files, and binary/media extensions. Remaining blobs are fetched 10 at a time and base64-decoded.
2. **Chunk** (`chunking.service.ts`) — each file is parsed with `@typescript-eslint/parser` and split at top-level AST boundaries. Only `.ts`, `.tsx`, `.js` and `.jsx` produce chunks; other file types are fetched but yield none. Per file, all `import` declarations are merged into a single chunk, and each top-level function, class, exported declaration and initialized variable becomes its own chunk. Bare expression statements such as `app.use(...)` or `router.post(...)` are not chunked, and so are not retrievable. Each chunk carries `content`, `filePath`, `startLine`, `endLine`, `type` (`function | class | import | type | other`) and `extension`.
3. **Embed** (`embeding.service.ts`) — `gemini-embedding-001` at `outputDimensionality: 768`, in sequential batches of 10. A batch that throws or returns a mismatched count is logged and skipped; indexing continues without it.
4. **Store** (`storage.service.ts`) — a single multi-row `INSERT` into the `chunk` table. If any row already exists for that `repoUrl`, the insert is skipped entirely, so re-indexing an already-indexed repository is a no-op rather than a refresh.

### Query — `POST /api/v1/codebrain/ask`

Body: `{ "repoUrl": "...", "question": "..." }`

1. **Retrieve** (`retrieval.service.ts`) — the question is embedded with the same model and dimensionality, then matched using pgvector's `<=>` operator: `ORDER BY embedding <=> $2 LIMIT 5`, filtered only by `repoUrl`. Returns `content`, `filePath`, `startLine` and `endLine` for the five nearest chunks; `type` and `extension` are stored but not selected.
2. **Generate** (`llm.service.ts`) — one prompt is assembled from a fixed instruction block, the retrieved chunks (each prefixed with its file path and line range) and the question, then sent to `gemini-2.5-flash` via `generateContentStream`. Each token is written to the response as an SSE `data:` frame.
3. **Render** (`client/src/api/askQuestion.api.ts`) — the client reads the stream with `fetch` and a `ReadableStream` reader, splitting on `\n\n`. `EventSource` is not used, because the request needs a POST body. Output is rendered as Markdown.

Every route is wrapped in `asyncHandler`, which forwards rejected promises to `errorMiddleware`. That middleware maps `ApiError` to its own status code and anything else to a generic 500. All responses use the `ApiResponse` envelope: `{ statusCode, message, data, success }`.

---

## Evaluation

I built a golden set of 14 questions to test whether retrieval and generation were
working as expected, ran every question myself, and scored each result by hand
against three metrics: context recall, context precision, and faithfulness.

I did this manually rather than reaching for an eval framework because I wanted to
understand where each number comes from. If a tool had reported a score before I'd
read my own failures, I'd have had no way to judge whether the tool was right.

### Method

Every question is scoped to server-side code. CodeBrain indexes both client and
server, but mixing them would have made the ground truth ambiguous — I wanted to
test one part properly rather than get a blurred result across the whole system.

The expected line numbers come from the chunker's actual output, not from reading
files by hand. This matters: retrieval returns file path plus start and end line,
so a chunk counts as a hit only if file, start line and end line match exactly.
That rule is only valid because the answer key was built from real chunk boundaries.

Eleven questions are positive cases with a known answer in the code. Three are
negative cases, asking about features Critch does not have, and are scored on
faithfulness alone.

Counting method: recall and precision are pooled across questions — total chunks
found divided by total expected, and total relevant divided by total retrieved —
rather than averaging per-question rates. Negatives are excluded from both.

### Results — baseline, before any fix

| Metric            | Result                                 |
| ----------------- | -------------------------------------- |
| Context recall    | 0 of 20 expected chunks retrieved (0%) |
| Context precision | 0 of 55 retrieved chunks relevant (0%) |
| Faithfulness      | 13 of 14 passed (93%)                  |

In practice this means retrieval is broken, not generation. CodeBrain is not finding
the chunks that actually answer the question — but the model does not invent an
answer to cover the gap. It answers from what it was given and tells the user plainly
that the code they asked about isn't in the retrieved context. In several cases it
named the exact thing that was missing: that the server handler for the avatar upload
route was absent from the context it received, for example.

The one faithfulness failure is examined below.

### Finding one: references outrank implementations

In five of the eleven positive questions, retrieval returned the place where
something is _named_ rather than the place where it is _implemented_. The import
block of `user.route.ts` outranked `refreshTokenController`. The import lines of
`cloudinary.ts` outranked `uploadOnCloudinary`. A `projectEditSchema.safeParse()`
call site outranked the schema definition. A client function that merely passes a
cursor parameter outranked the server controller that implements pagination. The
imports of `JwtPayload` outranked its three-line definition.

The mechanism is density, not frequency. Retrieval scores a chunk's average meaning,
not how many times a word appears in it. An import block is almost entirely
identifier names, so its average sits close to the question. A large multi-purpose
function mentions the same identifier several times, but averages it in with
everything else it does, so it ends up further away.

The same mechanism explains the opposite-looking failure. A controller of 80 to 95
lines handling fetching, formatting, pagination and response in one chunk has its
average split across all of them, so it is not strongly close to any single question.
Dilution and reference-beating-implementation are one mechanism seen from two sides.

This finding corrected an earlier theory of mine. I originally predicted that small,
single-purpose chunks would retrieve cleanly because they are sharp. The `JwtPayload`
question falsified that directly: the three-line definition was as small and focused
as a chunk can be, and it still lost to the chunks that merely import it. Small is
not sufficient. Density relative to the query is what decides.

_Inference, not measured:_ identifier tokenization may worsen this. If
`refreshToken` is split into `refresh` and `Token`, then unrelated token-adjacent
code earns partial credit toward the query, spreading the signal further. I have not
verified how the embedding model tokenizes identifiers, so this is offered as a
likely contributing factor rather than a result.

### Finding two: retrieval degrades as questions become more abstract

Questions phrased in vocabulary that exists in the code performed poorly. Questions
phrased in concepts that appear nowhere in the code performed worst of all. Asking
how data integrity is maintained, or how the reputation score weights its inputs,
produced the most degenerate results in the set — boilerplate, import lines and type
fragments, with no logic chunk retrieved at all.

The reason is that a chunk with little distinctive content sits in a neutral region
of the embedding space: weakly close to everything, strongly close to nothing. When
a question has a lexical anchor in the code, real matches outrank it. When it has
none, nothing scores strongly and the generic chunks win by default.

Single-line chunks carrying no meaningful content appeared in the top five for most
questions in the set.

Retrieval never fails loudly. It always returns five chunks. It simply returns its
most generic ones.

### The one faithfulness failure was not a hallucination

Asked how users are notified about account activity, the model described the
flash-message and error-banner system in the dashboard. Every fact it cited was real:
real file, real lines, real behaviour. It invented nothing. But Critch has no
notification system, and the model presented unrelated code as a complete answer,
with no indication that the feature might not exist.

This is confident misattribution rather than fabrication, and it is the more dangerous
of the two. Nothing in the answer looks suspicious on a skim, so a developer reading
it has no reason to verify.

The two other negative questions passed, and the contrast explains why. Asked whether
users can search for other users, the model found a search input whose placeholder
literally reads "Search projects…" — a hard textual signal contradicting the premise,
leaving no room to drift. "Account activity" had no such contradiction. Retrieval
returned code about things users do — clicking, submitting — which is loosely
compatible with the question, so the model filled the gap.

Faithfulness holds on a retrieval miss when the retrieved context contains an explicit
signal contradicting the question. Without one, the model can drift into confident
misattribution.

### Next step

Three changes, in increasing order of effort.

**1. Exclude import chunks from retrieval.** The chunker merges every import
declaration in a file into a single chunk whose content is nothing but identifier
names, giving it the highest possible density of query vocabulary. This accounts for
most of finding one. An import list is never the answer to how something works.
`type` is already stored on every chunk but is not selected during retrieval, so this
is a filter rather than a rewrite.

**2. Drop near-empty chunks at indexing time.** `export default router;` becomes its
own chunk because it is an export declaration, despite carrying almost no information.
A minimum content threshold removes the class.

**3. Split large functions.** Controllers of 80 to 95 lines are chunked whole, so one
embedding averages several responsibilities. Splitting below the top-level AST
boundary should sharpen what retrieval scores against.

I expect partial improvement, not a fix: recall of roughly five or six out of twenty.
The first two changes remove decoys; they do not make the correct chunks easier to
find. Closing that gap likely needs a lexical signal alongside vector similarity, or
filtering by file path so that layer is encoded outside the embedding — Critch defines
near-identical validation schemas on client and server, and nothing in a natural
question distinguishes them.

The same 14 questions will be re-run after these changes, scored by the identical
counting method, with both sets of numbers published here.

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

- Only `.ts`, `.tsx`, `.js` and `.jsx` files produce chunks. Other languages are fetched and then discarded at the chunking step.
- Code that is not a top-level declaration — route registrations, `app.use(...)` calls, and other bare expression statements — is never chunked, so it cannot be retrieved.
- Re-indexing a repository that is already in the database does nothing; there is no refresh or update path.
- Retrieval always returns 5 chunks and filters only by repository URL, so every file in the repository competes in the same pool.
- There is no conversation memory. Each question is answered independently.
- The Evaluation section measures what this costs in practice.

---

Built by [Kasam Thapa Magar](https://github.com/kasamthapa)
