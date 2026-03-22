---
title: "第5.7节：SessionStateMachine，用状态约束会话生命周期"
summary: "在 Gateway 已经有了连接模型、RPC 路由和事件总线以后，再补上 SessionState 和 SessionStateMachine，让系统明确知道一个 session 什么时候能运行、什么时候不能运行。"
slug: session-state-machine
date: 2026-03-22
tags:
  - course
  - miniclaw
  - gateway
  - session
  - statemachine
order: 7
status: published
---

> **学习目标**：理解为什么 session 不能只是一个普通对象，以及为什么 Gateway 必须用状态机来约束 session 的生命周期和方法调用合法性。
> **预计时长**：15 分钟
> **难度**：入门

---

### 5.6 做完以后，Gateway 还是缺一条“合法性判断线”

前面几节我们已经把 Gateway 的骨架逐步搭起来了：

- `/ws` 已经挂起来了
- `connection` 和 `session` 已经分层
- `request / event / completed / error` 协议已经定下来了
- `RpcRouter` 已经能按 `method` 分发
- `GatewayEventBus` 和 `OutboundDispatcher` 已经把出站链路搭起来了

这时系统看起来已经比较像一个完整 Gateway 了。

但还差一个非常关键的问题：

> 某个 session 当前到底处于什么阶段？  
> 某个方法在这个阶段到底允不允许执行？

如果没有这条判断线，后面你只要开始接：

- `chat.send`
- 运行中状态
- 关闭会话
- 并发控制

系统就会立刻开始变得含糊。

比如：

- 一个已经关闭的 session，还能不能继续发 `chat.send`？
- 一个正在运行中的 session，能不能再重复启动新的任务？
- 一个刚创建的 session，什么时候算进入运行态？

如果这些问题不先收口，后面你每加一个 handler、每加一条业务链路，都要在各处自己判断一次。

所以 5.7 这一节要解决的核心不是“多加一个字段”，而是：

> 把 session 的生命周期规则，从散落判断，收口成显式状态机。

---

### 为什么 session 不能只是一个普通数据对象

5.3 的时候，我们故意把 `GatewaySession` 保持得很小：

```java
public class GatewaySession {

    private final String sessionId;
    private final String connectionId;
    private final Instant createdAt;
}
```

当时这样做是对的。

因为 5.3 的目标只是先把：

- session 是否存在
- session 属于哪个连接
- 断连时如何清理

这几个最小问题说清楚。

但一旦 chapter 5 继续往前走，这个“最小 session 对象”就不够了。

原因不是字段少，而是它缺少一个最重要的能力：

> 它无法表达“当前这个 session 在生命周期里的哪个阶段”。

如果你没有状态，后面只能用隐式规则来猜：

- 能不能执行 `chat.send`
- 是否正在运行
- 是否已经结束

这种设计在教学和工程上都很差。

因为学生最后学到的不是“系统如何建模”，而是“在各种 if 里拼命补判断”。

所以这一步必须往前走：

> 让 `GatewaySession` 从“只有身份信息的对象”，变成“带运行时状态的对象”。

---

### `SessionState`：先把状态集合收口

这节先引入一个最小状态枚举：

```java
public enum SessionState {
    IDLE,
    RUNNING,
    CLOSED
}
```

这里刻意只保留三个状态。

原因不是现实世界里只有这三种，而是当前章节只需要这三种就够了。

它们分别表达的是：

1. `IDLE`
   session 已存在，但当前没有任务在跑

2. `RUNNING`
   session 正在执行某个任务，例如后面的 `chat.send`

3. `CLOSED`
   session 已经关闭，不再接受后续调用

注意这一步的重点不是状态名本身，而是：

> 我们终于把“session 当前是否可运行、是否可继续接收方法调用”变成了显式状态。

从教学角度看，这一步特别重要。

因为学生会第一次很明确地看到：

- connection 是物理连接对象
- session 是业务对象
- state 是业务对象当前所处的生命周期阶段

这三者从这里开始被彻底拆开了。

---

### `GatewaySession`：状态变成运行时对象的一部分

有了 `SessionState`，下一步就是把它真正放进 `GatewaySession`：

```java
public class GatewaySession {

    private final String sessionId;
    private final String connectionId;
    private final Instant createdAt;
    private SessionState state;
}
```

这里有一个很关键的设计取舍：

`state` 不是单独散落在别处的附属信息，而是直接成为 `GatewaySession` 的一部分。

这意味着从 5.7 开始，session 不再只是“注册表里的一个条目”，而是一个真正带运行时语义的对象。

同时，`InMemorySessionRegistry#create(...)` 也开始承担一个新的职责：

```java
GatewaySession session = new GatewaySession(
    sessionId,
    connectionId,
    Instant.now(),
    SessionState.IDLE
);
```

也就是说，session 创建的同时，系统就已经明确规定：

> 新建 session 的起点状态是 `IDLE`。

这一点非常重要。

如果这里不显式规定起始状态，后面你就会不断在代码里临时假设：

- “新建 session 应该算 idle 吧”
- “默认是不是 running 呢”

这些模糊空间会让后面的状态机设计越来越乱。

所以 5.7 这一节，第一条真正被钉住的规则就是：

> `session.create` 之后，session 的初始状态必须是 `IDLE`。

---

### `SessionStateMachine`：把合法迁移规则集中起来

真正的核心在这里。

我们没有把状态判断散落在各个 handler 或 registry 里，而是单独引入：

```java
@Component
public class SessionStateMachine {
    ...
}
```

它当前承担两类职责：

1. 状态迁移是否合法
2. 某个方法在当前状态下是否允许执行

当前最小迁移规则是：

- `IDLE -> RUNNING` 允许
- `RUNNING -> IDLE` 允许
- `IDLE -> CLOSED` 允许
- `RUNNING -> CLOSED` 当前不允许
- `CLOSED` 不再继续迁移

为什么 5.7 先故意不支持 `RUNNING -> CLOSED`？

因为这一节的重点不是把“所有现实场景”一次性做全，而是先给学生建立一个很清楚的判断框架：

> 合法迁移必须被明确写出来，  
> 不在规则里的迁移，不是默认允许，而是默认拒绝。

这正是状态机和普通 `if` 判断最大的区别。

如果没有状态机，后面经常会出现这种写法：

- 这里顺手把状态改了
- 那里又顺手改一次
- 最后谁都说不清哪些迁移本来是允许的

而现在，迁移规则第一次被集中起来了。

---

### 为什么 `CLOSED` 要显式拒绝 `chat.send`

这节里我们还加了一个非常重要但很小的规则：

```java
public void assertAllowsMethod(GatewaySession session, String method) {
    if (session.getState() == SessionState.CLOSED && "chat.send".equals(method)) {
        throw new IllegalStateException(
                "Session " + session.getSessionId() + " in state CLOSED does not allow method " + method
        );
    }
}
```

它看起来很简单，但教学价值很高。

因为它第一次把“状态机不只是改状态，还负责约束方法调用合法性”这件事明确写进了代码。

这很关键。

如果后面每个 handler 都自己判断：

- session 是不是 closed
- 这个方法还能不能执行

那状态规则马上又会散回各处。

所以从 5.7 开始，我们要建立一个很明确的心智模型：

> 状态机不只是管理状态变化，  
> 也负责给业务调用提供“是否合法”的统一判断。

这会直接影响后面的：

- `chat.send`
- 会话关闭
- 并发控制
- 中断与恢复

所以这一步虽然代码不多，但属于 chapter 5 的关键结构点。

---

### 这一节的测试，真正锁住了什么

5.7 这次我先写的是：

```text
SessionStateMachineTest
```

它锁住了五件事：

1. 新建 session 的状态是 `IDLE`
2. `IDLE -> RUNNING` 合法
3. `RUNNING -> IDLE` 合法
4. `RUNNING -> CLOSED` 当前非法
5. `CLOSED` 状态拒绝 `chat.send`

注意这里测试的不是：

- session registry 的所有行为
- router 是否已经接上状态机
- chat 是否已经完整打通

这些都不是 5.7 当前要解决的问题。

5.7 这节要验证的是：

> Session 的生命周期规则本身，是否已经被独立建模出来。

这也是为什么测试会这么聚焦。

它不是在验证“功能很多”，而是在验证“状态规则是否第一次成型”。

---

### 学完 5.7，你真正要记住什么

这一节最重要的，不是背枚举值，而是记住下面四个判断：

1. session 不能只是一个普通注册对象，它必须显式携带当前状态
2. 新建 session 的起始状态必须被系统明确规定
3. 合法和非法的状态迁移，必须集中定义在状态机里
4. 状态机不仅管理迁移，也管理方法调用是否合法

只要这四个点站住，后面的 5.8 `SessionLane` 就会非常自然。

因为 5.8 要解决的是：

> 即使状态规则已经对了，  
> 如果两个请求同时打到同一个 session，执行顺序怎么保证？

也就是说，5.7 解决的是“能不能做”，5.8 解决的是“同时来怎么办”。

这两节必须这样前后衔接，学生的心智负担才不会乱。

---

### 验证命令

本节新增代码的定向验证命令：

```bash
./mvnw.cmd -Dtest=SessionStateMachineTest test
./mvnw.cmd "-Dtest=InMemorySessionRegistryTest,SessionStateMachineTest" test
```

我这次实现里，这两组测试已经通过，说明 5.7 的最小目标已经成立：

- session 创建时已经带有明确初始状态
- 状态迁移规则已经被收口到状态机
- `CLOSED` 状态已经能拒绝后续 `chat.send`

---

### 本节小结

- 5.7 没有急着去接入完整业务链路
- 我们先补上了 `SessionState`
- 我们让 `GatewaySession` 真正具备了运行时状态
- 我们让 `InMemorySessionRegistry` 在创建 session 时初始化状态
- 我们补上了 `SessionStateMachine`
- 从这一节开始，session 生命周期和方法合法性都有了统一约束点

下一节开始，我们才继续往前推进：

> 既然状态规则已经明确了，  
> 那同一个 session 上两个请求同时打进来时，执行顺序该怎么被串行化？
