---
title: "第 5.9 节：chat.send，串起状态机、SessionLane 与 LLM 流"
summary: "把前面几节分散搭好的结构真正串起来。让 chat.send 先过 session 合法性检查，再进入 SessionLane，调用 LlmClient.stream()，中途发布 chat.delta，最后用 completed 收口。"
slug: chat-send-flow
date: 2026-03-22
tags:
  - course
  - miniclaw
  - gateway
  - chat
  - llm
order: 9
status: published
---

> **学习目标**：理解为什么 `chat.send` 不是单纯“调一下 LLM”，而是一条要同时经过协议层、session 约束、并发控制和事件分发的完整数据流。  
> **预计时长**：20 分钟  
> **难度**：入门

---

### 5.8 做完以后，我们终于可以开始接 `chat.send`

到 5.8 为止，Gateway 已经有了四块关键基础：

- `RpcRouter`
- `GatewayEventBus`
- `SessionStateMachine`
- `SessionLane`

但它们之前还是分散站着的。

也就是说，我们已经分别回答了：

- 请求要路由给谁
- 中途事件怎么回推
- 当前 session 能不能执行某个方法
- 同一个 session 上两个任务同时进来怎么办

现在终于轮到 5.9 去回答真正的主问题了：

> 一次真实的 `chat.send` 到底要怎么从请求走到模型输出？

如果这一节不把主链路接起来，前面几节学生很容易学成“懂很多零件，但不知道怎么装起来”。

所以 5.9 的目标很明确：

1. `chat.send` 先找到目标 session
2. 先过状态机合法性检查
3. 再进入 `SessionLane`
4. 在 lane 里调用 `LlmClient.stream()`
5. 每个 chunk 发布成 `chat.delta`
6. 流结束后返回 `completed`

这就是 chapter 5 前半段第一次真正意义上的“端到端闭环”。

---

### 为什么这一步顺手把 `RpcHandler` 改成了 `Mono<Object>`

这一节有一个必须做的收敛动作：

```java
public interface RpcHandler {

    List<String> supportedMethods();

    Mono<Object> handle(String connectionId, RpcRequestFrame request);
}
```

前面 5.5 的时候，`RpcHandler` 返回的是同步 `Object`。  
那时候这样做是合理的，因为我们只是先把 Router 和 handler SPI 立住。

但到 5.9 这里，这个过渡设计已经不够用了。

原因很直接：

- `session.create` 是单次调用
- `chat.send` 是流式调用

如果 handler 还坚持同步返回值，就会出现两个糟糕结果里的一个：

1. 要么你把 `chat.send` 硬写成阻塞逻辑
2. 要么你把“中途事件”和“结束结果”拆成两套很别扭的返回路径

所以这里把 handler 和 router 一起收敛成 `Mono<Object>`，就是为了表达一个更准确的语义：

> handler 的最终结果，可能是立即完成，也可能是在一段响应式链路结束后才完成。

这一步并不是“为了 Reactor 而 Reactor”，而是因为 `chat.send` 本身就是流式的，接口边界必须如实反映这一点。

---

### `DefaultSessionHandler`：先把 `session.create` 落成真实 handler

在接 `chat.send` 之前，这一节先顺手把 `session.create` 也从测试假对象换成了真实实现：

```java
@Component
public class DefaultSessionHandler implements SessionHandler {
    ...
}
```

它当前只支持一个方法：

- `session.create`

它做的事情很简单：

1. 调 `InMemorySessionRegistry#create(connectionId)` 创建 session
2. 返回一个 `RpcCompletedFrame`
3. `payload` 里带上 `created: true` 和新 `sessionId`

这一点很重要，因为从这里开始：

> Gateway 里已经不再只有“假想中的 session.create”，而是有了能真正创建 session 的 handler。

这样 5.9 的 `chat.send` 就不是凭空依赖某个 session，而是终于挂在真实会话模型上了。

---

### `DefaultChatHandler`：真正把几条线串到一起

这一节最关键的代码是：

```java
@Component
public class DefaultChatHandler implements ChatHandler {
    ...
}
```

它当前串起了六个依赖：

- `InMemorySessionRegistry`
- `SessionStateMachine`
- `SessionLane`
- `GatewayEventBus`
- `LlmClient`
- `ObjectMapper`

这六个依赖刚好对应 5.9 这条主链路的六个环节：

1. 找 session
2. 判断当前状态是否合法
3. 把任务放进同 session 的串行 lane
4. 调 LLM 流式接口
5. 把中途 chunk 发成网关事件
6. 最后组装 `completed`

你会看到，这一节没有再让 `GatewayWebSocketHandler` 直接碰 LLM，也没有让 `SessionLane` 自己懂协议，更没有让 `LlmClient` 反过来知道 WebSocket。

原因很简单：

> 5.9 的目标不是“赶紧跑通功能”，而是“把主链路接起来，但边界别塌”。

这也是为什么 `DefaultChatHandler` 会成为这一节最重要的结构收口点。

---

### 第一段：先把非法请求挡在链路外面

`chat.send` 进来以后，当前实现先做的是三层前置判断：

1. `sessionId` 对应的 session 是否存在
2. 当前 session 状态是否允许 `chat.send`
3. `payload.message` 是否存在

只要其中任何一层不满足，就直接返回：

```java
RpcErrorFrame.of(...)
```

例如当前实现里：

- 找不到 session 会返回 `SESSION_NOT_FOUND`
- session 已经 `CLOSED` 会返回 `INVALID_SESSION_STATE`
- 没有 `payload.message` 会返回 `INVALID_PAYLOAD`

这一步的意义在于：

> 不要把明显非法的请求送进 lane，更不要送进 LLM。

如果这里不先挡住，后面的 lane、状态机、事件流都会被脏请求污染，系统调试复杂度会立刻上升。

---

### 第二段：为什么 `chat.send` 一定要挂到 `SessionLane`

通过前置检查以后，`chat.send` 并不会立刻去调 LLM，而是先交给：

```java
sessionLane.submit(session.getSessionId(), ...)
```

这一步是 5.8 和 5.9 真正接上的地方。

因为同一个 session 上：

- 第一个 `chat.send` 可能还在跑
- 第二个 `chat.send` 可能已经打进来了

如果不先过 lane，后面的状态切换和 LLM 调用顺序就会乱。

所以当前语义非常明确：

> 只要请求属于同一个 session，它就必须先排进这条 session 自己的串行通道。

注意这里我们并没有搞全局串行。  
lane 的作用域仍然严格是 `sessionId`。

这意味着：

- 同 session 串行
- 不同 session 仍然可以并行

这正是前一节我们想建立的并发模型。

---

### 第三段：在 lane 里完成状态切换、LLM 流与事件发布

真正的执行逻辑发生在 `executeChat(...)` 里。

当前顺序是：

1. 先把 session 从 `IDLE` 切到 `RUNNING`
2. 构造最小 `LlmRequest`
3. 调 `llmClient.stream(...)`
4. 每来一个 chunk，就发布一个 `chat.delta`
5. 流结束后返回 `RpcCompletedFrame`
6. 在 `doFinally(...)` 里把 session 从 `RUNNING` 切回 `IDLE`

这条链最关键的地方不是某一行 API，而是它把三种不同性质的事情分开了：

- 状态约束：`SessionStateMachine`
- 顺序约束：`SessionLane`
- 中途出站：`GatewayEventBus`

其中 `chat.delta` 当前是这样发出去的：

```java
RpcEventFrame.of(requestId, sessionId, "chat.delta", payload)
```

`payload` 里只带一个最小字段：

```json
{ "delta": "..." }
```

这是有意收着做的。  
因为 5.9 的目标不是一口气引入 reasoning、tool call、usage，而是先把最核心的流式文本回推链路站住。

---

### 为什么 `completed` 不走 EventBus，而是作为 handler 结果返回

这一节有一个很容易被忽略、但非常重要的设计点：

- 中途的 `chat.delta` 走 `GatewayEventBus`
- 最终的 `completed` 不走事件总线，而是作为 `handle(...)` 的最终结果返回

这样做的好处非常直接。

因为 `chat.delta` 是中途事件，本来就属于：

> “这次调用进行到一半，服务端主动推一点东西回来”

而 `completed` 表达的是：

> “这次 handler 执行已经正常结束”

所以让 `completed` 作为 `Mono<Object>` 的最终结果返回，语义上是最干净的。

这也正是为什么 5.9 必须把 `RpcHandler` 收敛到响应式返回值。  
否则你很难同时优雅地承载：

- 中途事件
- 最终完成信号

---

### 这一节的测试，真正锁住了什么

5.9 新增的两组核心测试是：

- [`DefaultSessionHandlerTest.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/rpc/handler/DefaultSessionHandlerTest.java)
- [`DefaultChatHandlerTest.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/rpc/handler/DefaultChatHandlerTest.java)

它们当前锁住的不是“大而全”的业务，而是最小主链路语义：

1. `session.create` 会真实创建 session，并返回带 `sessionId` 的 `completed`
2. `chat.send` 会把 LLM chunk 发布成 `chat.delta`
3. `chat.send` 流结束后会返回 `completed`
4. `CLOSED` session 会拒绝执行 `chat.send`
5. handler/router 已经统一改成 `Mono<Object>`

注意这里我们还没有做的事情也要看清楚：

- 还没有把 WebSocket 入站文本真正解析成 `RpcRequestFrame`
- 还没有让 `GatewayWebSocketHandler` 调用 `RpcRouter`
- 还没有支持 reasoning、tool call、多消息上下文

这些不是遗漏，而是这一节刻意压住的边界。

---

### 学完 5.9，你要真正记住什么

这一节最重要的不是记住类名，而是记住这一条顺序：

1. 先校验 session 和 payload
2. 再进入 lane
3. 在 lane 内切状态
4. 在 lane 内调 LLM
5. 中途 chunk 发成事件
6. 最终用 `completed` 收口

只要这个顺序站住，后面的 5.10 就非常自然了。

因为 5.10 要解决的问题，已经不是“链路怎么设计”，而是：

> WebSocket 真正收到一条 JSON request 以后，  
> 怎么把它解析、路由、执行，并把 `event / completed / error` 全部发回客户端？

也就是说：

- 5.9 把主链路核心执行逻辑立住
- 5.10 再把这条链路真正接到 WebSocket 入站上

这就是 chapter 5 后半最合理的推进顺序。

---

### 验证命令

本节新增代码的定向验证命令：

```bash
./mvnw.cmd "-Dtest=RpcRouterTest,DefaultSessionHandlerTest,DefaultChatHandlerTest" test
./mvnw.cmd test
```

这次实现里，这两组验证已经通过，说明 5.9 当前的最小目标已经成立：

- `session.create` 已经是真实 handler
- `chat.send` 已经能走到 LLM 流
- `chat.delta` 已经能通过事件总线发出去
- `completed` 已经能作为最终结果收口

---

### 本节小结

- 5.9 终于把前面几节的结构接成了一条真实主链路
- `RpcHandler` 和 `RpcRouter` 被收敛成 `Mono<Object>`
- `DefaultSessionHandler` 实现了真实 `session.create`
- `DefaultChatHandler` 串起了状态机、SessionLane、LLM 流和事件总线
- `chat.send` 现在已经具备最小端到端执行能力

下一节开始，我们就可以把这条链真正接到 `GatewayWebSocketHandler` 的入站文本解析上了。
