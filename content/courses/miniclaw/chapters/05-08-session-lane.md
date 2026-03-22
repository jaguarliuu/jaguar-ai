---
title: "第 5.8 节：SessionLane，用串行队列守住同 Session 并发"
summary: "在 Gateway 已经有了状态机以后，再补上一层 SessionLane，让同一个 session 下的响应式任务按顺序执行，避免两个请求同时打进来时把运行时状态冲乱。"
slug: session-lane
date: 2026-03-22
tags:
  - course
  - miniclaw
  - gateway
  - session
  - reactor
order: 8
status: published
---

> **学习目标**：理解为什么 `SessionStateMachine` 还不够，为什么同一个 session 上还必须有一条串行执行通道，以及如何用一个最小 `SessionLane` 把并发顺序收住。  
> **预计时长**：15 分钟  
> **难度**：入门

---

### 5.7 做完以后，为什么还不能直接上 `chat.send`

上一节我们已经把这一类问题收住了：

- 一个 session 当前是什么状态
- 某个状态迁移是否合法
- 某个方法在当前状态下能不能执行

这说明 `SessionStateMachine` 已经在回答：

> “这件事能不能做？”

但它还没有回答另一个同样关键的问题：

> “如果两件事同时打进来，先做谁？”

这两个问题不是一回事。

举个最典型的例子。假设同一个 session 当前在 `IDLE`，这时前端因为网络重试或用户误触，连续发了两个 `chat.send`：

- 第一个请求判断状态时，看到 `IDLE`
- 第二个请求判断状态时，也看到 `IDLE`

如果系统只是有状态机，没有并发控制，那么两个请求都可能觉得自己“合法”，然后一起往后跑。

这时你会得到两类非常糟糕的后果：

- 同一个 session 上出现两个并发任务
- 状态迁移顺序被打乱，后面根本说不清是谁先把状态改成了 `RUNNING`

所以从 5.8 开始，我们要再把边界往前推一步：

> `SessionStateMachine` 负责判断“能不能做”，  
> `SessionLane` 负责保证“同一个 session 上按顺序做”。

只有这两层一起站住，后面的 `chat.send` 主链路才有稳定落点。

---

### `SessionLane` 解决的不是业务含义，而是执行顺序

先把这层抽象说清楚。

`SessionLane` 不是：

- RPC Router
- 业务 Handler
- Session 状态机
- EventBus

它只做一件事：

> 给每个 session 准备一条独立的执行通道，让提交到这条通道里的任务串行运行。

这意味着：

- 同一个 session 下的任务必须一个接一个跑
- 不同 session 的任务互不影响，可以并行
- 某个任务失败以后，不能把整个通道直接毒死

你可以把它理解成“每个 session 一条单独的单线程队列”，只不过这里我们不是开真实线程，而是用 Reactor `Mono` 把任务包起来，再由 `SessionLane` 统一调度。

这一步的教学意义很大。

因为学生会第一次很清楚地看到：

- 状态机约束的是合法性
- Lane 约束的是顺序性

这两者如果混在一起写，后面代码很快就会变成到处都是 if、锁、标记位，最后谁也说不清问题到底属于状态还是属于并发。

---

### 当前实现：一个 `sessionId` 对应一个 `Lane`

这一节我们先实现一个最小可用版本：

```java
@Component
public class SessionLane {

    private final ConcurrentHashMap<String, Lane> lanes = new ConcurrentHashMap<>();

    public <T> Mono<T> submit(String sessionId, Supplier<Mono<T>> taskSupplier) {
        return Mono.create(sink -> lane(sessionId).enqueue(new LaneTask<>(taskSupplier, sink)));
    }
}
```

这个入口只表达一件事：

> 把一个响应式任务提交到某个 session 对应的 lane 里。

这里刻意没有提前引入更复杂的 API，比如：

- 优先级
- 超时调度
- 取消传播
- 背压策略配置

原因很简单，这一节的目标不是做一个功能很满的调度器，而是先把“同 session 串行、跨 session 并行”这个核心模型立住。

`SessionLane` 内部用一个 `ConcurrentHashMap<String, Lane>` 保存活动中的 lane。

也就是说：

- 第一次看到某个 `sessionId`，就创建一个新的 lane
- 后续同一个 `sessionId` 的任务，都进入同一条队列
- 不同 `sessionId` 会走到不同 lane 里

这就把并发控制的作用域收得非常明确：

> 串行是按 session 维度收口的，不是全局串行。

如果这里做成全局一条大队列，系统虽然也“不会并发冲突”，但所有 session 都会互相阻塞，吞吐量会立刻掉下来。那就不是我们想要的网关模型了。

---

### `Lane` 内部结构：队列 + running 标记

真正负责串行消费的是内部 `Lane`：

```java
private final class Lane {

    private final ConcurrentLinkedQueue<LaneTask<?>> queue = new ConcurrentLinkedQueue<>();
    private final AtomicBoolean running = new AtomicBoolean(false);
}
```

这里只有两个关键部件：

1. `queue`
   负责把同一个 session 的任务按进入顺序排起来

2. `running`
   负责保证同一时刻只有一个任务消费循环在跑

每次新任务进来时，`enqueue()` 会先放进队列，然后尝试 `drain()`：

- 如果这条 lane 当前没人跑，自己就启动消费
- 如果已经有人在跑，只把任务排进队列，等待前一个任务结束

这就是 5.8 的核心。

我们没有在这里上锁一大段业务代码，也没有让 handler 自己拿锁。  
我们把“顺序保证”收进一个专门的结构里，让上层只关心提交任务。

这比在 `chat.send`、`session.close`、状态切换逻辑里到处散落同步控制要清楚得多。

---

### 为什么任务失败以后，lane 还要继续工作

这一节还有一个很关键但很容易被忽略的点：

```java
private Mono<Void> execute() {
    return Mono.defer(taskSupplier)
            .doOnSuccess(sink::success)
            .doOnError(sink::error)
            .onErrorResume(ignored -> Mono.empty())
            .then();
}
```

这里的重点是：

> 当前任务可以失败，但 lane 不能因为前一个任务失败就整体停摆。

如果你不把这个点处理掉，会出现一种很糟糕的情况：

- 第一个任务报错
- 串行通道直接中断
- 后面同一个 session 的所有任务全部卡死

这在教学和工程上都很差。

因为一个请求失败，应该只影响这个请求本身，而不应该顺手把整个 session 的执行能力一起带走。

所以当前实现的做法是：

- 错误仍然会返回给当前提交者
- 但 lane 自己会吞掉这个失败信号，继续处理后面的排队任务

这一步正好对应了我们在测试里锁的第三条规则：

> 前一个任务失败，不得毒化后续队列。

---

### 5.8 的测试，到底锁住了什么

这一节我先写的是 [`SessionLaneTest`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/session/SessionLaneTest.java)。

它只锁三件事，但这三件事已经足够定义当前 `SessionLane` 的最小语义：

1. 同一个 session 下两个任务必须串行
2. 不同 session 下的任务可以并行
3. 前一个任务失败以后，后一个任务仍然能继续执行

注意这里我们没有急着测试：

- `chat.send` 是否已经接到 lane
- WebSocket 是否已经完整回推事件
- 状态机和 lane 是否已经完全串起来

因为这些都不是 5.8 这一节要解决的问题。

5.8 的教学目标只有一个：

> 把“session 维度的并发控制模型”独立建出来。

只要这个模型已经独立成立，后面的 `chat.send` 主链路就有地方挂了。

---

### 学完 5.8，你要真正记住什么

这一节最重要的不是记住某个 Reactor API，而是记住下面三句话：

1. `SessionStateMachine` 解决的是“能不能做”
2. `SessionLane` 解决的是“同一个 session 上先后怎么做”
3. 并发控制必须按 session 维度收口，不能做成全局串行，也不能散在各个 handler 里临时判断

只要这三点站住，后面的 5.9 就非常自然了。

因为 5.9 终于可以开始回答这条主链路：

> `chat.send` 进来以后，  
> 它要怎么经过状态检查、进入 session lane、调用 LLM，再把事件推回客户端？

也就是说：

- 5.7 解决“状态是否合法”
- 5.8 解决“执行顺序怎么守住”
- 5.9 才开始把这两层真正接进完整数据流

这样的课程节奏对学生是友好的。  
每一节只解决一个关键问题，不会一下把 handler、状态机、并发控制、流式输出全搅在一起。

---

### 验证命令

本节新增代码的定向验证命令：

```bash
./mvnw.cmd -Dtest=SessionLaneTest test
./mvnw.cmd "-Dtest=SessionLaneTest,SessionStateMachineTest,GatewayWebSocketHandlerTest" test
```

这次实现里，这两组测试已经通过，说明 5.8 当前的最小目标已经成立：

- 同 session 串行
- 跨 session 并行
- 错误不毒化后续排队任务

---

### 本节小结

- 5.8 没有急着去写 `chat.send`
- 我们先补上了 `SessionLane`
- 它把同一个 session 的任务收进一条串行执行通道
- 它允许不同 session 之间继续并行
- 它保证单个任务失败不会把整条 lane 毒死

到这里为止，Gateway 已经具备了两层非常关键的运行时约束：

- `SessionStateMachine` 负责合法性
- `SessionLane` 负责顺序性

下一节开始，我们才能真正把 `chat.send` 这条端到端主链路接起来。
