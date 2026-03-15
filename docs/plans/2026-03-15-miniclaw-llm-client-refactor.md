# MiniClaw LLM Client Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `OpenAiCompatibleLlmClient` into a small coordinator plus focused collaborators, while keeping `LlmClient` behavior stable and updating chapter 4.11 to teach the refactor.

**Architecture:** Keep `OpenAiCompatibleLlmClient` as the public facade. Extract provider resolution, request mapping, response parsing, and execution/retry support into internal collaborators. Preserve current external tests as behavior guards and add a few focused component tests for the new seams.

**Tech Stack:** Java 21, Spring Boot 3, WebFlux, Reactor, JUnit 5, Jackson, MDX content docs

---

### Task 1: Add Refactor Guard Tests

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/llm/LlmProviderRegistryTest.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/llm/LlmRequestMapperTest.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/llm/LlmResponseParserTest.java`
- Reference: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/llm/OpenAiCompatibleLlmClientMultiProviderTest.java`

**Step 1: Write the failing tests**

- `LlmProviderRegistryTest`
  - resolves default provider from `default-model`
  - resolves requested provider id
  - throws on unknown provider
- `LlmRequestMapperTest`
  - selects provider default text model
  - selects provider default multimodal model
  - rejects non-multimodal model for image request
  - preserves tool calling fields
- `LlmResponseParserTest`
  - parses normal chat response
  - parses SSE delta chunk
  - parses `[DONE]`
  - ignores malformed SSE JSON

**Step 2: Run targeted tests to verify they fail**

Run:

```bash
./mvnw.cmd -Dtest=LlmProviderRegistryTest,LlmRequestMapperTest,LlmResponseParserTest test
```

Expected:
- FAIL because the new classes do not exist yet

**Step 3: Commit nothing yet**

Wait until code exists and tests pass.

---

### Task 2: Extract Provider Resolution

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/ResolvedLlmContext.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/LlmProviderRegistry.java`
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/OpenAiCompatibleLlmClient.java`

**Step 1: Write minimal implementation**

- `ResolvedLlmContext` holds:
  - `providerId`
  - `LlmProviderConfig provider`
  - `WebClient client`
  - `boolean legacyMode`
- `LlmProviderRegistry` owns:
  - provider `WebClient` cache
  - endpoint normalization
  - provider/context resolution

**Step 2: Re-run targeted tests**

Run:

```bash
./mvnw.cmd -Dtest=LlmProviderRegistryTest test
```

Expected:
- PASS

**Step 3: Commit**

```bash
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw add backend/src/main/java/com/miniclaw/llm/ResolvedLlmContext.java backend/src/main/java/com/miniclaw/llm/LlmProviderRegistry.java backend/src/test/java/com/miniclaw/llm/LlmProviderRegistryTest.java
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw commit -m "refactor: extract llm provider registry"
```

---

### Task 3: Extract Request Mapping

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/OpenAiChatCompletionRequest.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/LlmRequestMapper.java`
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/OpenAiCompatibleLlmClient.java`

**Step 1: Write minimal implementation**

- Move protocol DTOs out of `OpenAiCompatibleLlmClient`
- Move:
  - model resolution
  - multimodal checks
  - message conversion
  - tool calling mapping
  - `temperature` / `maxTokens` defaulting
  into `LlmRequestMapper`

**Step 2: Re-run targeted tests**

Run:

```bash
./mvnw.cmd -Dtest=LlmRequestMapperTest test
```

Expected:
- PASS

**Step 3: Commit**

```bash
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw add backend/src/main/java/com/miniclaw/llm/OpenAiChatCompletionRequest.java backend/src/main/java/com/miniclaw/llm/LlmRequestMapper.java backend/src/test/java/com/miniclaw/llm/LlmRequestMapperTest.java
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw commit -m "refactor: extract llm request mapper"
```

---

### Task 4: Extract Response Parsing and Execution Support

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/LlmResponseParser.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/LlmExecutionSupport.java`
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/OpenAiCompatibleLlmClient.java`

**Step 1: Write minimal implementation**

- `LlmResponseParser`
  - parse chat JSON body
  - parse SSE lines into `LlmChunk`
  - parse usage and tool calls
- `LlmExecutionSupport`
  - timeout
  - retry/backoff
  - HTTP error mapping
  - throwable to `LlmException`

**Step 2: Re-run targeted tests**

Run:

```bash
./mvnw.cmd -Dtest=LlmResponseParserTest,OpenAiCompatibleLlmClientReliabilityTest,OpenAiCompatibleLlmClientStreamTest test
```

Expected:
- PASS

**Step 3: Commit**

```bash
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw add backend/src/main/java/com/miniclaw/llm/LlmResponseParser.java backend/src/main/java/com/miniclaw/llm/LlmExecutionSupport.java backend/src/test/java/com/miniclaw/llm/LlmResponseParserTest.java
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw commit -m "refactor: extract llm parsing and execution support"
```

---

### Task 5: Slim the Facade and Run Full Verification

**Files:**
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/llm/OpenAiCompatibleLlmClient.java`
- Reference tests:
  - `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/llm/OpenAiCompatibleLlmClientMultiProviderTest.java`
  - `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/llm/OpenAiCompatibleLlmClientReliabilityTest.java`
  - `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/llm/OpenAiCompatibleLlmClientMultimodalGuardTest.java`
  - `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/llm/OpenAiCompatibleLlmClientMultimodalTest.java`

**Step 1: Reduce `OpenAiCompatibleLlmClient` to coordinator flow**

- constructor wires collaborators
- `chat()` orchestrates request -> execute -> parse
- `stream()` orchestrates request -> execute -> parse
- remove duplicated internal helpers already moved out

**Step 2: Run full backend verification**

Run:

```bash
./mvnw.cmd test
```

Expected:
- PASS, with existing live demo tests skipped if no usable keys

**Step 3: Commit**

```bash
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw add backend/src/main/java/com/miniclaw/llm
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw commit -m "refactor: slim openai compatible llm client"
```

---

### Task 6: Rewrite Chapter 4.11 for the Refactor

**Files:**
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/04-11-structured-output.md`
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/04-00-chapter-index.md`

**Step 1: Replace 4.11 content**

- Change title, summary, slug, tags to client refactor theme
- Explain:
  - why refactor after feature delivery
  - how to identify mixed responsibilities
  - how `Registry + Context + Mapper + Parser + ExecutionSupport` emerge
  - how facade shrinks
  - how old behavior tests protect the refactor

**Step 2: Update chapter index**

- replace “结构化输出” with “客户端重构”
- adjust summary lines for chapter result if needed

**Step 3: Verify site build**

Run:

```bash
npm run build
```

Expected:
- PASS

**Step 4: Commit**

```bash
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai add content/courses/miniclaw/chapters/04-11-structured-output.md content/courses/miniclaw/chapters/04-00-chapter-index.md
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai commit -m "docs: rewrite chapter 4.11 as llm client refactor"
```

---

### Task 7: Final Verification and Push

**Files:**
- Verify both repos

**Step 1: Final verification**

Run:

```bash
./mvnw.cmd test
npm run build
```

Expected:
- backend tests PASS
- site build PASS

**Step 2: Push changes**

```bash
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw push origin main
git -C C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai push origin main
```

