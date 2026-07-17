<div align="center">
  <img src="./logo.png" alt="CodeBrain Logo" width="200" />

  <h1>CodeBrain</h1>
  <p><strong>Understand any codebase with AI.</strong></p>

  <p>
    Point CodeBrain at any public GitHub repository and ask it anything about the code —
    how a feature works, where logic lives, what a function does, how pieces connect.
    No more getting lost in unfamiliar codebases.
  </p>

  <img src="https://img.shields.io/badge/status-live-brightgreen" />
  <img src="https://img.shields.io/badge/stack-TypeScript%20%7C%20Node.js%20%7C%20React-blue" />
  <img src="https://img.shields.io/badge/building-in%20public-purple" />

  <p>
    <a href="https://codebrain-gamma.vercel.app"><strong>Live Demo →</strong></a>
  </p>
</div>

---

## What is CodeBrain?

Most developers have been there — dropped into a large codebase with no idea where to start. You read file after file, follow imports, trace function calls, and still feel lost after an hour.

CodeBrain fixes that. Give it a GitHub repo URL and ask your questions in plain language. It understands the code semantically — not just as text, but as structured logic — retrieves the most relevant chunks, and generates a grounded answer with file citations, streamed in real time.

---

## How It Works

```
GitHub Repo URL
      ↓
  Fetch all files via GitHub API
      ↓
  Parse each file into semantic chunks (functions, classes, imports)
      ↓
  Generate embeddings for each chunk
      ↓
  Store in vector database (pgvector)
      ↓
  Ask a question in the chat UI
      ↓
  Similarity search retrieves top matching chunks
      ↓
  LLM generates a grounded answer, streamed token-by-token
      ↓
  Answer + source file citations, live in the browser
```

---

## What's Built

### GitHub Ingestion

Fetches every relevant file from any public GitHub repository.

- Recursive tree fetch — one API call gets the entire file structure
- Smart filtering — skips binaries, images, lock files, build artifacts, and generated folders
- Batched parallel fetching — 10 files at a time with rate limit awareness
- Handles large repos gracefully with truncation detection

### Semantic Chunking

Splits code into meaningful units — not arbitrary line breaks.

- AST-based parsing using `@typescript-eslint/parser`
- Extracts functions, classes, arrow functions, default exports as individual chunks
- Groups all imports into a single context chunk per file
- Preserves file path, line numbers, and chunk type for precise retrieval
- Supports `.ts`, `.tsx`, `.js`, `.jsx`

### Embeddings

Converts each code chunk into a vector representation.

- `nomic-embed-text` via Ollama (local, no rate limits, no cost during development)
- 768-dimensional vectors — matches the planned production model, so no schema migration needed later
- Batched with `Promise.all`, failed chunks logged and skipped
- Chunks exceeding the model's ~8000-character context window are skipped (~4% of chunks)

### Vector Storage

Persists chunks and embeddings for retrieval.

- Supabase pgvector — runs inside the existing PostgreSQL instance, no separate vector infra
- HNSW index (`vector_cosine_ops`) for fast approximate nearest-neighbor search
- Repo-level deduplication before inserting

### Retrieval

Finds the most relevant code for a given question.

- Embeds the incoming question with the same embedding model
- Cosine similarity search (`<=>` operator) against stored vectors
- Returns the top 5 matching chunks with file path and line numbers

### Answer Generation

Generates a grounded, streamed response.

- Google `gemini-2.5-flash` via the `@google/genai` SDK
- Prompt built from instruction + retrieved chunks + user question
- Streamed token-by-token over Server-Sent Events (SSE)

### API

- `POST /api/v1/codebrain/index` — indexes a repository (fetch → chunk → embed → store)
- `POST /api/v1/codebrain/ask` — retrieves relevant chunks and streams an answer via SSE

### Chat UI

React frontend for the full flow, live at [codebrain-gamma.vercel.app](https://codebrain-gamma.vercel.app).

- Repo URL input with indexing trigger
- Question input with `EventSource` consuming the SSE stream
- Streamed answer rendering token-by-token with file citations

---

## What's Coming

- [ ] Support for more languages (Python, Go, Rust)
- [ ] Vector-based conversation memory (currently sliding window)
- [ ] Basic test coverage (Vitest)

---

## Tech Stack

| Layer      | Technology                                                          |
| ---------- | ------------------------------------------------------------------- |
| Backend    | Node.js, Express, TypeScript                                        |
| Frontend   | React, Vite, TypeScript                                             |
| Parsing    | `@typescript-eslint/parser`                                         |
| Embeddings | `nomic-embed-text` via Ollama (dev) → `gemini-embedding-001` (prod) |
| Vector DB  | Supabase pgvector (HNSW index, cosine similarity)                   |
| LLM        | Google Gemini `gemini-2.5-flash`                                    |
| Streaming  | Server-Sent Events (SSE)                                            |
| DB access  | Raw `pg` client for vector ops (Prisma doesn't support pgvector)    |

Full reasoning and tradeoffs for each decision are documented in the project's Architecture Decision Records (ADR-001 through ADR-004).

---

## Getting Started

> Try it live at [codebrain-gamma.vercel.app](https://codebrain-gamma.vercel.app), or run it locally:

```bash
git clone https://github.com/kasamthapa/codebrain
cd codebrain

# Server
cd server && npm install
cp .env.example .env  # add your GITHUB_TOKEN, Supabase, and Gemini keys
npm run dev

# Client
cd client && npm install
npm run dev
```

Requires a local [Ollama](https://ollama.com) instance with `nomic-embed-text` pulled for development embeddings.

---

## Building in Public

This project is being built entirely in the open. Every week of progress gets documented. Follow along if you're interested in how RAG systems, AST parsing, and vector search come together in a real product.

---

<div align="center">
  <p>Built by <a href="https://github.com/kasamthapa">Kasam Thapa Magar</a></p>
</div>
