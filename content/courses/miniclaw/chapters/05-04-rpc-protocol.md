---
title: "第5.4节：RPC 协议设计：Request / Event / Completed / Error"
summary: "把 Gateway 的线上消息格式先钉住。重点不是再造一个 response，而是为流式场景设计 request、event、completed、error 四类帧。"
slug: rpc-protocol
date: 2026-03-16
tags:
  - course
  - miniclaw
  - rpc
  - gateway
order: 4
status: published
---

> **学习目标**：理解为什么第五章的 RPC 协议不是 request/response 二元结构，而是 request、event、completed、error 四类帧
> **预计时长**：30 分钟
> **难度**：入门

---

### 5.3 做完以后，Gateway 其实还不会“说话”

上一节里，我们已经把连接和 session 的关系立住了。  
现在 Gateway 至少知道两件事：

- 谁连上来了
- 某个 session 挂在哪个 connection 下面

但这还不够。

因为真正开始走业务以后，Gateway 还要解决另一个问题：

> 同一条 WebSocket 通道里，客户端和服务端到底应该用什么格式互相说话？

如果这一层不先统一，后面很快就会乱。

比如 `session.create` 可能是一种 JSON 格式，`chat.send` 又是一种，服务端往回推流式结果时再来第三种。  
刚开始你会觉得“能跑就行”，但只要方法一多，前后端都会开始靠猜。

所以 5.4 这一节的任务很明确：

> 不先写 router，不先写业务处理器，先把 Gateway 的线上帧格式钉住。

这个顺序非常重要。  
因为后面的 router、event bus、state machine，本质上都是建立在这套协议之上的。

---

### 为什么这里不是 request / response / event，而是四类帧

很多同学第一次设计 WebSocket 协议时，都会自然想到三元模型：

- request
- response
- event

看起来没问题，但放到 MiniClaw 这里，会很快遇到一个尴尬点：

> `chat.send` 不是一个“收到 response 就结束”的方法，它天然是流式的。

我们这一章前面已经明确了：

- `session.create` 这种方法，本质上是单次调用
- `chat.send` 这种方法，本质上会持续往外推事件

如果你坚持用 `response` 做统一成功返回，协议会很别扭。  
因为对于流式请求来说，真正重要的不是“有没有某个最终 response”，而是：

1. 请求发出去了没有
2. 中间有没有持续事件
3. 这次调用什么时候正常结束
4. 如果失败，失败信息怎么表达

所以这一节我不采用 `request / response / event`，而是直接拆成四类帧：

- `request`：客户端发起调用
- `event`：服务端中途推送事件
- `completed`：服务端声明这次调用正常结束
- `error`：服务端声明这次调用异常结束

这个模型有一个很直接的好处：

> 同步调用和流式调用终于能用同一套结束语义。

比如：

```text
session.create
request -> completed

chat.send
request -> event -> event -> event -> completed

unknown method
request -> error
```

一旦协议层这样定了，后面处理链路就会清晰很多。

---

### 先把两个 ID 分开：`requestId` 和 `sessionId`

这一节里有两个字段必须先讲清楚，因为很多人第一次设计协议时会把它们混掉。

第一个是 `requestId`。  
它标识的是：

> 这一次 RPC 调用本身。

第二个是 `sessionId`。  
它标识的是：

> 这次调用归属的业务会话。

这两个字段不是一回事。

比如同一个 session 里，后面完全可能先后发起多次调用：

```text
session-001
  ├─ request-101 -> chat.send
  ├─ request-102 -> session.get
  └─ request-103 -> chat.send
```

这时候如果你只有 `sessionId`，客户端根本没法精确知道某一帧到底属于哪次调用。  
反过来，如果你只有 `requestId`，服务端又很难把这次调用挂回正确的业务 session。

所以在当前协议里，这两个字段同时保留：

- `requestId` 用来定位一次调用
- `sessionId` 用来定位一次会话

这也是为什么后面的 `event`、`completed`、`error` 都会把这两个字段继续带上。

---

### 第一类帧：`request`

`request` 是客户端发给 Gateway 的入站帧。

当前模型是：

```java
public class RpcRequestFrame {

    private String type = "request";
    private String requestId;
    private String sessionId;
    private String method;
    private JsonNode payload;
}
```

这里最值得注意的是三个字段：

1. `requestId`
   标识这次调用本身

2. `method`
   标识这次到底想调什么能力，比如 `session.create`、`chat.send`

3. `payload`
   存放这次调用的参数

你会看到 `sessionId` 也放在了 request 里。  
这并不意味着每个 request 都必须有 `sessionId`。

像 `session.create` 这种方法，本来就是为了创建 session，所以它可以没有 `sessionId`。  
但像 `chat.send` 这种运行在现有会话上的方法，就必须显式带上它。

例如，一个典型的 `chat.send` 请求会长这样：

```json
{
  "type": "request",
  "requestId": "req-001",
  "sessionId": "session-001",
  "method": "chat.send",
  "payload": {
    "message": "你好"
  }
}
```

到这里为止，客户端到底想干什么，Gateway 已经能读明白了。

---

### 第二类帧：`event`

`event` 是服务端在处理中途主动推送的帧。

它的模型是：

```java
public class RpcEventFrame {

    private String type = "event";
    private String requestId;
    private String sessionId;
    private String name;
    private JsonNode payload;
}
```

这里不要把 `name` 看轻了。  
它其实是整个事件体系的名字空间。

比如后面我们做 `chat.send` 时，就完全可以推这种事件：

- `chat.delta`
- `chat.reasoning`
- `chat.tool_call`
- `chat.tool_result`

为什么字段名不叫 `event`，而叫 `name`？

因为这个对象本身已经是 event 帧了。  
`type = "event"` 负责说明“这是一条事件帧”，`name` 负责说明“这是什么事件”。

这两层语义分开以后，协议会更干净。

例如：

```json
{
  "type": "event",
  "requestId": "req-001",
  "sessionId": "session-001",
  "name": "chat.delta",
  "payload": {
    "delta": "你好"
  }
}
```

注意这里仍然保留了 `requestId`。  
因为流式过程中，客户端最想知道的往往不是“某个 session 收到了事件”，而是“我刚才发起的那次调用，现在推回来了哪一段结果”。

---

### 第三类帧：`completed`

这一节里最关键的设计，其实就是 `completed`。

它的模型很简单：

```java
public class RpcCompletedFrame {

    private String type = "completed";
    private String requestId;
    private String sessionId;
    private JsonNode payload;
}
```

为什么我们要单独造一个 `completed`，而不是继续沿用 `response`？

因为 `completed` 表达的是一件很明确的事：

> 这次调用正常结束了。

这个语义比 `response` 更适合流式协议。

对单次调用来说：

```text
request -> completed
```

对流式调用来说：

```text
request -> event -> event -> event -> completed
```

你会发现，只要有了 `completed`，单次调用和流式调用的成功收口就统一了。  
我们不再需要设计两套“成功返回”的思维模型。

比如 `session.create` 后面完全可以这样回：

```json
{
  "type": "completed",
  "requestId": "req-001",
  "sessionId": "session-001",
  "payload": {
    "created": true
  }
}
```

而 `chat.send` 在一连串 `event` 结束以后，也可以用同一类帧把这次调用收住。

这就是为什么第五章的协议主线里，我坚持把 `completed` 独立出来。

---

### 第四类帧：`error`

失败路径也单独做一类帧，不混进 `completed`。

当前实现是：

```java
public class RpcErrorFrame {

    private String type = "error";
    private String requestId;
    private String sessionId;
    private RpcErrorPayload error;
}
```

对应的错误体是：

```java
public class RpcErrorPayload {

    private String code;
    private String message;
}
```

这里有一个小设计点值得你记住：

> `error` 帧不是把 `code`、`message` 直接摊平到顶层，而是单独包进 `error` 对象里。

这样做有两个好处。

第一，协议语义更清楚。  
顶层字段仍然只负责描述这条帧是谁、属于哪次调用；错误细节放进 `error`，层次很自然。

第二，后面如果要补更多错误信息，比如 `details`、`retryable`、`hint`，扩展点也留住了。

例如：

```json
{
  "type": "error",
  "requestId": "req-001",
  "sessionId": "session-001",
  "error": {
    "code": "METHOD_NOT_FOUND",
    "message": "Unknown method: chat.run"
  }
}
```

这类帧一出来，客户端就知道这次调用已经失败收口，不应该再等后续 `event` 或 `completed`。

---

### 为什么 `payload` 我们用的是 `JsonNode`

这个点一定要讲，因为学员看到代码时通常会先问：

> 为什么这里不用 `Map<String, Object>`，也不用某个具体 DTO？

当前实现里，四类帧里所有可变内容都统一用 `JsonNode` 表达。

原因是这样。

如果你现在就为每个 `method` 建一套强类型 DTO，协议层会很快和业务层绑死。  
比如 `session.create` 一套、`chat.send` 一套、后面工具调用再来一套，RPC 帧模型本身就不再通用了。

反过来，如果你直接用 `String` 存原始 JSON，后面的 router 和 handler 又不得不重复解析字符串。

`JsonNode` 正好落在中间：

- 它保留了 JSON 的结构
- 它仍然是 Jackson 原生支持的类型
- 后面想按字段读取时，可以直接操作树节点

比如测试里就是这样读的：

```java
assertEquals("hello gateway", parsed.getPayload().get("message").asText());
```

这比到处 `Map<String, Object>` 强转要稳，也比字符串二次反序列化干净。

---

### 这一节真正落下来的，不是业务逻辑，而是“线上的 JSON 长什么样”

5.4 这一节的代码没有去碰 router，也没有去碰 `GatewayWebSocketHandler`。  
我刻意把范围压得很小，只做了五个模型类：

- `RpcRequestFrame`
- `RpcEventFrame`
- `RpcCompletedFrame`
- `RpcErrorFrame`
- `RpcErrorPayload`

然后用一组序列化测试把线上格式钉住：

```text
RpcFrameModelTest
```

这组测试验证了四件事：

1. `request` 能不能正确带上 `requestId`、`sessionId`、`method`、`payload`
2. `event` 能不能正确带上 `name`
3. `completed` 能不能承担成功收口
4. `error` 能不能带出 `code` 和 `message`

注意，这组测试不是“测试 getter/setter”。  
它测试的是更重要的一层：

> 当对象真正被 Jackson 序列化成线上 JSON 时，格式是不是我们想要的那一份。

对于协议模型来说，这就是最核心的测试。

---

### 学完这一节，你要记住哪几个判断

这一节最重要的，不是记住类名，而是记住下面四个判断。

1. WebSocket Gateway 不能只靠 request/response 思维建模，因为它天然要承载流式调用。

2. 成功结束应该单独抽象成 `completed`，这样单次调用和流式调用就能共用一套结束语义。

3. `requestId` 和 `sessionId` 必须分开。
   一个标识调用，一个标识会话，谁也替代不了谁。

4. 协议层的 `payload` 先保留成结构化 JSON，而不是过早绑定具体业务 DTO。

这四条站稳以后，下一节的 router 才有办法在统一帧模型之上工作。

---

### 验证命令

本节新增模型的定向验证命令：

```bash
./mvnw.cmd "-Dtest=RpcFrameModelTest" test
```

这次实现里，我已经先跑过这条命令，结果是：

- `4` 个测试通过
- 序列化和反序列化都符合当前协议定义

---

### 本节小结

- 5.4 没有继续往 handler 里写业务，而是先把 Gateway 的线上协议固定下来。
- 当前协议不是三元模型，而是 `request`、`event`、`completed`、`error` 四类帧。
- `completed` 是这一节的关键，它负责统一单次调用和流式调用的成功收口。
- `requestId` 和 `sessionId` 分别承担“调用定位”和“会话定位”两种职责。
- `payload` 统一使用 `JsonNode`，为后面的 router 和 handler 保留结构化 JSON 入口。

下一节，我们就可以在这套帧模型之上继续往前走了：

> 收到一条 `request` 以后，Gateway 到底该把它路由给谁？
