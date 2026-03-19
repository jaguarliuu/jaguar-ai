---
title: "第5.6节：EventBus，把 handler 和 WebSocket 出站解耦"
summary: "在 RpcRouter 已经能把 request 分发给 handler 以后，再补上 GatewayEventBus 和 OutboundDispatcher，让业务处理层不直接碰 WebSocketSession，也能把事件稳定推回目标连接。"
slug: event-bus
date: 2026-03-19
tags:
  - course
  - miniclaw
  - gateway
  - websocket
  - eventbus
order: 6
status: published
---

> **学习目标**：理解为什么 handler 不应该直接操作 `WebSocketSession`，以及 `GatewayEventBus + OutboundDispatcher` 这一层到底在 Gateway 里承担什么职责。
> **预计时长**：15 分钟
> **难度**：入门

---

### 5.5 做完以后，分发有了，但“结果怎么回去”还没解决

上一节我们已经解决了一个关键问题：

> 收到一条 `request` 以后，Gateway 知道该把它交给谁处理了。

也就是：

- `session.create` 可以交给 `SessionHandler`
- `chat.send` 可以交给 `ChatHandler`
- unknown method 会稳定落成协议错误帧

但这时还剩下另一个同样重要的问题：

> handler 处理过程中产生的结果，应该怎么回到正确的 WebSocket 客户端？

如果这里不提前设计，很容易写成下面这种结构：

- `SessionHandler` 直接拿 `WebSocketSession`
- `ChatHandler` 直接拿 `WebSocketSession`
- handler 里自己拼 JSON
- handler 里自己决定什么时候 `send(...)`

短期当然也能跑。

但这会立刻带来三个问题：

1. handler 和 WebSocket 连接层强耦合
2. 以后做测试时，很难只测业务，不测 socket 细节
3. 后面加状态机、并发控制、流式 chat 时，所有处理器都会反过来依赖网络层

所以 5.6 这一节的核心目标非常明确：

> 让 handler 只负责“产生命令性结果”，  
> 真正的出站发送，统一收口到 Gateway 的出站层。

---

### 为什么 handler 不应该直接碰 `WebSocketSession`

这一点站在学生角度特别容易写歪。

很多人第一次做 WebSocket Gateway，会自然写成：

```java
public class ChatHandler {

    public void handle(WebSocketSession session, RpcRequestFrame request) {
        session.send(...);
    }
}
```

这段代码的问题不在于它不能工作，而在于它把两层职责混在了一起：

- handler 的职责，本来应该是“处理业务请求”
- `WebSocketSession` 的职责，本来属于“网络连接层”

一旦这两层混在一起，后面你会越来越难回答下面这些问题：

- 我现在是在测业务逻辑，还是在测网络发送？
- 如果以后不是 WebSocket，而是别的出站通道，handler 要不要重写？
- 如果一个 handler 过程中要发多种事件，序列化和目标连接判断由谁管？

所以从工程边界上说，正确的方向应该是：

1. handler 不直接发消息
2. handler 只发布“出站事件”
3. 真正的出站发送由统一组件处理

这就是 5.6 这一节引入 `GatewayEventBus` 的原因。

---

### `GatewayEvent`：先把 Gateway 内部的出站事件定义清楚

这节先定义一个最小事件对象：

```java
public class GatewayEvent {

    private final String connectionId;
    private final String sessionId;
    private final String requestId;
    private final Object frame;
}
```

这里四个字段各自承担一层职责：

1. `connectionId`
   表示这条出站事件最终应该推回哪个物理连接

2. `sessionId`
   表示这条事件属于哪个业务 session

3. `requestId`
   表示这条事件属于哪一次 RPC 调用

4. `frame`
   表示真正要发出去的协议帧对象，比如后面的 `RpcEventFrame`

注意这里最关键的设计点不是“字段多不多”，而是：

> 出站事件的目标定位信息，已经在 Gateway 内部被显式带上了。

也就是说，从 5.6 开始，handler 以后不需要知道具体的 `WebSocketSession` 是谁，它只需要知道：

- 这条事件发给哪个 `connectionId`
- 这条事件属于哪个 `sessionId`
- 这条事件对应哪个 `requestId`

剩下的真正发送动作，可以延后交给统一出站层处理。

---

### `GatewayEventBus`：先做进程内事件总线，不做分布式消息系统

这节的 EventBus 非常克制：

```java
@Component
public class GatewayEventBus {

    private final Sinks.Many<GatewayEvent> sink = Sinks.many().multicast().onBackpressureBuffer();

    public void publish(GatewayEvent event) {
        Sinks.EmitResult result = sink.tryEmitNext(event);
        if (result.isFailure()) {
            throw new IllegalStateException("Failed to publish gateway event: " + result);
        }
    }

    public Flux<GatewayEvent> events() {
        return sink.asFlux();
    }
}
```

这里要强调两点。

第一，当前只做 **进程内 EventBus**。

也就是说它只是 Gateway 进程内部的一条响应式事件流，不涉及：

- Kafka
- Redis Pub/Sub
- MQ
- 跨节点广播

这是有意控制章节体量。

因为 chapter 5 的重点是先把单进程 Gateway 的结构搭出来，不是提前引入分布式消息系统。

第二，这里用 Reactor `Sink`，不是为了“炫技”，而是因为它天然适合当前这个场景：

- 业务层发布事件
- 出站层订阅事件
- 中间不需要强耦合引用

所以你可以把 `GatewayEventBus` 理解成一句话：

> 它不是业务处理器，也不是网络发送器，  
> 它只是 Gateway 内部的“事件中转线”。

---

### `OutboundDispatcher`：真正把事件变成出站 JSON

有了 EventBus，下一步还差一层：

> 谁来把内部事件，变成最终可发送的出站内容？

这一层就是 `OutboundDispatcher`。

当前实现也很小：

```java
@Component
public class OutboundDispatcher {

    public Flux<String> outboundJson(String connectionId) {
        return eventBus.events()
                .filter(event -> connectionId.equals(event.getConnectionId()))
                .map(event -> toJson(event.getFrame()));
    }
}
```

这里故意只做两件事：

1. 按 `connectionId` 过滤目标事件
2. 把 `frame` 序列化成 JSON 字符串

注意这个设计非常关键。

它说明从 5.6 开始，Gateway 已经把“出站目标判断”和“出站协议序列化”集中收口了。

handler 不再负责：

- 这条消息发给谁
- 这条协议帧如何转成 JSON

而是只负责产出一个带目标信息的 `GatewayEvent`。

你可以把这一层理解为：

> EventBus 负责中转，Dispatcher 负责出站整形。

这两个组件配合起来，才真正构成 Gateway 的出站基础设施。

---

### `GatewayWebSocketHandler` 在 5.6 里终于有了真正的出站链路

到这一步，`GatewayWebSocketHandler` 才第一次真正具备了“往客户端推消息”的能力。

当前实现把入口和出站并在一起：

```java
Mono<Void> inbound = session.receive()
        .filter(message -> message.getType() == WebSocketMessage.Type.TEXT)
        .doOnNext(...)
        .then();

Mono<Void> outbound = session.send(
        outboundDispatcher.outboundJson(connection.getConnectionId())
                .map(session::textMessage)
);

return Mono.when(inbound, outbound)
        .doFinally(...);
```

这段代码的教学价值很高，因为它明确说明了三层关系：

1. `GatewayWebSocketHandler`
   负责连接生命周期和真正的 WebSocket 收发

2. `OutboundDispatcher`
   负责把“属于这个 connectionId 的事件”转成 JSON

3. `GatewayEventBus`
   负责在业务处理层和出站层之间做中转

也就是说，5.6 并没有把 `WebSocketSession` 散落到各个 handler 里，而是继续守住了边界：

> 只有 WebSocket handler 碰 `WebSocketSession`，  
> 业务层只碰 Gateway 自己的事件模型。

这是后面能继续接状态机、SessionLane、chat 流式输出的前提。

---

### 这一节的测试，真正锁住了什么

5.6 这次我先写了两层测试。

第一层是：

```text
GatewayEventBusTest
```

它锁住了两件事：

1. 发布出来的 `GatewayEvent` 会保留 `connectionId / sessionId / requestId`
2. `OutboundDispatcher` 只会给匹配的目标连接输出对应 JSON

这层测试的意义是先验证：

> EventBus 和 Dispatcher 这两层自己的职责是否成立。

第二层是：

```text
GatewayWebSocketHandlerTest
```

新增用例锁住的是：

> `GatewayWebSocketHandler` 会不会把 `OutboundDispatcher` 给出的 JSON 桥接成真正的 `textMessage` 发出去。

注意这里仍然没有去测业务 handler 本身。

这是故意的。

因为 5.6 这一节真正要验证的不是：

- `chat.send` 已经完整打通了没有
- session 状态已经转起来了没有

这些属于后面的章节。

5.6 真正要验证的是：

> Gateway 的出站基础设施，是不是已经成立。

---

### 学完 5.6，你真正要记住什么

这一节最重要的，不是记住 `Sink` 的 API，而是记住下面四个工程判断：

1. handler 不应该直接操作 `WebSocketSession`
2. 出站事件应该先抽象成 `GatewayEvent`
3. `GatewayEventBus` 负责中转，不负责发送
4. `OutboundDispatcher` 负责按连接过滤并序列化出站消息

只要这四个点站住，后面继续往前做时，你就不会把：

- 路由
- 业务处理
- 出站发送
- WebSocket 生命周期

这些东西重新揉回一个类里。

这也是 5.6 这一节最大的价值。

它不是为了引入一个“高级概念”，而是为了继续守住 Gateway 的结构边界。

---

### 验证命令

本节新增代码的定向验证命令：

```bash
./mvnw.cmd "-Dtest=GatewayEventBusTest,GatewayWebSocketHandlerTest" test
```

我这次实现里，这组测试已经通过，说明 5.6 的最小目标已经成立：

- EventBus 能发布和观察出站事件
- Dispatcher 能按目标连接过滤消息
- WebSocket handler 能把目标 JSON 真正桥接成出站文本帧

---

### 本节小结

- 5.6 没有急着实现完整 `chat.send` 流程
- 我们先补上了 `GatewayEvent`
- 我们先补上了进程内 `GatewayEventBus`
- 我们补上了 `OutboundDispatcher`
- `GatewayWebSocketHandler` 已经具备了最小出站发送链路
- 从这一节开始，业务层和 WebSocket 出站层被正式解耦

下一节开始，我们才继续往上推进：

> 既然出站链路已经有了，  
> 那 session 本身的生命周期和状态迁移，应该怎么被约束住？
