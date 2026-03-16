---
title: "第5.3节：连接模型之上的 SessionRegistry"
summary: "在 ConnectionRegistry 之上补齐业务 session 层，明确一个连接可以承载多个 session，并在断连时完成联动清理。"
slug: connection-manager
date: 2026-03-16
tags:
  - course
  - miniclaw
  - websocket
  - gateway
  - session
order: 3
status: published
---

> **学习目标**：理解为什么 ConnectionRegistry 还不够，以及 SessionRegistry 应该管什么、不该管什么
> **预计时长**：25 分钟
> **难度**：入门

---

### 5.2 做完以后，其实还差半层

上一节里，我们已经把 `/ws` 这条入口立住了，也有了 `ConnectionRegistry`。  
到这里，Gateway 已经能回答一个问题：

> 当前有哪些物理连接，它们分别是谁？

但它还回答不了另一个更关键的问题：

> 某个业务会话是谁创建的，它挂在哪个连接下面，它断开时该怎么清理？

很多同学写到这一步，会下意识觉得连接表已经够用了。  
实际上不够。因为 WebSocket 连接和业务 session 根本不是一回事。

- `connection` 是物理通道
- `session` 是业务单元

这两个概念在聊天 Demo 里经常被写成一个东西，但只要系统稍微往前走一步，这个设计就会开始出问题。

比如说，一个浏览器标签页连上 Gateway 以后，它完全可能先后创建多个会话：

```text
connection_1
  ├─ session_a
  ├─ session_b
  └─ session_c
```

如果你没有单独的 session 层，那后面 `chat.send`、`session.close`、事件回推目标定位，都会被迫直接绑在连接上。这样一来，业务边界就会变得很模糊。

所以 5.3 这一节的核心，不是再造一个连接表，而是在连接表之上补一层真正的业务注册表。

---

### 先把边界说死：这一节只做 SessionRegistry，不做状态机

这里我先强调一个章节边界。

5.3 我们要解决的是 “session 有没有、归谁管、怎么清理”。

5.3 **不解决**下面这些问题：

- session 当前处于什么状态
- 什么状态允许执行 `chat.send`
- 同一个 session 的并发请求怎么串行
- 会话历史怎么持久化

这些问题后面都会讲，但不是现在。

如果这一节就把状态机、并发控制、持久化一起塞进来，代码会立刻失焦。  
学员看完以后，也很难说清楚这一节到底想建立什么能力。

所以当前这一步，我们只保留 session 的最小元数据：

```java
public class GatewaySession {

    private final String sessionId;
    private final String connectionId;
    private final Instant createdAt;
}
```

这个类故意非常小。  
它现在只回答三个问题：

- 这个业务 session 的 ID 是什么
- 它属于哪个连接
- 它是什么时候创建的

先把这三个问题钉牢，后面状态机和并发控制才有落点。

---

### 为什么 ConnectionRegistry 不能顺手把 session 也管了

你可能会问，既然 `ConnectionRegistry` 里已经有 `sessionIds` 了，为什么不直接把 session 的创建和删除也放进去？

原因很简单：职责不一样。

`ConnectionRegistry` 管的是 Gateway 的物理连接模型。  
它关注的是：

- 某个 `connectionId` 对应哪个 `WebSocketSession`
- 一个连接当前绑定了哪些 `sessionId`
- 已知 `sessionId` 时，能不能反查到所属连接

而 `SessionRegistry` 关注的是业务 session 本身。  
它回答的是：

- session 是否存在
- session 属于哪个连接
- session 创建时要不要回写连接绑定
- 连接断开时，这些 session 怎么一起收掉

也就是说，这两个组件之间不是替代关系，而是协作关系。

在当前实现里，这个协作关系很清楚：

```java
public GatewaySession create(String connectionId) {
    connectionRegistry.find(connectionId)
            .orElseThrow(() -> new IllegalArgumentException("Unknown connection: " + connectionId));

    String sessionId = UUID.randomUUID().toString();
    GatewaySession session = new GatewaySession(sessionId, connectionId, Instant.now());
    sessions.put(sessionId, session);
    connectionRegistry.bindSession(connectionId, sessionId);
    return session;
}
```

这里有三个动作是连在一起的：

1. 先确认连接真的存在
2. 再创建业务 session
3. 最后把 `sessionId` 回绑到对应连接上

这一步非常重要。  
因为从 5.3 开始，我们正式把 “连接之上可以承载多个业务 session” 写进代码，而不是停留在口头设计上。

---

### `InMemorySessionRegistry` 先做内存版，正好符合这一章的边界

这一节的实现类叫 `InMemorySessionRegistry`。

这个名字其实已经把我们的取舍说得很明确了：

- 先做 session registry
- 先用内存存
- 不引入数据库
- 不做会话恢复

为什么这个选择是对的？

因为第五章当前讲的是 Gateway。  
Gateway 层现在最重要的是把会话的运行时关系维护对，而不是把数据落盘。

如果你现在为了 “更完整” 去补数据库表、Repository、历史消息结构，表面上像是在增强系统，实际上是在把课程主线打散。  
我们现在真正需要的是一个运行时注册表，它足够简单，但能支撑后面的 RPC、状态机和 SessionLane。

当前这个内存版已经提供了最核心的四类能力：

- `create(connectionId)`：创建 session
- `find(sessionId)`：按 ID 查找
- `remove(sessionId)`：删除单个 session，并解除连接绑定
- `removeAllByConnection(connectionId)`：连接断开时批量清理

其中最值得你记住的是最后一个方法。  
因为它直接决定了 Gateway 的断连清理是不是成体系的。

---

### 为什么断连清理必须先清 session，再清 connection

5.2 里，`GatewayWebSocketHandler` 的 `doFinally(...)` 只做了一件事：移除连接。  
到了 5.3，这段逻辑变成了这样：

```java
.doFinally(signalType -> {
    sessionRegistry.removeAllByConnection(connection.getConnectionId());
    connectionRegistry.remove(connection.getConnectionId());
    log.info("Gateway websocket disconnected: connectionId={}, signal={}",
            connection.getConnectionId(), signalType);
});
```

顺序不能反。

为什么？

因为 session 是挂在 connection 下面的。  
如果你先把 connection 删掉，再去删 session，后面的解绑逻辑就失去了依据。

这也是为什么 `removeAllByConnection(...)` 不应该藏在别的层里，而应该在 Gateway 的断连收口位置显式调用。  
这样你一眼就能看出来：

- 先收业务 session
- 再收物理连接

这段代码现在还不复杂，但它已经提前立下了一个很好的工程习惯：

> 断连不是“删一条连接记录”这么简单，它是一次按层回收运行时状态的动作。

后面状态机、事件流、并发控制接进来以后，这个收口会越来越重要。

---

### 这一节的测试，在验证什么

5.3 这一节我先写了两组测试。

第一组是：

```text
InMemorySessionRegistryTest
```

它验证的是 session 注册表本身的行为：

- 已有连接时，能不能创建 session
- 连接不存在时，能不能及时拒绝
- 一个连接下创建多个 session 后，批量清理是否生效

第二组是：

```text
GatewayWebSocketHandlerTest
```

这组测试在 5.2 的基础上补了一件事：

- 当 WebSocket 断开时，handler 会不会主动调用 `sessionRegistry.removeAllByConnection(...)`

注意这里验证的不是 “session 最终是不是被数据库删掉”，也不是 “状态有没有关闭”，因为那些还不是当前章节的责任。  
我们要验证的只有一件事：

> Gateway 的物理断连，能不能正确触发业务 session 的运行时清理。

这就是 5.3 这一节最核心的闭环。

---

### 学完这一节，你要真正记住什么

如果你只记一件事，那就是：

> `connection` 不是 `session`，ConnectionRegistry 也不是 SessionRegistry。

更具体一点，这一节落下来的工程判断有四个：

1. 一条 WebSocket 连接可以承载多个业务 session。
2. 业务 session 需要自己的注册表，不能直接塞进连接层混着管。
3. 当前阶段只保留 session 的最小元数据，不提前引入状态机和持久化。
4. 连接断开时，要先清 session，再清 connection。

这四条一旦站稳，后面的 5.4 到 5.8 才能顺着往上长。

否则你很容易在后面写出一种“看起来能跑，但所有边界都缠在一起”的 Gateway。  
那种代码最大的问题不是难看，而是后续几乎没法继续演进。

---

### 验证命令

本节新增代码的定向验证命令：

```bash
./mvnw.cmd "-Dtest=InMemorySessionRegistryTest,GatewayWebSocketHandlerTest" test
```

这次实现里，我另外跑了一次 backend 全量测试：

```bash
mvn test
```

结果是：

- `36` 个测试通过
- `4` 个 live 测试按预期跳过

说明 5.3 引入 `SessionRegistry` 之后，没有把前面的 LLM client 和 Gateway 基础能力带坏。

---

### 本节小结

- 5.2 解决的是物理连接入口，5.3 解决的是连接之上的业务 session。
- `GatewaySession` 当前只保留 `sessionId`、`connectionId`、`createdAt` 三个字段。
- `InMemorySessionRegistry` 负责 session 的创建、查询、删除和按连接批量清理。
- `GatewayWebSocketHandler` 在断连时先清 session，再清 connection，补齐了运行时清理闭环。

下一节开始，我们就可以正式往协议层推进了：

> 既然 Gateway 现在已经知道连接和 session 的关系，那它们之间到底该通过什么样的 RPC 帧来通信？
