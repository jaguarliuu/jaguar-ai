---
title: "第5.5节：RpcRouter，把 request 分发给正确的处理器"
summary: "在 WebSocket 入口、连接模型和协议帧都定下来以后，再补上 RpcRouter 和 handler SPI，让 Gateway 真正知道每条 request 该交给谁处理。"
slug: rpc-router
date: 2026-03-19
tags:
  - course
  - miniclaw
  - gateway
  - rpc
order: 5
status: published
---

> **学习目标**：理解为什么 `GatewayWebSocketHandler` 不应该直接承接所有业务逻辑，以及 `RpcRouter + RpcHandler` 这一层到底解决了什么问题。
> **预计时长**：15 分钟
> **难度**：入门

---

### 5.4 做完以后，Gateway 还是没有真正“分发”请求

前面几节我们已经把三件基础工作做好了：

- `/ws` 已经挂起来了
- `connection` 和 `session` 已经分层
- `request / event / completed / error` 四类协议帧已经定下来了

但这时还有一个非常现实的问题没有解决：

> `GatewayWebSocketHandler` 收到一条 `request` 以后，到底该把它交给谁？

如果这一步不单独抽出来，最容易发生的事情就是把所有逻辑都塞回 `handle(...)` 里：

- 先判断 `method`
- 再判断是不是 `session.create`
- 再判断是不是 `chat.send`
- 再决定走哪条业务分支

短期能跑，长期一定会乱。

因为从这一步开始，Gateway 就不再只是“接住文本帧”的入口了，它开始承担真正的业务分发职责。只要把分发和业务处理混在一起，后面你继续加：

- `session.get`
- `session.close`
- `chat.send`
- 事件推送
- 状态机校验

这些东西都会一层层堆回 `GatewayWebSocketHandler`。

所以 5.5 这一节的核心，不是多写一个类，而是先做一个非常关键的工程判断：

> WebSocket handler 负责接流量，RpcRouter 负责分发方法，具体业务处理再交给独立 handler。

---

### 为什么这里一定要先加一层 Router

`GatewayWebSocketHandler` 的天然职责其实很窄：

- 接住连接
- 接住文本帧
- 管理连接生命周期
- 在断连时做清理

它不应该自己知道：

- `session.create` 该怎么处理
- `chat.send` 该怎么处理
- 后面新的 `method` 该怎么接入

因为这些都属于“路由和业务处理”问题，不属于“WebSocket 生命周期”问题。

所以我们在这一节里单独补上：

- `RpcRouter`
- `RpcHandler`
- `SessionHandler`
- `ChatHandler`

注意这里有一个很重要的边界：

`SessionHandler` 和 `ChatHandler` 在这一节里先是 **handler 角色接口**，不是完整业务实现。

这不是没做完，而是故意控制章节范围。

因为 5.5 这一节真正要锁住的是：

1. Gateway 以后通过哪一层做方法分发
2. 处理器以后通过什么 SPI 接入 Router
3. unknown method 应该如何稳定落到协议错误帧

把这三个点先钉住，后面的 5.6、5.7、5.8 才有统一挂载点。

---

### `RpcHandler`：先抽一个最小处理器接口

这一节先定义一个非常小的 SPI：

```java
public interface RpcHandler {

    List<String> supportedMethods();

    Object handle(String connectionId, RpcRequestFrame request);
}
```

这里故意只保留两个动作：

1. `supportedMethods()`
   说明自己能处理哪些 `method`

2. `handle(...)`
   真正接住 Router 分发进来的请求

这个接口看起来很小，但它的意义很大。

它把“一个 handler 该如何接入 Gateway”这件事固定下来了。

以后不管是：

- `SessionHandler`
- `ChatHandler`
- 还是后续别的 `method`

都必须回答同一组问题：

- 你支持哪些方法？
- Router 把请求交给你以后，你怎么处理？

这就避免了后面每加一个能力，就重新发明一套接入方式。

在当前实现里，`SessionHandler` 和 `ChatHandler` 只是进一步把处理器角色命名清楚：

```java
public interface SessionHandler extends RpcHandler {
}

public interface ChatHandler extends RpcHandler {
}
```

这一步的价值不在于增加功能，而在于先把角色边界命名清楚。

---

### `RpcRouter`：method 到 handler 的最小分发表

有了 handler SPI，下一步就可以把 Router 立起来了。

当前实现非常克制：

```java
@Component
public class RpcRouter {

    private final Map<String, RpcHandler> handlersByMethod;

    public RpcRouter(List<RpcHandler> handlers) {
        this.handlersByMethod = handlers.stream()
                .flatMap(handler -> handler.supportedMethods().stream()
                        .map(method -> Map.entry(method, handler)))
                .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    public Object route(String connectionId, RpcRequestFrame request) {
        RpcHandler handler = handlersByMethod.get(request.getMethod());
        if (handler == null) {
            return RpcErrorFrame.of(
                    request.getRequestId(),
                    request.getSessionId(),
                    "METHOD_NOT_FOUND",
                    "Unknown method: " + request.getMethod()
            );
        }

        return handler.handle(connectionId, request);
    }
}
```

这里最关键的是两件事。

第一件事，Router 不自己处理业务。

它只负责：

- 根据 `method` 查找 handler
- 找到就转发
- 找不到就返回协议错误帧

第二件事，unknown method 的失败路径也被统一进协议里了。

不是抛一个随意异常，不是让 WebSocket handler 自己拼错误 JSON，而是直接返回：

```text
type = error
code = METHOD_NOT_FOUND
```

这就意味着从 5.5 开始，方法分发的成功路径和失败路径都有统一出口了。

---

### 为什么 `route(...)` 现在返回的是 `Object`

你可能会觉得这一步有点怪：

```java
public Object route(String connectionId, RpcRequestFrame request)
```

为什么不一开始就把返回值设计得很“完美”？

原因很简单：

这一节只需要支撑两类结果：

- 正常处理结果，例如 `RpcCompletedFrame`
- 协议错误结果，例如 `RpcErrorFrame`

而 5.6 以后还会出现：

- `RpcEventFrame`
- 更完整的流式结果
- 出站事件总线

也就是说，这里的返回值抽象还没到最终形态。

所以当前最小实现先用 `Object`，目的不是追求优雅，而是先把这节课真正要固定的行为锁住：

- 能路由
- 能转发
- 能稳定返回协议错误

等 5.6、5.7 继续往上长的时候，再决定是否要把这里进一步收束成统一结果类型。

这是一种很典型的工程取舍：

> 先把本节真正需要的行为固定，再让抽象随着后续能力自然收敛。

---

### 这一节的测试，真正锁住了什么

这次我先写的不是实现，而是测试：

```text
RpcRouterTest
```

它锁住了三件事：

1. `session.create` 必须路由到 session handler
2. `chat.send` 必须路由到 chat handler
3. unknown method 必须返回 `METHOD_NOT_FOUND`

测试本身不依赖真实业务处理逻辑，而是用最小 recording handler 先把“路由语义”钉住。

这很重要。

因为 5.5 这一节要验证的不是：

- session 真的创建成功了没有
- chat 真的开始流式输出了没有

这些属于后面章节。

5.5 真正要验证的是：

> Router 这一层的职责是否已经成立。

如果这层职责不先锁住，后面你无论接 EventBus、状态机还是 `chat.send -> LlmClient.stream()`，都会缺一个稳定入口。

---

### 学完 5.5，你真正要记住什么

这一节最重要的，不是记住类名，而是记住下面四个判断：

1. `GatewayWebSocketHandler` 不应该自己承接所有业务逻辑。
2. `RpcRouter` 的职责是“按 method 分发”，不是“自己处理业务”。
3. `RpcHandler` SPI 的意义，是把后续能力的接入方式先统一下来。
4. unknown method 不是随意报错，而是要稳定落到协议错误帧。

只要这四个点站稳，后面的章节就会顺很多。

因为从这一步开始，Gateway 终于不只是“收消息”，而是开始具备真正的“统一分发入口”。

---

### 验证命令

本节新增代码的定向验证命令：

```bash
./mvnw.cmd -Dtest=RpcRouterTest test
```

我这次实现里，这组测试已经通过，说明 5.5 的最小目标已经成立：

- `session.create` 能被分发到 session handler
- `chat.send` 能被分发到 chat handler
- unknown method 能被稳定映射成协议错误帧

---

### 本节小结

- 5.5 没有急着把业务逻辑塞回 `GatewayWebSocketHandler`
- 我们先补上了 `RpcRouter`
- 我们先定义了 `RpcHandler` 这一层 handler SPI
- `SessionHandler` 和 `ChatHandler` 当前先作为角色接口存在
- Router 已经能把不同 `method` 分发给不同 handler
- unknown method 已经能稳定回落到 `METHOD_NOT_FOUND`

下一节开始，我们才继续往前推进：

> 既然 Router 已经能把请求分发给 handler，  
> 那 handler 处理过程中产生的事件，应该通过什么方式统一推回 WebSocket 客户端？
