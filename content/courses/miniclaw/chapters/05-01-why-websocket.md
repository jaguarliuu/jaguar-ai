---
title: "第5.1节：为什么 Agent 需要 WebSocket Gateway？"
summary: "先把 Gateway 的边界和统一能力面定义清楚，理解为什么 Agent 系统不能只靠零散 HTTP 接口。"
slug: why-websocket
date: 2026-03-15
tags:
  - course
  - miniclaw
  - websocket
  - gateway
order: 1
status: published
---

> **学习目标**：理解为什么第5章要先做 Gateway，而不是直接上 CLI、数据库或零散 Controller
> **预计时长**：20 分钟
> **难度**：入门

---

### 这一节我们先不写 WebSocket 配置

看到“第5章：WebSocket 网关与 RPC 协议”这个标题，很多同学第一反应都会是：

> 那我们是不是应该马上开始写 `WebSocketHandler`？

这很自然，但不是这一章最好的起手方式。

因为如果你一上来就写 `/ws`、写连接建立、写收发消息，你很容易把 WebSocket 当成这一章的主角。

但它其实不是。

第5章真正要解决的问题不是：

> Spring WebFlux 里怎么开一个 WebSocket 端点？

而是：

> MiniClaw 后面的 `chat`、`session`、实时事件，到底应该通过什么样的统一入口对外暴露？

这才是 Gateway 的问题。

所以 5.1 这一节，我们先不急着写网络层，而是先把方向校准：

- 为什么 Agent 系统需要 Gateway
- 为什么这个 Gateway 最终要走 WebSocket
- 为什么在真正写连接层之前，要先把“统一能力面”定义出来

只有这三件事想清楚，后面的 5.2、5.3、5.4 才不会写歪。

---

### 如果没有 Gateway，系统会怎么长歪？

我们先看最容易发生的一种演进方式。

一开始你只是想做一个聊天能力，于是先写一个 HTTP 接口：

```text
POST /chat/send
```

后来你发现还需要会话能力，于是继续加：

```text
POST /session/create
GET  /session/{id}
POST /session/{id}/close
```

再往后，你又发现模型是流式返回的，于是又开始考虑：

- HTTP SSE
- WebSocket
- 轮询状态接口
- 单独的事件推送接口

写到这里，系统通常就会开始出现三个问题。

第一个问题，**入口分散**。

前端或者 CLI 想调用系统能力时，要记住一堆接口路径、一堆响应格式、一堆特殊约定。  
这不是“能力在增长”，这是“边界在发散”。

第二个问题，**同步与流式模型混乱**。

`session.create` 是一次请求一次响应，`chat.send` 又希望持续回推 token。  
如果没有统一协议，你很快就会得到两套完全不同的调用方式。

第三个问题，**实时事件没有稳定落点**。

模型增量输出、状态变化、运行结束、错误通知，最后都会变成一句话：

> 这条消息到底该从哪里发出去？

这就是为什么我们这一章不把问题定义成“怎么写 WebSocket”，而是定义成：

> 怎么把 MiniClaw 的实时能力，统一收口到一个 Gateway。

---

### 为什么不是“HTTP + 几个补丁”，而是“WebSocket Gateway”

这里最容易产生一个误解：

> 我理解需要统一入口，但统一入口为什么一定要是 WebSocket？

答案不是“因为 WebSocket 很酷”，而是因为 Agent 场景天然有两类完全不同的消息：

1. **请求类消息**
   例如：
   - `session.create`
   - `session.get`
   - `session.close`
   - `chat.send`

2. **服务端主动推送类消息**
   例如：
   - 模型流式增量
   - 任务执行中状态变化
   - 运行结束通知
   - 出错通知

如果系统只有第一类消息，HTTP 当然可以做。

但 Agent 系统偏偏不只有“请求完就结束”的场景。  
它的核心体验恰恰在第二类消息上：

- 用户发出问题以后，不想等 10 秒再看到一整段结果
- 用户希望边生成边看到 token
- 后面如果接工具调用、推理阶段、状态变化，也都需要持续推送

所以从通信模型上看，第5章真正需要的是：

> 一个既能承载普通 RPC 请求，又能承载持续事件回推的统一通道。

WebSocket 正好满足这个条件。

这就是为什么我们不是做一个“普通接口集合”，而是做一个：

> **WebSocket Gateway**

---

### Gateway 的职责，到底是什么？

到这里，我们还要再往前走一步。

就算你接受了“需要 WebSocket Gateway”，还有一个关键问题：

> 这个 Gateway 到底负责什么，不负责什么？

如果这里不说清楚，后面代码很容易再次膨胀。

在 MiniClaw 第5章里，Gateway 的职责先收敛到这五件事：

1. 接住统一的实时入口
2. 接收并解析 RPC 请求
3. 把请求路由到正确的处理器
4. 把处理过程中的事件统一推回客户端
5. 管住 Session 的状态和并发边界

同时，它**暂时不负责**这些事：

- 不负责 CLI 界面本身
- 不负责数据库持久化
- 不负责多轮对话历史存储
- 不负责长期上下文恢复

为什么这里要故意收边界？

因为如果你在第5章同时把下面几件事混到一起：

- Gateway
- CLI
- 数据库
- 多轮对话历史
- 上下文压缩

那这一章最后就会失焦。

我们当前真正想建立的是：

> 一个支持实时 AI 输出的统一入口层。

这才是第5章的第一性原理。

---

### 所以 5.1 的第一份代码，不是 WebSocket，而是“统一能力目录”

既然第5章的核心问题是“统一入口”，那 5.1 的第一份代码就不应该是：

- `WebSocketConfig`
- `GatewayWebSocketHandler`

而应该是：

> 先把 Gateway 对外到底暴露哪些能力，明确下来。

这也是这一节真正落下的第一组代码：

- `GatewayInvocationMode`
- `GatewayMethodDefinition`
- `GatewayMethodCatalog`

先看调用模式：

```java
public enum GatewayInvocationMode {
    UNARY,
    STREAMING
}
```

这里只有两个值。

为什么只保留两个？

因为第5章当前只需要表达两种最核心的交互方式：

- `UNARY`
  一次请求，一次结果
- `STREAMING`
  一次请求，持续回推事件

然后我们再定义一个方法描述对象，说明某个 Gateway 方法到底是什么类型：

```java
public class GatewayMethodDefinition {

    private final String method;
    private final GatewayInvocationMode invocationMode;
    private final boolean requiresExistingSession;
    private final boolean createsSession;
}
```

这个类看起来很小，但它其实把第5章最重要的几个问题提前说清楚了：

- 这是什么方法
- 它是同步式还是流式
- 它是否要求先有一个现成 session
- 它自己会不会创建 session

也就是说，5.1 这一节虽然还没开始写路由器，但已经先把后面 Gateway 的“方法语义”固定下来了。

---

### 我们先把四个核心方法收进 Gateway

接下来，在 `GatewayMethodCatalog` 里，我们把第5章第一批要支持的方法先收口：

```java
private Map<String, GatewayMethodDefinition> createDefaultMethods() {
    Map<String, GatewayMethodDefinition> catalog = new LinkedHashMap<>();
    register(catalog, "session.create", GatewayInvocationMode.UNARY, false, true);
    register(catalog, "session.get", GatewayInvocationMode.UNARY, true, false);
    register(catalog, "session.close", GatewayInvocationMode.UNARY, true, false);
    register(catalog, "chat.send", GatewayInvocationMode.STREAMING, true, false);
    return Collections.unmodifiableMap(catalog);
}
```

这段代码的价值，不在于它有多复杂，恰恰在于它非常简单，但非常明确。

我们先把后面要做的事情提前写成一张“能力表”：

- `session.create`
  - 一次请求一次响应
  - 不要求已有 session
  - 它本身会创建 session

- `session.get`
  - 一次请求一次响应
  - 要求已有 session

- `session.close`
  - 一次请求一次响应
  - 要求已有 session

- `chat.send`
  - 流式方法
  - 要求已有 session
  - 它不会创建 session，而是在已有 session 上执行

注意这里最重要的一条：

> `chat.send` 和 `session.create` 虽然都是“发一条请求”，但它们在交互语义上根本不是同一种方法。

这也是为什么我们不想让系统继续长成一堆零散接口。

因为一旦没有这层统一定义，后面你在 WebSocket 层、Router 层、Handler 层，都会不停重复判断：

- 这是同步还是流式？
- 这个方法要不要 session？
- 这个方法会不会创建 session？

而现在，这些问题在 5.1 就先被提前收口了。

---

### 为什么 `chat.send` 必须绑定 session

很多同学看到这里，可能会问：

> 为什么 `chat.send` 不能像普通聊天接口一样，直接发消息就返回？

这里有两个原因。

第一个原因，**后面一定会有状态**。

哪怕第5章暂时不落数据库，`chat.send` 也不是一个完全无状态的方法。  
它至少要知道：

- 当前请求归属于哪个业务会话
- 当前这个会话是不是可用
- 当前这个会话是不是已经在运行其他任务

第二个原因，**同一个 WebSocket 连接允许挂多个业务 session**。

这点是我们在规划阶段已经明确过的。

也就是说，一个连接不是只能做一件事。  
一个连接下面，后面完全可能存在：

- `session_a`
- `session_b`
- `session_c`

这时候 `chat.send` 如果不显式绑定 `sessionId`，Gateway 根本没法知道：

> 你这次消息到底是发给哪个业务会话的？

所以从 5.1 开始，我们就先把这个边界定死：

> `chat.send` 是一个流式方法，并且它运行在某个现成的 session 上。

这个决定会直接影响后面的：

- RPC 协议设计
- Session 状态机
- SessionLane 并发控制
- EventBus 出站目标

---

### 先写测试，不是为了“补作业”，而是为了固定 Gateway 的方向

这一节虽然代码很少，但我还是先写了测试，而不是先拍脑袋把目录类写出来。

测试文件是：

```text
GatewayMethodCatalogTest
```

它约束了四件事：

1. Gateway 当前必须统一暴露这四个入口：
   - `session.create`
   - `session.get`
   - `session.close`
   - `chat.send`

2. `chat.send` 必须是 `STREAMING`

3. `chat.send` 必须要求已有 session

4. `session.create` 必须是 `UNARY`，并且是 session 的入口方法

这类测试看起来不像“业务功能测试”，但它对课程项目特别重要。

因为这一章刚开始时，最容易发生的事不是代码报错，而是方向跑偏。

比如：

- 今天有人想把 `chat.send` 做成同步接口
- 明天又有人想让 `chat.send` 自动创建 session
- 后天有人又想把能力拆成多套入口

如果没有这层最小测试，第5章后面的 Gateway 结构很容易从第一节开始就松掉。

所以这组测试的作用不是“证明目录类能跑”，而是：

> 先把 Gateway 的统一入口语义锁住。

---

### 这一节真正想让你记住什么

如果只看表面，5.1 好像还没有做什么“炫”的东西。

我们没有写 WebSocket 连接。
没有写 Router。
没有写 EventBus。
也没有写 ChatHandler。

但这一节其实做了第5章最重要的一步准备：

> 先把“统一入口”这件事定义清楚。

你要记住的，不是某个枚举类或者某个目录类，而是下面这三个工程判断：

1. **Agent 系统的实时入口，不能靠零散接口堆出来**
   因为它同时要承载普通请求和流式事件。

2. **WebSocket 只是通道，Gateway 才是结构**
   这一章的核心不是会不会写 `WebSocketHandler`，而是能不能建立统一入口层。

3. **在真正写网络层之前，先把对外能力面定义出来**
   这样后面的协议、路由、状态机和并发控制，才有一个共同锚点。

如果这一步不做，后面的 Gateway 很容易写成“能跑，但越写越散”的结构。

如果这一步先做，后面的 5.2 到 5.10 就都会顺很多。

---

### 验证命令

本节代码验证命令：

```bash
./mvnw.cmd -Dtest=GatewayMethodCatalogTest test
```

我在当前实现里，这组测试已经通过，说明第5章的统一入口能力面已经被明确写进代码。

---

### 本节小结

- 第5章的核心不是“开一个 WebSocket 端点”，而是先搭出统一的 Gateway
- 统一入口要同时承载 `session.*` 和 `chat.send`
- `chat.send` 从第一节开始就应该被定义成一个运行在 session 上的流式方法
- 所以 5.1 的第一份代码，不是网络代码，而是 `GatewayMethodCatalog`
- 这组最小代码和测试，为后面的协议、路由、状态机和并发控制打下了边界

下一节，我们才正式开始往下走：

> 把这个“统一入口”的想法，落成真正的 WebSocket 网关基础配置与连接模型。
