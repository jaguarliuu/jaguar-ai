# MiniClaw Chapter 5 Gateway Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver Chapter 5 as a gateway-only chapter that builds MiniClaw's WebSocket entry layer, including RPC over WebSocket, EventBus, Session state management, SessionLane concurrency control, and a streaming `chat.send` flow verified with a WebSocket debugging tool.

**Architecture:** Keep Chapter 5 strictly focused on the Gateway. The client side remains outside this chapter, session state stays in memory, and no database-backed conversation history is introduced. The runtime path is `WebSocket -> GatewayWebSocketHandler -> RpcRouter -> Session/Chat Handler -> EventBus -> outbound push`, with `SessionStateMachine` and `SessionLane` ensuring correctness and per-session serialization.

**Tech Stack:** Java 21, Spring Boot 3, WebFlux, Reactor, Jackson, JUnit 5, Markdown/MDX

---

### Task 1: Lock Chapter Boundary and Rewrite Chapter Index

**Files:**
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-00-chapter-index.md`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/docs/plans/2026-03-15-miniclaw-chapter-05-gateway-plan.md`

**Step 1: Rewrite the chapter boundary**

- State clearly that Chapter 5 only covers the Gateway
- State clearly that the chapter does not include:
  - CLI implementation
  - database persistence
  - durable multi-turn context storage
- Keep `session` limited to in-memory lifecycle management

**Step 2: Rewrite the chapter roadmap**

- Keep the chapter organized around this main line:
  - why Gateway
  - WebSocket setup
  - connection/session model
  - RPC protocol
  - router
  - EventBus
  - Session state machine
  - SessionLane
  - chat data flow
  - end-to-end debug

**Step 3: Verify the site still builds**

Run:

```bash
npm run build
```

Expected:
- PASS

**Step 4: Commit**

```bash
git add content/courses/miniclaw/chapters/05-00-chapter-index.md docs/plans/2026-03-15-miniclaw-chapter-05-gateway-plan.md
git commit -m "docs: define miniclaw chapter 5 gateway plan"
```

---

### Task 2: Build the Gateway WebSocket Entry and Connection Model

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/ws/WebSocketConfig.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/ws/GatewayWebSocketHandler.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/connection/ConnectionContext.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/connection/ConnectionRegistry.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/connection/ConnectionRegistryTest.java`

**Step 1: Write the failing tests**

- `ConnectionRegistryTest` should prove:
  - a connection can be registered and removed
  - a connection can bind multiple `sessionId`
  - removing a connection cleans up all session bindings

**Step 2: Run the test to verify it fails**

Run:

```bash
./mvnw.cmd -Dtest=ConnectionRegistryTest test
```

Expected:
- FAIL because the gateway connection model does not exist yet

**Step 3: Write the minimal implementation**

- `GatewayWebSocketHandler` only does:
  - accept connection
  - register connection
  - parse inbound text frames
  - hand request envelopes to the router
  - deregister on close
- `ConnectionRegistry` should track:
  - `connectionId`
  - `WebSocketSession`
  - bound `sessionId` set

**Step 4: Re-run the test**

Run:

```bash
./mvnw.cmd -Dtest=ConnectionRegistryTest test
```

Expected:
- PASS

---

### Task 3: Define the RPC Frame Model

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/model/RpcRequestFrame.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/model/RpcEventFrame.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/model/RpcCompletedFrame.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/model/RpcErrorFrame.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/model/RpcErrorPayload.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/rpc/model/RpcFrameModelTest.java`

**Step 1: Write the failing serialization tests**

- `RpcFrameModelTest` should prove:
  - `request` carries `requestId`, `method`, `sessionId`, `payload`
  - `event` carries `requestId`, `sessionId`, `name`, `payload`
  - `completed` carries `requestId`, `sessionId`, `payload`
  - `error` carries `requestId`, `sessionId`, `code`, `message`

**Step 2: Run the test to verify it fails**

Run:

```bash
./mvnw.cmd -Dtest=RpcFrameModelTest test
```

Expected:
- FAIL because the frame classes do not exist yet

**Step 3: Write the minimal implementation**

- Do not mix chat-specific fields into the protocol
- Keep the frame model generic enough for `session.*` and `chat.send`
- Keep `payload` as structured JSON-compatible object

**Step 4: Re-run the test**

Run:

```bash
./mvnw.cmd -Dtest=RpcFrameModelTest test
```

Expected:
- PASS

---

### Task 4: Add the Router and Handler SPI

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/RpcRouter.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/handler/RpcHandler.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/handler/SessionHandler.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/handler/ChatHandler.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/rpc/RpcRouterTest.java`

**Step 1: Write the failing tests**

- `RpcRouterTest` should prove:
  - `session.create` routes to `SessionHandler`
  - `chat.send` routes to `ChatHandler`
  - unknown `method` returns a protocol error frame

**Step 2: Run the test to verify it fails**

Run:

```bash
./mvnw.cmd -Dtest=RpcRouterTest test
```

Expected:
- FAIL because the router SPI does not exist yet

**Step 3: Write the minimal implementation**

- `GatewayWebSocketHandler` should delegate routing instead of owning business logic
- `RpcHandler` should expose:
  - supported methods
  - handle request

**Step 4: Re-run the test**

Run:

```bash
./mvnw.cmd -Dtest=RpcRouterTest test
```

Expected:
- PASS

---

### Task 5: Build the Gateway EventBus and Outbound Dispatcher

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/event/GatewayEvent.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/event/GatewayEventBus.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/event/OutboundDispatcher.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/event/GatewayEventBusTest.java`

**Step 1: Write the failing tests**

- `GatewayEventBusTest` should prove:
  - published events can be observed as a Reactor stream
  - an event keeps `connectionId`, `sessionId`, and `requestId`
  - only the matching outbound target receives the event

**Step 2: Run the test to verify it fails**

Run:

```bash
./mvnw.cmd -Dtest=GatewayEventBusTest test
```

Expected:
- FAIL because the event bus does not exist yet

**Step 3: Write the minimal implementation**

- Use an in-process Reactor sink
- Do not introduce distributed messaging
- Keep `ChatHandler` and `SessionHandler` unaware of `WebSocketSession`

**Step 4: Re-run the test**

Run:

```bash
./mvnw.cmd -Dtest=GatewayEventBusTest test
```

Expected:
- PASS

---

### Task 6: Add Session Registry and State Machine

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/session/SessionState.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/session/GatewaySession.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/session/InMemorySessionRegistry.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/session/SessionStateMachine.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/session/SessionStateMachineTest.java`

**Step 1: Write the failing tests**

- `SessionStateMachineTest` should prove:
  - `session.create` creates `IDLE`
  - `IDLE -> RUNNING` is allowed
  - `RUNNING -> IDLE` is allowed
  - `RUNNING -> CLOSED` is rejected unless explicitly supported
  - `CLOSED` rejects later `chat.send`

**Step 2: Run the test to verify it fails**

Run:

```bash
./mvnw.cmd -Dtest=SessionStateMachineTest test
```

Expected:
- FAIL because the session model does not exist yet

**Step 3: Write the minimal implementation**

- Keep storage in memory only
- Separate:
  - session existence
  - current state
  - connection binding
- Do not add conversation history persistence

**Step 4: Re-run the test**

Run:

```bash
./mvnw.cmd -Dtest=SessionStateMachineTest test
```

Expected:
- PASS

---

### Task 7: Add SessionLane for Per-Session Concurrency Control

**Files:**
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/session/SessionLane.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/session/SessionLaneRegistry.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/session/SessionLaneTest.java`

**Step 1: Write the failing tests**

- `SessionLaneTest` should prove:
  - tasks for the same `sessionId` execute in submission order
  - tasks for different `sessionId` can overlap
  - a second `chat.send` for the same session cannot race the first one

**Step 2: Run the test to verify it fails**

Run:

```bash
./mvnw.cmd -Dtest=SessionLaneTest test
```

Expected:
- FAIL because the lane model does not exist yet

**Step 3: Write the minimal implementation**

- Keep the abstraction explicit instead of burying serialization in ad hoc `synchronized`
- Ensure the state machine transitions happen inside the lane

**Step 4: Re-run the test**

Run:

```bash
./mvnw.cmd -Dtest=SessionLaneTest test
```

Expected:
- PASS

---

### Task 8: Wire `chat.send` to the LLM Streaming Client

**Files:**
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/handler/ChatHandler.java`
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/event/OutboundDispatcher.java`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/rpc/handler/ChatHandlerIntegrationTest.java`

**Step 1: Write the failing integration test**

- `ChatHandlerIntegrationTest` should prove:
  - `chat.send` moves the session into `RUNNING`
  - streaming chunks become `chat.delta` events
  - stream completion emits `completed`
  - session returns to `IDLE`

**Step 2: Run the test to verify it fails**

Run:

```bash
./mvnw.cmd -Dtest=ChatHandlerIntegrationTest test
```

Expected:
- FAIL because the end-to-end chat flow is not wired yet

**Step 3: Write the minimal implementation**

- Build `LlmRequest` from the incoming RPC payload
- Call `LlmClient.stream()`
- Publish delta and completion frames through `GatewayEventBus`
- Map failures to protocol error frames and state transitions

**Step 4: Re-run the test**

Run:

```bash
./mvnw.cmd -Dtest=ChatHandlerIntegrationTest test
```

Expected:
- PASS

---

### Task 9: Verify with a Real WebSocket Client and Finish the Chapter Docs

**Files:**
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-01-why-websocket.md`
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-02-websocket-config.md`
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-03-connection-manager.md`
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-04-rpc-protocol.md`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-05-rpc-router.md`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-06-event-bus.md`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-07-session-state-machine.md`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-08-session-lane.md`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-09-chat-data-flow.md`
- Create: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-10-gateway-debugging.md`
- Modify: `C:/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/content/courses/miniclaw/chapters/05-00-chapter-index.md`

**Step 1: Rewrite the first four sections**

- Remove the older “Echo demo first” teaching structure
- Rewrite them to align with the Gateway main line
- Make the narrative read like a video transcript, not API reference notes

**Step 2: Add the remaining sections**

- 5.5 Router
- 5.6 EventBus
- 5.7 Session state machine
- 5.8 SessionLane
- 5.9 chat data flow
- 5.10 WebSocket debugging walkthrough

**Step 3: Add manual verification commands to the final section**

- open WebSocket debugging tool
- connect to `/ws`
- send `session.create`
- send `chat.send`
- observe `event` and `completed` frames

**Step 4: Run doc/site verification**

Run:

```bash
npm run build
```

Expected:
- PASS

---

### Task 10: Final Verification

**Files:**
- Verify both backend and docs

**Step 1: Run backend verification**

Run:

```bash
./mvnw.cmd test
```

Expected:
- PASS

**Step 2: Run site verification**

Run:

```bash
npm run build
```

Expected:
- PASS

**Step 3: Commit**

```bash
git add miniclaw/backend/src/main/java/com/miniclaw/gateway miniclaw/backend/src/test/java/com/miniclaw/gateway content/courses/miniclaw/chapters/05-00-chapter-index.md content/courses/miniclaw/chapters/05-0*.md
git commit -m "feat: build miniclaw chapter 5 gateway foundation"
```
