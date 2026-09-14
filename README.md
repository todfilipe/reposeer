<a id="top"></a>

<div align="center">

<img src="docs/readme/hero.svg" width="100%" alt="RAG Codebase Chat. No LangChain, every layer built from scratch. Ask questions about any GitHub repository. Instant semantic search and code reasoning for your entire codebase. Answers grounded in the actual files, with citations you can check.">

<br><br>

<a href="https://reposeer.me"><img src="docs/readme/button-website.svg" height="40" alt="Website"></a>
<a href="#architecture"><img src="docs/readme/button-architecture.svg" height="40" alt="Architecture"></a>

<br><br>

<a href="https://github.com/todfilipe/reposeer/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/todfilipe/reposeer/release.yml?branch=main&style=flat-square&labelColor=161b22&color=f8a71d&label=CI" alt="CI status"></a>
<img src="https://img.shields.io/badge/Python-3.12-f8a71d?style=flat-square&labelColor=161b22" alt="Python 3.12">
<img src="https://img.shields.io/badge/Next.js-16-f8a71d?style=flat-square&labelColor=161b22" alt="Next.js 16">
<img src="https://img.shields.io/badge/FastAPI-0.116%2B-f8a71d?style=flat-square&labelColor=161b22" alt="FastAPI 0.116+">
<img src="https://img.shields.io/badge/pgvector-HNSW-f8a71d?style=flat-square&labelColor=161b22" alt="pgvector with HNSW">
<a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-f8a71d?style=flat-square&labelColor=161b22" alt="MIT License"></a>

<br><br>

<a href="#product"><img src="docs/readme/nav-product.svg" height="34" alt="Product"></a>
<a href="#how-it-works"><img src="docs/readme/nav-how-it-works.svg" height="34" alt="How it works"></a>
<a href="#architecture"><img src="docs/readme/nav-architecture.svg" height="34" alt="Architecture"></a>
<a href="#features"><img src="docs/readme/nav-features.svg" height="34" alt="Features"></a>
<a href="#decisions"><img src="docs/readme/nav-decisions.svg" height="34" alt="Decisions"></a>
<a href="#quickstart"><img src="docs/readme/nav-quickstart.svg" height="34" alt="Quickstart"></a>

</div>

<br>

<a id="product"></a>

<img src="docs/readme/section-01.svg" width="100%" alt="01 / Product: See it answer from the code">

Paste a public GitHub URL, watch it index, then ask. The sources panel fills as soon as retrieval finishes, before the first token of the answer is written.

<img src="docs/readme/preview.svg" width="100%" alt="Walkthrough on facebook/react: the repository URL is typed and Analyze repository is pressed; indexing moves through Reading repository structure, Reading code files, Generating embeddings, Saving to index and Ready; a question about React reconciliation shows Searching the codebase while the sources panel fills with ReactFiberBeginWork.js, ReactFiber.js and ReactChildFiber.js; the answer then streams in with a code block and file citations.">

<sub>Illustrative walkthrough built from the app's own interface copy and the sample conversation on the landing page.</sub>

<br>

<a id="why"></a>

<img src="docs/readme/section-02.svg" width="100%" alt="02 / Why: Reading an unfamiliar codebase is slow">

<p align="center">
<img src="docs/readme/card-problem.svg" width="49%" alt="The problem. Unfamiliar code is slow to read: finding where something is defined or how a flow works means jumping between files and guessing where to start.">
<img src="docs/readme/card-solution.svg" width="49%" alt="The approach. Index once, then just ask: the repository is indexed a single time, and answers come from the retrieved code and cite the files they used, so you can check them.">
</p>

<br>

<a id="how-it-works"></a>

<img src="docs/readme/section-03.svg" width="100%" alt="03 / How it works: Two pipelines, one vector store">

Indexing and answering are two separate flows in `apps/rag-service` that meet in one Postgres table. Every value below is read from the code: `chunker.py`, `embeddings.py`, `github_client.py`, `retriever.py`, `generator.py`.

<img src="docs/readme/pipeline.svg" width="100%" alt="Indexing, POST /index: GitHub API reads the tree and blobs without cloning; files are filtered by 34 extensions and 100 KB and diffed by git blob SHA; chunked into 2000 characters with 200 overlap; embedded with gemini-embedding-2 at 768 dimensions in batches of 25; stored in code_chunks and indexed_files in Supabase Postgres with pgvector and an HNSW cosine index. Question, POST /query: user_id from the session; question embedded with the same model; match_chunks returns the top 5 with no cutoff; gemini-3.1-flash-lite-preview generates; the answer streams over SSE as sources, then token events, then done.">

<details>
<summary><b>Sequence: asking a question</b></summary>
<br>

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant W as web (Next.js)
    participant R as rag-service (FastAPI)
    participant G as Gemini
    participant S as Supabase

    B->>W: POST /api/query { repoId, question }
    W->>W: session user, rate limit, monthly message quota
    W->>R: POST /query + Bearer token + user_id from session
    R->>G: embedContent (768-dim)
    R->>S: rpc match_chunks(embedding, repo_id, user_id, 5)
    R-->>W: event: sources
    W-->>B: event: sources
    R->>G: streamGenerateContent?alt=sse
    loop while Gemini writes
        R-->>W: event: token
        W-->>B: event: token
    end
    R-->>W: event: done
    W-->>B: event: done
```

</details>

<details>
<summary><b>Sequence: indexing a repository</b></summary>
<br>

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant W as web (Next.js)
    participant R as rag-service (FastAPI)
    participant H as GitHub API
    participant G as Gemini
    participant S as Supabase

    B->>W: POST /api/index { repoUrl }
    W->>W: session user, rate limit, repository quota
    W->>R: POST /index + Bearer token + user_id
    R->>S: upsert repos row
    R->>H: repo info + recursive tree
    R-->>W: 202 { repo_id, files_found }
    W-->>B: 202, redirect to /repo/{repo_id}
    par background task
        R->>S: stored blob SHAs from indexed_files
        R->>H: blobs of changed files only
        R->>R: chunk 2000/200, check chunk quotas
        R->>G: batchEmbedContents, 25 per request
        R->>S: insert code_chunks, then indexed_files
    and every 2 seconds
        B->>W: GET /api/index/{repo_id}/status
        W->>R: GET /index/{repo_id}/status?user_id
    end
```

</details>

<br>

<a id="architecture"></a>

<img src="docs/readme/section-04.svg" width="100%" alt="04 / Architecture: Two services, two auth boundaries">

<img src="docs/readme/architecture.svg" width="100%" alt="The browser reaches nginx on a single VPS over HTTPS. nginx terminates TLS and proxies to the web container, published on 127.0.0.1 only, with buffering off for the SSE route. Inside docker compose, web calls rag-service over the internal network; rag-service publishes no port. web talks to Stripe, reads Supabase under RLS, and writes subscriptions from the Stripe webhook with the service_role key. rag-service talks to Supabase with the service_role key, to Gemini and to the GitHub API. A push to main reruns CI, publishes both images to GHCR with SHA and semver tags, and the server pulls them with docker-compose.prod.yml.">

Two boundaries, and neither replaces the other:

1. **Session.** The browser only ever talks to `web`. `proxy.ts` validates the Supabase Auth cookie with `getUser()`, and every Route Handler takes `user_id` from that session, never from the request body.
2. **Service.** `web` calls `rag-service` with `Authorization: Bearer <RAG_SERVICE_INTERNAL_TOKEN>`, checked with `secrets.compare_digest`. Only `GET /health` answers without it, and the service is not reachable from outside the compose network anyway.

<br>

<a id="features"></a>

<img src="docs/readme/section-05.svg" width="100%" alt="05 / Features: What ships today">

<p align="center">
<img src="docs/readme/card-repository.svg" width="32%" alt="Any public repository: paste a github.com URL; files are read through the GitHub API, no clone, with extension, size and folder filters.">
<img src="docs/readme/card-progress.svg" width="32%" alt="Live indexing progress: five named steps and a chunk counter, polled every 2 seconds; the repo id lives in the URL, so refresh is safe.">
<img src="docs/readme/card-incremental.svg" width="32%" alt="Incremental reindex: git blob SHAs decide what changed; unchanged files are never downloaded or embedded again.">
<img src="docs/readme/card-streaming.svg" width="32%" alt="Streaming answers: tokens arrive over Server-Sent Events, proxied by Next.js without buffering and cancelled when the tab closes.">
<img src="docs/readme/card-sources.svg" width="32%" alt="Sources before tokens: retrieved chunks arrive first, with the excerpt, a match score and a link to the exact lines on GitHub.">
<img src="docs/readme/card-login.svg" width="32%" alt="GitHub or email login: Supabase Auth; GitHub OAuth asks only for user:email, never for access to anyone's repositories.">
<img src="docs/readme/card-dashboard.svg" width="32%" alt="Repository dashboard: reindex or remove repositories and track repos, messages and chunks indexed this month against the plan.">
<img src="docs/readme/card-billing.svg" width="32%" alt="Stripe plans: Free, Pro and Ultra with Checkout, the customer portal and signature-checked subscription webhooks.">
<img src="docs/readme/card-isolation.svg" width="32%" alt="Per-user isolation: every chunk carries a user_id; match_chunks filters on it and RLS policies guard the web app's reads.">
</p>

<details>
<summary><b>Plan limits</b>, straight from <code>supabase/migrations/0004_billing.sql</code></summary>
<br>

| | Free | Pro | Ultra |
|---|---:|---:|---:|
| Price per month | €0 | €9 | €28 |
| Repositories | 3 | 30 | 70 |
| Chunks per repository | 1,000 | 10,000 | 40,000 |
| Messages per month | 100 | 1,500 | 5,000 |
| Chunks indexed per month (fair use) | 5,000 | 70,000 | 200,000 |

Repository and message limits are enforced in `apps/web` before `rag-service` is called (`402`). Chunk limits are enforced in `rag-service` between chunking and the first embedding, so a refused indexing job costs nothing.

</details>

<br>

<a id="decisions"></a>

<img src="docs/readme/section-06.svg" width="100%" alt="06 / Decisions: Why it is built this way">

<details>
<summary><b>Why a separate Python service for RAG?</b></summary>
<br>

**Context.** The first prototype was a single Next.js app with the whole pipeline in TypeScript.

**Decision.** Ingestion, chunking, embeddings, retrieval, generation and streaming moved to FastAPI in `apps/rag-service`. Next.js keeps identity, billing, the dashboard and the proxy. The rule: code that touches source text, vectors or the LLM goes to Python; identity, payments and presentation stay in `apps/web`.

**Trade-off.** Two services to build and deploy, and a network boundary with new failure modes. The web app turns them into explicit errors: `502 rag_service_unavailable`, `504 upstream_timeout`, and the upstream `401` for a wrong token.

</details>

<details>
<summary><b>Why no LangChain, and no vendor SDKs?</b></summary>
<br>

**Context.** The goal was to understand every layer of RAG, not only to get answers out of it.

**Decision.** GitHub, Gemini and Supabase are called over plain HTTP with `httpx` (and `fetch` on the web side). Writes go straight to PostgREST: an upsert is a `POST` with `Prefer: resolution=merge-duplicates`, similarity search is `POST /rpc/match_chunks`.

**Trade-off.** PostgREST details show up in the code (`return=minimal`, `application/vnd.pgrst.object+json`). In return there are fewer dependencies, and no synchronous `supabase-py` client blocking FastAPI's event loop.

</details>

<details>
<summary><b>Why one VPS instead of Vercel and Railway?</b></summary>
<br>

**Context.** `POST /index` answers `202` and keeps working in a background task, so the RAG service needs a process that stays up no matter what.

**Decision.** Both services run with Docker Compose on one VPS behind nginx. Only `web` is published, on `127.0.0.1`; `rag-service` has no published port, so the internal token is not its only defence. Images are built and tested in GitHub Actions and pulled from GHCR, never compiled on the server.

**Trade-off.** No preview deploys, CDN or autoscaling, and deploying is a manual `docker compose pull`. Every commit on `main` has its own image tag, so rollback is pulling an older SHA.

</details>

<details>
<summary><b>How are users kept apart?</b></summary>
<br>

**Context.** `rag-service` talks to Supabase with the `service_role` key, which bypasses Row Level Security by design.

**Decision.** `repos`, `code_chunks` and `indexed_files` all carry a non-null `user_id`. `match_chunks` filters on `repo_id` and `user_id` inside SQL, and `user_id` is always taken from the session. RLS policies (`auth.uid() = user_id`) cover everything the web app reads with the anon key.

**Trade-off.** On the RAG path isolation depends on that filter rather than on RLS, so it is tested on both sides: pytest checks that `user_id` reaches `match_chunks`, and `supabase/tests/rls_isolation.sql` checks the policies. A repository that belongs to someone else returns the same `404` as one that does not exist.

</details>

<details>
<summary><b>Why incremental reindexing by blob SHA?</b></summary>
<br>

**Context.** Reindexing used to delete everything and embed the whole repository again, even when one file had changed. With that, "unlimited re-indexing" could not be offered on any plan.

**Decision.** The GitHub tree already lists each file's git blob SHA. It is compared with `indexed_files`: an unchanged SHA is skipped without downloading the file, a changed one has its chunks replaced, a path that disappeared has its chunks deleted. The SHA is recorded only after that file's chunks are saved.

**Trade-off.** There is no rollback: a run that fails midway leaves partial state, and the next run redoes every file without a recorded SHA. If chunking parameters change, `force: true` is needed, because SHAs cannot tell that stored chunks are stale.

</details>

<details>
<summary><b>Why fixed-size chunks of 2000 characters with 200 overlap?</b></summary>
<br>

**Context.** Code has to be cut into pieces that fit the embedding model and still carry enough context.

**Decision.** Fixed windows measured in characters, overlapping by 200. Each chunk also stores `start_line` and `end_line`, computed while the whole file is still in memory, so a source can link to `#L120-L160` on GitHub.

**Trade-off.** Splitting on function boundaries would need a parser per language, and counting tokens would need a tokenizer. Characters are Python code points, so offsets drift from JavaScript's UTF-16 indexes in files with emoji; the UI shows the stored excerpt instead of slicing files by offset.

</details>

<details>
<summary><b>Why top-k 5 with no similarity threshold?</b></summary>
<br>

**Context.** Relevant chunks scored around 0.65 to 0.7 and irrelevant ones around 0.4 to 0.5, which is not a stable line to cut on.

**Decision.** The 5 closest chunks always go into the prompt, and the model decides what is useful. The system instruction has five rules: grounding, admit missing information, cite file paths, answer in the question's language, be concise.

**Trade-off.** Some irrelevant context reaches the model. In exchange, the cost of a question is bounded: at most five chunks of 2000 characters.

</details>

<details>
<summary><b>Why SSE with named events instead of WebSockets?</b></summary>
<br>

**Context.** A question is one request and one streamed answer; nothing needs to flow back while it is generated.

**Decision.** `POST /query` emits `sources` first, then `token` events, then `done`, or `error` if generation fails mid-stream. The Next.js route hands `upstream.body` to the browser without reading it, and nginx has `proxy_buffering off` on `/api/query`.

**Trade-off.** `EventSource` only supports GET, and the question travels in the body, so the browser reads the stream with `fetch` and a small SSE parser in `lib/sse.ts`.

</details>

<details>
<summary><b>The 429s were tokens per minute, not requests</b></summary>
<br>

**Context.** Indexing failed with `429` from Gemini. The quota panel showed 37 of 100 requests per minute, but 39.6K of 30K tokens per minute.

**Decision.** One limiter for the whole process caps embeddings at 25,000 tokens per minute over a sliding window, estimating 3 characters per token, and retries on `429`. Embeddings go out in batches of 25 so the free tier's daily request limit is not exhausted either.

**Trade-off.** Concurrent indexing jobs share the budget and wait for each other. The limiter lives in memory, which is why `rag-service` runs a single uvicorn worker; more replicas would need a shared counter.

</details>

<br>

<a id="stack"></a>

<img src="docs/readme/section-07.svg" width="100%" alt="07 / Stack: Every layer, by name">

<img src="docs/readme/stack.svg" width="100%" alt="Product, apps/web: Next.js 16.2, React 19.2, TypeScript 5, Tailwind CSS 4, @supabase/ssr 0.12, stripe 22. RAG, apps/rag-service: Python 3.12, FastAPI 0.116+, httpx 0.28+, pydantic-settings 2.10+, uvicorn 0.35+, no LangChain and no SDKs. Data and AI: Postgres with pgvector, HNSW cosine index, Supabase Auth with RLS, gemini-embedding-2, gemini-3.1-flash-lite, 5 SQL migrations. Ship and test: Docker Compose, uv with ruff and mypy, GitHub Actions, GHCR images, pytest, Vitest with ESLint 9.">

<br>

<a id="quickstart"></a>

<img src="docs/readme/section-08.svg" width="100%" alt="08 / Quickstart: Run it yourself">

<img src="docs/readme/terminal.svg" width="100%" alt="git clone https://github.com/todfilipe/reposeer.git, cd reposeer, cp .env.example .env and fill the two app env files, docker compose up --build. The web app is on http://localhost:3000.">

### Requirements

- Node.js 22, Python 3.12 with [uv](https://docs.astral.sh/uv/), and Docker (for the local Supabase stack)
- A Gemini API key and a GitHub token that can read public repositories
- Optional: a Stripe account in test mode. Without `STRIPE_SECRET_KEY` everyone stays on the Free plan and the pricing pages are hidden

### 1. Database

Start a local Supabase stack. It applies the migrations in `supabase/migrations/` and seeds a test user, `dev@example.com` with password `password123`:

```bash
npx supabase start
```

`npx supabase status -o env` prints the values for the env files: `API_URL` goes in `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SERVICE_ROLE_KEY` in `SUPABASE_SERVICE_ROLE_KEY`. `npx supabase db reset` rebuilds the database from scratch.

With a hosted Supabase project instead, apply the migrations in order with `psql` and your connection string:

```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

With Stripe configured, paid plans only show a Subscribe button once they point at a Stripe price:

```sql
update plans set stripe_price_id = 'price_...' where id = 'pro';
update plans set stripe_price_id = 'price_...' where id = 'ultra';
```

For GitHub login, enable the GitHub provider in Supabase under Authentication, Providers. The OAuth app credentials live there, not in the env files.

### 2. Environment

Generate one internal token and use the same value in both services:

```bash
openssl rand -hex 32
```

Copy the examples and fill them in. The two `STRIPE_*` variables can stay empty.

```bash
cp apps/rag-service/.env.example apps/rag-service/.env
cp apps/web/.env.example apps/web/.env.local
```

`.env` at the root, read only by Docker Compose. `NEXT_PUBLIC_*` values are baked into the Next.js build, so they are passed as build args:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Run

**With Docker Compose.** `web` is published on `127.0.0.1:3000` (override with `WEB_PORT`), and `rag-service` stays on the internal network with `RAG_SERVICE_URL` set to `http://rag-service:8000` for you. Inside the containers `127.0.0.1` is the container itself, so this path needs a hosted Supabase project; with the local stack, run each app on its own.

```bash
docker compose up --build
```

**Or each app on its own.** `rag-service`:

```bash
cd apps/rag-service
uv sync --locked --extra dev
uv run uvicorn app.main:app --reload --port 8000
```

`web`, in a second terminal:

```bash
cd apps/web
npm ci
npm run dev
```

To receive subscription webhooks locally, forward them with the Stripe CLI and put the signing secret it prints in `STRIPE_WEBHOOK_SECRET`:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 4. Test

```bash
cd apps/rag-service && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest
```

```bash
cd apps/web && npm run lint && npm run typecheck && npm test
```

The RLS script creates two users, asserts what each one can read and change, and rolls everything back. CI runs it the same way, against the local Supabase database:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation.sql
```

<br>

<a id="quality"></a>

<img src="docs/readme/section-09.svg" width="100%" alt="09 / Quality: Tested, isolated, rate limited">

<img src="docs/readme/quality.svg" width="100%" alt="CI on every pull request: ruff, mypy, pytest, ESLint, tsc, Vitest and gitleaks. rag-service tests with pytest: chunker, internal token, repo and user isolation. Proxy route tests with Vitest: /api/index, /api/query, index status and the rate limiter. RLS isolation script: runs in CI against a fresh local Supabase database. rag-service not reachable: no published port in either compose file. Constant-time internal token: secrets.compare_digest, only /health is open. Per-user rate limits: 10 questions and 5 index requests per minute. No existence leaks: another user's repo gets the same 404 as a missing one.">

> [!NOTE]
> CI runs ruff, mypy, pytest, ESLint, the TypeScript check, Vitest, gitleaks and the RLS script against a fresh local Supabase database, and builds both images. The per-user rate limiter keeps its counters in memory, which fits the single `web` container this project deploys.

<br>

<img src="docs/readme/footer.svg" width="100%" alt="RAG Codebase Chat. Retrieval-augmented answers, grounded in real code. Built by Filipe, open source on GitHub. reposeer.me">

<div align="center">
<sub>
<a href="https://reposeer.me">Website</a> ·
<a href="https://github.com/todfilipe/reposeer">Source</a> ·
<a href="#decisions">Decisions</a> ·
<a href="#top">Back to top</a>
</sub>
</div>
