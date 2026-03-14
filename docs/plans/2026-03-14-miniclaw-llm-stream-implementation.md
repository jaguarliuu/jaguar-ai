# MiniClaw LLM Stream Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `OpenAiCompatibleLlmClient` support OpenAI-compatible streaming responses as described in `chapter-04/llm-stream`, with automated regression tests.

**Architecture:** Keep the existing `OpenAiCompatibleLlmClient` as the integration point. Add deterministic unit tests around SSE parsing and stream emission, then implement the minimal `stream()` and `parseSseChunk()` behavior the course chapter describes. Fix only the build issues that block this feature from compiling and being verified on the current JDK.

**Tech Stack:** Java 21+ source level, Spring Boot 3.4, WebFlux `WebClient`, Reactor `Flux`, Jackson, JUnit 5, Reactor Test, Maven, Lombok

---

### Task 1: Lock the target behavior with tests

**Files:**
- Create: `miniclaw/backend/src/test/java/com/miniclaw/llm/OpenAiCompatibleLlmClientStreamTest.java`
- Modify: `miniclaw/backend/src/main/java/com/miniclaw/llm/OpenAiCompatibleLlmClient.java`

**Step 1: Write the failing test**

Create tests that cover:
- normal content chunks from SSE lines
- a finish chunk with `finish_reason`
- a terminal `[DONE]` event
- invalid JSON lines being ignored instead of failing the whole stream

Use a mocked `ExchangeFunction` so no real HTTP request is sent.

**Step 2: Run test to verify it fails**

Run: `./mvnw -Dtest=OpenAiCompatibleLlmClientStreamTest test`

Expected: FAIL because `stream()` currently throws `UnsupportedOperationException`.

**Step 3: Do not implement yet**

Keep production code unchanged until the failure is observed.

**Step 4: Commit**

Skip commit in this session unless explicitly requested.

### Task 2: Fix the build prerequisites

**Files:**
- Modify: `miniclaw/backend/pom.xml`
- Delete: `miniclaw/backend/src/main/java/com/miniclaw/config/LlmProperties.java`

**Step 1: Add the failing compile context to the plan**

Current blockers:
- Lombok is not configured for annotation processing on JDK 24
- duplicate `LlmProperties` classes under different packages create invalid/confusing Spring configuration

**Step 2: Write the minimal build fix**

Update `pom.xml` to:
- pin a Lombok version with JDK 24 support
- configure `maven-compiler-plugin` with explicit Lombok annotation processor path

Delete the duplicate `com.miniclaw.config.LlmProperties` class because the active code uses `com.miniclaw.llm.LlmProperties`.

**Step 3: Run compile to verify blockers are gone**

Run: `./mvnw -q -DskipTests compile`

Expected: compile succeeds or the remaining errors point only to unimplemented stream behavior.

**Step 4: Commit**

Skip commit in this session unless explicitly requested.

### Task 3: Implement streaming support minimally

**Files:**
- Modify: `miniclaw/backend/src/main/java/com/miniclaw/llm/OpenAiCompatibleLlmClient.java`

**Step 1: Implement the smallest code that satisfies the tests**

Add:
- `stream(LlmRequest request)` using `stream=true`
- `Accept: text/event-stream`
- `bodyToFlux(String.class)`
- blank-line filtering
- SSE `data:` extraction
- JSON parsing for `choices[0].delta.content` and `choices[0].finish_reason`
- `[DONE]` handling
- invalid line tolerance

**Step 2: Keep testability simple**

Add a package-private constructor or helper path only if needed to inject a custom `WebClient` in tests. Avoid broader refactors.

**Step 3: Run the focused test**

Run: `./mvnw -Dtest=OpenAiCompatibleLlmClientStreamTest test`

Expected: PASS

**Step 4: Refactor lightly**

Only extract helpers if it improves readability without changing behavior.

### Task 4: Verify no regression in backend build

**Files:**
- Verify only

**Step 1: Run the backend test suite**

Run: `./mvnw test`

Expected: PASS

**Step 2: Run compile again for clean evidence**

Run: `./mvnw -q -DskipTests compile`

Expected: PASS

**Step 3: Compare against the chapter**

Re-read `content/courses/miniclaw/chapters/04-06-llm-stream.md` and confirm:
- `stream=true`
- SSE media type
- line filtering
- `parseSseChunk()` behavior
- `[DONE]` completion handling

**Step 4: Commit**

Skip commit in this session unless explicitly requested.
