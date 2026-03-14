# MiniClaw LLM Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild chapter 4.7 around a modern LLM client reliability layer, implement the matching backend code first, verify it, and only then rewrite the course document.

**Architecture:** Keep reliability inside `OpenAiCompatibleLlmClient` for now. Add a small structured exception layer plus a shared retry policy for sync and stream calls, using Reactor retry instead of blocking sleep loops. After code and tests are green, rewrite `04-07-error-handling.md` to explain the actual implementation rather than a hypothetical one.

**Tech Stack:** Java 21, Spring Boot 3.4, WebFlux `WebClient`, Reactor `Mono`/`Flux`, Reactor Retry, Jackson, JUnit 5, Reactor Test, Maven, Markdown

---

### Task 1: Persist repository workflow rules

**Files:**
- Create: `CODEX.md`

**Step 1: Write the workflow document**

Document:
- `miniclaw/` is a course project workspace, not a git-managed deliverable
- always implement code before editing course docs
- always verify backend code before updating docs
- docs must describe the code that actually exists

**Step 2: No tests needed**

This is a repository instruction file.

### Task 2: Lock reliability behavior with failing tests

**Files:**
- Create: `miniclaw/backend/src/test/java/com/miniclaw/llm/OpenAiCompatibleLlmClientReliabilityTest.java`

**Step 1: Write the failing tests**

Cover these behaviors with a local HTTP server:
- `chat()` retries once on `503` and eventually succeeds
- `chat()` does not retry on `401` and throws a structured LLM exception
- `stream()` retries once on `503` and then yields SSE chunks successfully

**Step 2: Run the focused test to verify RED**

Run: `./mvnw -Dtest=OpenAiCompatibleLlmClientReliabilityTest test`

Expected: FAIL because current code has no structured exception model and no retry logic.

### Task 3: Implement minimal reliability infrastructure

**Files:**
- Create: `miniclaw/backend/src/main/java/com/miniclaw/llm/LlmException.java`
- Create: `miniclaw/backend/src/main/java/com/miniclaw/llm/LlmErrorType.java`
- Modify: `miniclaw/backend/src/main/java/com/miniclaw/llm/LlmProperties.java`
- Modify: `miniclaw/backend/src/main/java/com/miniclaw/llm/OpenAiCompatibleLlmClient.java`

**Step 1: Add structured error types**

Create an exception type that carries:
- error category
- retryable flag
- optional HTTP status

**Step 2: Add retry tuning properties**

Add minimal config fields for:
- `maxRetries`
- `retryMinBackoffMillis`
- `retryMaxBackoffMillis`

**Step 3: Implement shared retry behavior**

Use Reactor retry for both sync and stream paths:
- map HTTP response codes to structured exceptions
- retry only for transient categories like `429`, `408`, `5xx`, timeout, connect failure
- keep `401`, `400`, `403`, `404` non-retryable
- log retry attempt number and reason

**Step 4: Re-run the focused test to verify GREEN**

Run: `./mvnw -Dtest=OpenAiCompatibleLlmClientReliabilityTest test`

Expected: PASS

### Task 4: Run broader backend verification

**Files:**
- Verify only

**Step 1: Run full backend tests**

Run: `./mvnw test`

Expected: PASS

**Step 2: Run compile**

Run: `./mvnw -DskipTests compile`

Expected: `BUILD SUCCESS`

### Task 5: Rewrite chapter 4.7 after code is verified

**Files:**
- Modify: `content/courses/miniclaw/chapters/04-07-error-handling.md`

**Step 1: Rewrite the lesson structure**

Teach:
- why reliability is an infrastructure concern
- error taxonomy
- structured exceptions
- Reactor retry with backoff and jitter
- sync and stream sharing the same policy
- what is intentionally deferred to later chapters

**Step 2: Keep the document aligned to code**

All code snippets must match the implementation in `miniclaw/backend`.

**Step 3: Final verification**

Re-read the rewritten doc and confirm it no longer teaches:
- blocking `Thread.sleep`
- string matching on exception messages as the primary strategy
- behavior that does not exist in code
