---
title: "第 5.10 节：把完整 Gateway 接到 WebSocket 入站上"
summary: "前面已经把 Router、EventBus、状态机、SessionLane 和 chat.send 主链路都搭好了。最后一步是让 GatewayWebSocketHandler 真正解析入站 JSON、执行 RpcRouter，并把 completed/error 也接回统一出站链路。"
slug: websocket-debug-flow
date: 2026-03-22
tags:
  - course
  - miniclaw
  - gateway
  - websocket
  - rpc
order: 10
status: published
---

> **学习目标**：理解为什么 `GatewayWebSocketHandler` 不应该自己承载业务，只负责连接生命周期、入站解析和结果回推；同时把 chapter 5 的所有核心结构真正接成一个可调试的完整 Gateway。  
> **预计时长**：20 分钟  
> **难度**：入门

---

### 5.9 做完以后，还差最后一根线

到 5.9 为止，系统里已经有这些真实结构：

- `RpcRouter`
- `DefaultSessionHandler`
- `DefaultChatHandler`
- `GatewayEventBus`
- `SessionStateMachine`
- `SessionLane`

而且 `chat.send` 已经能真正走到：

- session 检查
- lane 排队
- `LlmClient.stream()`
- `chat.delta`
- `completed`

但还有最后一个问题没有收口：

> WebSocket 进来的那一段原始文本，到底是谁来解析、谁来转成 `RpcRequestFrame`、谁来把最终结果发回去？

如果这一步不接上，前面所有结构都还是“模块已经存在，但入口层没真正落地”。

所以 5.10 的目标很明确：

1. `GatewayWebSocketHandler` 收到文本帧
2. 把 JSON 解析成 `RpcRequestFrame`
3. 调 `RpcRouter`
4. 把 handler 返回的 `completed` / `error` 也发进统一出站链路
5. 让客户端真正能通过一条 `/ws` 看见 `event / completed / error`

这也是 chapter 5 真正的收口点。

---

### 为什么 `GatewayWebSocketHandler` 不能直接做业务

这一节最重要的一条边界，是把 `GatewayWebSocketHandler` 放回正确位置。

它现在负责的是：

- 注册连接
- 清理连接
- 解析入站请求
- 调用 router
- 把最终 frame 发布到 `GatewayEventBus`

它不负责：

- 直接创建 session
- 直接调用 LLM
- 直接判断 session 状态
- 直接决定 `chat.send` 怎么执行

原因很简单。

如果 `GatewayWebSocketHandler` 同时知道：

- WebSocket
- 协议 JSON
- session 规则
- lane 并发
- LLM 主链路

那它很快就会变成一个大而乱的 God Object。

我们前面分 5.2 到 5.9 一节节拆开的边界，就会在最后一步全部塌回去。

所以 5.10 的正确做法不是“把所有逻辑都塞进 handler”，而是：

> 让 `GatewayWebSocketHandler` 只做入口协调，  
> 真正的业务仍然交给 `RpcRouter -> handler` 这条链。

这一步对学生特别重要，因为它直接决定你以后写的是“能跑的堆叠代码”，还是“可继续扩的系统结构”。

---

### 构造器变化：入口层现在真的接上 Router 了

这一节之后，`GatewayWebSocketHandler` 的依赖变成了：

- `ConnectionRegistry`
- `InMemorySessionRegistry`
- `RpcRouter`
- `GatewayEventBus`
- `OutboundDispatcher`
- `ObjectMapper`

这组依赖正好说明它的职责已经从“只处理连接”变成了“真正的协议入口层”。

其中最关键的是这三个：

1. `RpcRouter`
   负责把请求交给正确 handler

2. `GatewayEventBus`
   负责把最终 `completed` / `error` 也放进统一出站链路

3. `ObjectMapper`
   负责把入站文本帧解析成 `RpcRequestFrame`

这里有一个很重要的设计点：

> `chat.delta` 这类中途事件，还是由 handler 自己发；  
> `completed` / `error` 这类最终结果，则由入口层在 router 执行结束后统一回推。

这样一来，系统的出站模型就真正统一了。

---

### 入站处理：从 “记录日志” 变成 “parse -> route -> publish”

5.2 的时候，`GatewayWebSocketHandler` 对入站文本只做了一件事：

- 打日志

到 5.10，这条链路被替换成了真正的入站处理：

1. 先过滤出 `TEXT` 帧
2. 调 `handleInboundText(connectionId, payload)`
3. 用 `ObjectMapper` 把 JSON 解析成 `RpcRequestFrame`
4. 调 `rpcRouter.route(connectionId, request)`
5. 把返回结果统一 `publishFrame(...)`

也就是说，当前入口层真正开始承载这条协议动作：

```text
raw websocket text
  -> RpcRequestFrame
  -> RpcRouter
  -> handler result
  -> GatewayEventBus
  -> OutboundDispatcher
  -> websocket outbound text
```

这一步非常关键，因为到了这里，Gateway 才第一次从“结构上已经很像”变成“实际上已经跑通”。

---

### 为什么 `completed` 和 `error` 也要走统一出站链路

这一节里有一个看起来很小、但其实很关键的收口动作：

```java
eventBus.publish(GatewayEvent.outbound(connectionId, sessionId, requestId, frame));
```

这里的 `frame` 可能是：

- `RpcCompletedFrame`
- `RpcErrorFrame`

为什么这一步很重要？

因为前面 `chat.delta` 已经是走：

- `GatewayEventBus`
- `OutboundDispatcher`
- `session.send(...)`

如果 `completed` / `error` 又走另一条完全不同的发送路径，客户端虽然也能收到消息，但服务端的出站结构会重新分裂成两套。

那样一来，后面只要再加：

- 取消执行
- 进度事件
- 更多错误类型

入口层就会越来越乱。

所以 5.10 的关键不是“能把结果发回去”，而是：

> 能不能让所有出站 frame 都回到同一条出站总线上。

这一步站住以后，Gateway 的“统一协议入口层”才算真正成立。

---

### 错误处理：坏 JSON 不能直接炸掉连接

这一节还补了一个很必要的最小错误分支：

如果入站文本不是合法 JSON，当前实现会返回：

- `type = "error"`
- `code = "BAD_REQUEST"`

而不是直接让整个连接异常终止。

这点看起来很普通，但它其实代表了一种成熟很多的入口层思维：

> 协议错误应该尽量被转换成协议内可理解的错误帧，  
> 而不是让底层异常直接冲垮整条连接。

当前这一步还做得很轻，只处理了“Malformed rpc request json”。

但它已经为后面继续扩展：

- 非法 `type`
- 缺失 `method`
- payload 结构错误

留出了正确的处理方向。

---

### 这一节的测试，真正锁住了什么

5.10 最关键的测试仍然集中在：

- [`GatewayWebSocketHandlerTest.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/ws/GatewayWebSocketHandlerTest.java)

它现在锁住了五件事：

1. 建连时会注册 connection，断连时会清理
2. 入站合法 `request` 会真正经过 router，并发回 `completed`
3. 非法 JSON 会发回 `BAD_REQUEST` 错误帧
4. 断连时仍然会清理绑定 session
5. 出站消息仍然只发给当前连接

注意这里的测试重点不是“前端调试工具长什么样”，也不是“人工点一下页面能不能看到结果”，而是：

> WebSocket 入口层本身，是否已经具备可验证的协议行为。

这对学生很重要，因为它会让你养成一种正确习惯：

入口层不是靠手点来验证的，入口层也应该有自动化测试。

---

### 学完 5.10，你要真正记住什么

这一节最重要的是下面四句话：

1. `GatewayWebSocketHandler` 是入口协调层，不是业务层
2. 入站文本必须先解析成统一协议模型，再交给 router
3. `completed` / `error` 也应该回到统一出站链路
4. 协议错误优先转换成协议内错误帧，而不是直接炸连接

到了这里，chapter 5 的核心主线其实已经收住了：

- 有统一 `/ws` 入口
- 有统一 RPC 帧模型
- 有统一路由
- 有统一出站总线
- 有 session 状态约束
- 有同 session 并发控制
- 有最小 `chat.send` 主链路
- 有真实 WebSocket 入站接线

这就是一个“最小但成体系”的 Gateway。

---

### 验证命令

本节新增代码的定向验证命令：

```bash
./mvnw.cmd -Dtest=GatewayWebSocketHandlerTest test
./mvnw.cmd test
```

这次实现里，这两组验证已经通过，说明 5.10 的最小目标已经成立：

- 入站 request 已经能被解析并路由
- `completed` / `error` 已经能通过统一出站链路返回
- WebSocket Gateway 已经具备最小端到端调试能力

---

### 本节小结

- 5.10 把 chapter 5 前面分散的结构真正接到了 WebSocket 入站上
- `GatewayWebSocketHandler` 现在从“只管连接”升级成了真实协议入口层
- 它会解析 `RpcRequestFrame`、调用 `RpcRouter`、并统一发布 `completed` / `error`
- `chat.delta` 这类中途事件仍然由 handler 自己发布
- 到这里为止，MiniClaw 的最小 Gateway 已经完整闭环

chapter 5 到这一步，已经从“网关基础”推进到了“真实可跑的网关骨架”。后面如果继续扩展，重点就不再是基础结构，而会转到上下文、多轮对话、工具调用和 Agent 执行链上。
