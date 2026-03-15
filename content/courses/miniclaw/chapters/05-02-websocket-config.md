---
title: "第5.2节：WebSocket 网关基础配置与连接模型"
summary: "把 `/ws` 真正立成 Gateway 入口，并先搭好连接注册、连接清理和一连接多 Session 的基础模型。"
slug: websocket-config
date: 2026-03-15
tags:
  - course
  - miniclaw
  - websocket
  - gateway
order: 2
status: published
---

> **学习目标**：把 Gateway 的 WebSocket 入口跑起来，并先把连接模型搭对
> **预计时长**：25 分钟
> **难度**：入门

---

### 这一节我们不做 Echo

很多 WebSocket 教程都有一个经典开场：

- 客户端发一句 `hello`
- 服务端回一句 `Echo: hello`

这个例子当然没错，但它有一个问题：

> 它几乎不会留下任何能进入真实系统结构的东西。

如果我们第5章也这样开头，你很快就会写出一个临时的 `EchoWebSocketHandler`，然后下一节又把它推翻，再重写成 Gateway。

这对教学项目不是最好的路径。

因为 MiniClaw 第5章要搭的不是“一个能收发消息的玩具 WebSocket 服务”，而是：

> 一个未来要承接 `session.*`、`chat.send`、流式事件回推的正式 Gateway 入口。

所以 5.2 这一节，我们直接做正式结构里的第一步：

- 配置 `/ws`
- 接住 WebSocket 连接
- 给每个连接分配 `connectionId`
- 把连接注册到内存中的 `ConnectionRegistry`
- 在连接断开时正确清理

注意，我们这一节**故意不做**这些事：

- 不做 RPC 协议解析
- 不做 Router
- 不做 ChatHandler
- 不做 EventBus 出站

这不是没做完，而是这一节只先把“入口层”搭稳。

---

### 先把两个概念分开：连接不是 Session

在真正写代码之前，这一节最关键的认知，是先把两个经常被混在一起的概念拆开：

1. **Connection**
   WebSocket 物理连接

2. **Session**
   Gateway 上层的业务会话

如果你现在就把它们混成一个东西，后面代码很快会乱。

因为我们前面已经明确过一条架构约束：

> 一个 WebSocket 连接下，允许挂多个业务 session。

这意味着：

- Connection 是通信层对象
- Session 是业务层对象
- 两者不是一一对应

也正因为如此，5.2 这一节不能只写一个“连接 ID -> WebSocketSession”的 Map 就结束。

它至少还得回答一个问题：

> 这个连接下面将来可能会挂哪些 session？

所以我们先定义了 `ConnectionContext`：

```java
public class ConnectionContext {

    private final String connectionId;
    private final WebSocketSession webSocketSession;
    private final Set<String> sessionIds = ConcurrentHashMap.newKeySet();
}
```

这一步的意义非常重要。

我们没有把 Connection 设计成一个“只有 session 的薄壳”，也没有反过来把 Session 硬塞进通信层，而是先明确：

> 一个连接有自己的身份，也有自己绑定的一组业务 session。

这样后面做 `session.create`、`session.close`、事件回推时，才有稳定的连接落点。

---

### 先搭 `ConnectionRegistry`，不要让 handler 自己管所有状态

接下来，很多同学会顺手这样写：

```java
public Mono<Void> handle(WebSocketSession session) {
    String connectionId = UUID.randomUUID().toString();
    // 然后在 handler 里自己维护连接状态
}
```

短期能跑，但很快就会出现两个问题：

第一个问题，`GatewayWebSocketHandler` 会开始承担太多职责：

- 生成连接 ID
- 保存连接
- 绑定 session
- 处理断连清理

第二个问题，后面别的组件如果也要查连接，就只能继续绕着 handler 打转。

所以这一节我们单独拉出一个 `ConnectionRegistry`：

```java
@Component
public class ConnectionRegistry {

    private final ConcurrentHashMap<String, ConnectionContext> connections = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> sessionOwners = new ConcurrentHashMap<>();
}
```

这里用了两张表。

第一张表：

- `connectionId -> ConnectionContext`

它解决的是：

> 我怎么找到某个连接本身？

第二张表：

- `sessionId -> connectionId`

它解决的是：

> 当后面我只有一个 `sessionId` 的时候，怎么反查它归属哪个连接？

这个设计看起来比一个 Map 稍微重一点，但它是值得的。

因为我们当前已经知道，后面一定会出现下面这类问题：

- 某个 session 的事件应该发回哪个连接？
- 连接断开时，它挂着的 session 绑定要怎么清？
- 一个 session 能不能被重复绑定到另一个连接？

这正是 `ConnectionRegistry` 现在提前承担的职责。

---

### `ConnectionRegistry` 这一节具体做了什么

这节的 `ConnectionRegistry` 没有追求大而全，而是只保留了第5.2 当前真正需要的能力：

1. 注册连接

```java
public ConnectionContext register(WebSocketSession session)
```

它会生成一个 `connectionId`，创建 `ConnectionContext`，再放进连接表。

2. 删除连接

```java
public void remove(String connectionId)
```

这里不是简单从连接表里删掉一条记录，而是还要顺手把这个连接绑定过的所有 `sessionId` 一起从 `sessionOwners` 里清掉。

也就是说，连接关闭时，清理不是单点动作，而是两层动作：

- 清连接
- 清绑定关系

3. 绑定和解绑 Session

```java
public void bindSession(String connectionId, String sessionId)
public void unbindSession(String connectionId, String sessionId)
```

这一步虽然当前还没在业务链路里用起来，但它先把连接模型的边界补齐了。

特别是 `bindSession(...)` 里有一个很重要的约束：

> 同一个 session 不能被绑定到两个不同连接。

这条规则不是现在临时需要，而是后面做 EventBus 和出站路由时一定要依赖的前提。

所以 5.2 这一节看起来像是在写“连接管理”，其实本质上是在给后面的 Gateway 出站链路打地基。

---

### 正式的 Gateway 入口：`GatewayWebSocketHandler`

连接模型有了，下一步就该把真正的 WebSocket 入口立起来。

这里我们没有再写 `EchoWebSocketHandler`，而是直接把类名定成：

```java
GatewayWebSocketHandler
```

这不是命名洁癖，而是在代码层面先把方向钉住：

> 这个 handler 不是 demo handler，它就是后面真正的 Gateway 入口。

当前版本的 `handle(...)` 逻辑很克制：

```java
@Override
public Mono<Void> handle(WebSocketSession session) {
    ConnectionContext connection = connectionRegistry.register(session);

    return session.receive()
            .filter(message -> message.getType() == WebSocketMessage.Type.TEXT)
            .doOnNext(message -> log.debug(
                    "Gateway received inbound text frame before router is ready: connectionId={}, payload={}",
                    connection.getConnectionId(),
                    message.getPayloadAsText()
            ))
            .then()
            .doFinally(signalType -> {
                connectionRegistry.remove(connection.getConnectionId());
            });
}
```

这里你要特别注意两个点。

第一个点，**它当前只做最小入站处理**。

收到文本帧以后，我们现在只是先记日志，还没有开始解析 RPC。  
这是刻意的。

因为协议层的工作，应该放到 5.4 和 5.5，不能在 5.2 就提前糊成一坨。

第二个点，**连接清理必须放在 `doFinally(...)`**。

因为 WebSocket 连接结束，可能有很多原因：

- 正常关闭
- 客户端取消
- 异常断开

但不管是哪一种，Gateway 都必须做同一件事：

> 把这个连接从注册表里清理掉。

这就是为什么这里不用 `doOnComplete(...)`，而是用 `doFinally(...)`。

---

### `/ws` 这条路由到底是怎么挂上的

到这里，我们还差最后一块：怎么把 `GatewayWebSocketHandler` 真正挂到 `/ws` 上。

这一节的配置类很简单：

```java
@Configuration
public class WebSocketConfig {

    @Bean
    public HandlerMapping webSocketHandlerMapping() {
        SimpleUrlHandlerMapping handlerMapping = new SimpleUrlHandlerMapping();
        handlerMapping.setOrder(-1);
        handlerMapping.setUrlMap(Map.of("/ws", gatewayWebSocketHandler));
        return handlerMapping;
    }

    @Bean
    public WebSocketHandlerAdapter webSocketHandlerAdapter() {
        return new WebSocketHandlerAdapter();
    }
}
```

这里的重点只有两个。

第一，`/ws` 被明确指定成 Gateway 的实时入口。

第二，`setOrder(-1)` 把这条路由的优先级提到普通 HTTP 路由前面。

为什么要这样？

因为 `/ws` 不是一个普通 Controller 路径，它是协议升级入口。  
如果路由优先级不对，后面排查问题会很烦。

你可以把 5.2 这一节理解成：

> 我们不是“把 WebSocket 开启了”，而是正式把 Gateway 的入口端口接到了系统里。

---

### 这一节的测试为什么分成两组

这一节虽然只是入口层，但我还是先写了两组测试。

第一组是：

```text
ConnectionRegistryTest
```

这组测试验证的是连接模型本身：

- 连接能不能注册
- 一个连接能不能挂多个业务 session
- 连接关闭时，绑定关系会不会被清干净

第二组是：

```text
GatewayWebSocketHandlerTest
```

这组测试验证的是 handler 生命周期：

- 连接建立时会不会注册
- 连接关闭时会不会移除
- 当前还没有 Router 时，收到文本帧会不会稳定忽略而不是乱处理

这两组测试加起来，刚好覆盖了 5.2 这一节最核心的两个面：

- 连接模型
- WebSocket 生命周期

也就是说，到这一节结束，我们虽然还没有开始做协议和路由，但至少已经保证了一件事：

> Gateway 的物理入口和连接状态，不再是漂着的。

---

### 用调试工具验证 5.2，预期是什么？

这一节代码写完以后，你可以先启动服务：

```bash
./mvnw spring-boot:run
```

然后用 WebSocket 调试工具连接：

```text
ws://localhost:8080/ws
```

此时你应该能看到服务端日志出现一条连接建立记录，大概类似：

```text
Gateway websocket connected: connectionId=...
```

你也可以主动发一条任意文本消息，比如：

```json
{"type":"request","method":"chat.send"}
```

这时候要注意：

> 当前阶段服务端不会回消息。

这不是 bug，而是本节的预期行为。

原因很简单：

- 5.2 已经有入口
- 但 5.4 的协议解析还没写
- 5.5 的 Router 也还没接进来

所以现在这条文本帧只会被记录为“收到了一条入站文本消息”，不会产生正式响应。

等你主动断开连接时，服务端还应该再出现一条日志：

```text
Gateway websocket disconnected: connectionId=..., signal=...
```

这就说明当前 Gateway 的连接注册和清理链路已经闭环了。

---

### 这一节真正想让你记住什么

5.2 这一节表面上是在讲 WebSocket 配置，但你真正应该记住的是四个工程判断。

1. **不要为了教学方便，先写一个注定会被删掉的 Echo 结构**
   如果后面确定要做 Gateway，就应该尽早把正式入口类立起来。

2. **Connection 和 Session 必须分层**
   一个连接可以挂多个业务 session，所以不能把它们混成同一个概念。

3. **连接状态不要塞进 handler 本身**
   handler 负责连接生命周期，注册表负责连接状态。

4. **入口层要先稳定，再继续往上叠协议和路由**
   如果入口层是乱的，后面的 RPC、EventBus、SessionLane 只会越做越乱。

这就是为什么 5.2 做完以后，我们依然没有开始聊 `chat.send` 的完整链路。

因为第5章要搭的是一层一层清晰往上长的 Gateway，而不是一口气把所有东西堆在 `handle(...)` 里面。

---

### 验证命令

本节新增代码验证命令：

```bash
./mvnw.cmd "-Dtest=ConnectionRegistryTest,GatewayWebSocketHandlerTest" test
```

在我当前这次实现里，这两组测试已经通过，说明：

- 连接模型成立
- WebSocket 入口生命周期成立

---

### 本节小结

- 我们没有继续走 Echo Demo，而是直接建立了正式的 `GatewayWebSocketHandler`
- 我们通过 `WebSocketConfig` 把 `/ws` 挂成了系统的实时入口
- 我们引入了 `ConnectionContext` 和 `ConnectionRegistry`
- 我们明确了“一个连接可以挂多个业务 session”的连接模型
- 我们让连接的注册与清理形成了闭环

下一节开始，我们会继续把“物理连接”往“业务会话”推进：

> 在 Gateway 里，连接模型和 SessionRegistry 到底应该怎么配合。
