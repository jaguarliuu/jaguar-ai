# Repository Workflow

## MiniClaw Course Project

- `miniclaw/` is the working project for the MiniClaw course.
- Treat `miniclaw/` as course source material, not as a git-managed deliverable that needs branch hygiene or commit preparation.
- Do not optimize the workflow around `miniclaw/.git`; focus on code correctness and course alignment.

## Current Progress Snapshot

- The outer `jaguar-ai` repository is the publishing site for the course, not the primary implementation source.
- The inner `miniclaw/` repository is the real implementation of the MiniClaw backend used by the course.
- Chapter 4 is complete and already aligned to the current LLM client implementation.
- Chapter 5 is currently implemented and documented through section 5.6.
- Implemented Chapter 5 backend milestones in `miniclaw/backend`:
  - `5.1` gateway method catalog
  - `5.2` WebSocket gateway entry and connection model
  - `5.3` in-memory session registry
  - `5.4` RPC frame model
  - `5.5` RPC router and handler SPI
  - `5.6` in-process gateway event bus and outbound dispatcher
- Published Chapter 5 site content in `content/courses/miniclaw/chapters/`:
  - `05-01-why-websocket.md`
  - `05-02-websocket-config.md`
  - `05-03-connection-manager.md`
  - `05-04-rpc-protocol.md`
  - `05-05-rpc-router.md`
  - `05-06-event-bus.md`
- The next natural implementation target is `5.7 SessionStateMachine`, followed by `5.8 SessionLane`, then `5.9 chat.send` end-to-end flow.

## Required Authoring Order

- Implement code first.
- Verify the code with focused tests and broader compile or test commands.
- Update course documentation only after the code is verified.
- Course documents must describe the code that actually exists in `miniclaw/backend`.

## Course Maintenance Rules

- When a chapter changes, update the backend implementation before rewriting the chapter markdown.
- Prefer deterministic local tests over manual API-key-based verification.
- Keep examples in chapter docs aligned with real class names, method names, and behavior in the codebase.
- If code and docs diverge, fix the code path first, then rewrite the doc to match verified behavior.
- Assume the learner baseline is Java 8 unless the user says otherwise.
- When a chapter uses Java 9+ language features or newer JDK APIs, explain them explicitly at first use.
- When a chapter introduces Reactor or WebFlux operators, translate them into an imperative Java mental model before diving into the chain-style code.
- If snippets use syntax such as switch expressions, pattern matching for `instanceof`, `Stream.toList()`, text blocks, records, or similar newer features, provide the Java 8 equivalent or a side-by-side explanation.
- When a chapter introduces core reliability concepts such as exponential backoff, jitter, timeout, retry budget, circuit breaking, or fallback, explain the motivation, the formula or rule, a concrete timeline example, and the tradeoff against simpler alternatives.

## Gateway Chapter Design Rules

- Chapter 5 is a Gateway-only chapter. Do not pull CLI implementation, durable persistence, or long-term multi-turn storage into this chapter unless explicitly requested.
- Keep the runtime main line clear:
  - `WebSocket -> GatewayWebSocketHandler -> RpcRouter -> handlers -> GatewayEventBus -> OutboundDispatcher -> WebSocket outbound`
- Introduce only one new architectural responsibility per section whenever possible.
- Do not skip ahead and mix EventBus, state machine, concurrency control, and chat streaming into the same section.
- Prefer adding explicit boundary objects instead of hiding behavior inside large handlers.
- If a section is about one layer, keep the implementation narrow enough that students can still see that layer's responsibility in isolation.

## Backend Code Style For Course Iteration

- Optimize for teaching clarity first, then compactness.
- Prefer small classes with one clear responsibility over flexible but opaque abstractions.
- Keep `GatewayWebSocketHandler` responsible for connection lifecycle and WebSocket bridging, not for business routing or business state.
- Keep routing concerns in `RpcRouter`.
- Keep handler extension points behind a small SPI such as `RpcHandler`.
- Keep outbound message transport concerns out of handlers; use `GatewayEventBus` and `OutboundDispatcher` as the boundary.
- Prefer explicit names such as `ConnectionRegistry`, `InMemorySessionRegistry`, `GatewayEventBus`, `OutboundDispatcher`, `SessionStateMachine`, `SessionLane`.
- Avoid "god objects" and avoid pushing unrelated logic back into existing entrypoint classes.
- Prefer fail-fast validation with clear local exceptions over letting bad inputs travel deeper into the stack.
- When a design is intentionally transitional, document that clearly in the chapter text and keep the transition short-lived.

## Testing Rules For Course Iteration

- Use TDD for each new capability:
  - write the failing test
  - verify the test fails for the expected reason
  - implement the minimal code
  - rerun the focused test
  - rerun broader verification
- Prefer focused unit tests that lock one layer's responsibility at a time.
- Do not test multiple architectural layers in one test unless the section is explicitly about integration.
- For Gateway work, typically separate tests into:
  - connection/session model tests
  - protocol model tests
  - router/handler boundary tests
  - event bus / outbound tests
  - later state machine / concurrency / integration tests
- Prefer deterministic local tests over external live verification.
- Live or API-key-based tests may exist, but they must remain optional or skipped when credentials are unavailable.

## Documentation Style Rules

- Write each section as a guided engineering narrative, not as a dry API reference.
- Each section should answer one clear question that naturally follows the previous section.
- Explain why the current layer exists before explaining how the code works.
- Keep chapter text aligned to the current real implementation only; never document planned code as if it already exists.
- When a design is intentionally incomplete for the current section, say so explicitly and explain what is deferred to the next section.
- For WebFlux/Reactor content, always translate the reactive flow into an imperative mental model before or alongside the chain-style code.
- When the implementation uses newer Java features, point them out and give enough context for a Java 8 learner to keep following.

## Commit Discipline For This Repository Pair

- Treat inner and outer repositories as separate deliverables.
- Commit backend implementation changes in `miniclaw/` separately from site documentation changes in `jaguar-ai/`.
- Preferred sequence for a section:
  - implement and verify backend code in `miniclaw/`
  - commit inner repository
  - write and verify course content in `jaguar-ai/`
  - commit outer repository
- Do not bundle unrelated generated-file changes into course commits.
- If an unrelated file changes, leave it out unless it is required for the current section.

## Verification Checklist Before Finishing A Section

- Inner repository focused tests for the new section pass.
- Inner repository full backend test suite passes.
- Outer repository site build passes after doc updates.
- Chapter index links to the new section.
- The new section does not promise code that has not been implemented yet.
- The code shape still matches the teaching boundary of the section.
