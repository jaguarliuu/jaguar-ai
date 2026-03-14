---
title: "第4.8节：重试与指数退避 - 让客户端具备恢复能力"
summary: "基于统一异常契约，为 chat() 和 stream() 接入共享的响应式重试、指数退避与 jitter。"
slug: retry-backoff
date: 2026-03-14
tags:
  - course
  - miniclaw
  - reliability
  - retry
order: 8
status: published
---

> **学习目标**：把上一节的 `retryable` 真正落成自动重试策略，并看懂 `Retry.backoff(...)` 背后的设计
> **预计时长**：22 分钟
> **难度**：进阶

### 先说边界：这一节只做 Client 层重试

上一节我们解决的是“失败怎么表达”，这一节继续解决“哪些失败值得自动恢复”。

这里依然只关注 `LLM Client` 这一层：

- 不讲背压
- 不讲 provider fallback
- 不讲熔断与半开恢复
- 不讲 Agent 任务级补偿

我们只做一件事：

> 把 `retryable = true` 的异常，接入统一的响应式重试机制。

---

### 为什么不再手写 `while + Thread.sleep`

如果你来自 Java8 + 同步编程背景，最自然的重试代码大概是这样：

```java
for (int i = 0; i < maxRetries; i++) {
    try {
        return doRequest();
    } catch (Throwable error) {
        if (!isRetryable(error)) {
            throw error;
        }
        Thread.sleep(delay);
    }
}
```

这个思路本身并不荒唐，但放在当前项目里有三个明显问题：

1. `chat()` 和 `stream()` 都要各写一套
2. `Thread.sleep()` 是阻塞式等待，不适合响应式链路
3. 日志、等待时间、最终失败处理很容易写散

所以这次我们没有继续手写循环，而是把重试规则收敛成一个独立对象，再把它挂到 `Mono` / `Flux` 上。

---

### 先把 `Retry.backoff(...)` 翻译成人话

看到这段代码时，很多同学会卡住：

```java
return pipeline.retryWhen(buildRetrySpec(operation));
```

如果你只熟悉命令式代码，可以先这样翻译：

```java
RetryPolicy retryPolicy = buildRetryPolicy(operation);
return runWithRetry(pipeline, retryPolicy);
```

也就是说，`buildRetrySpec(...)` 不是“已经开始重试”。

它真正做的是：

> 先定义一份规则，然后把规则挂到响应式流水线上。

这份规则里会说明：

- 最多重试几次
- 每次等待多久
- 哪些错误允许重试
- 每次重试前做什么
- 重试耗尽后把什么异常抛出去

这就是理解 Reactor Retry 的第一把钥匙。

---

### Java8 视角看 `buildRetrySpec`

当前代码里的真实实现如下：

```java
private RetryBackoffSpec buildRetrySpec(String operation) {
    return Retry.backoff(maxRetries(), Duration.ofMillis(minBackoffMillis()))
            .maxBackoff(Duration.ofMillis(maxBackoffMillis()))
            .jitter(RETRY_JITTER)
            .filter(this::isRetryableFailure)
            .doBeforeRetry(signal -> {
                LlmException failure = asLlmException(signal.failure());
                log.warn("Retrying LLM {} request: attempt={}/{}, type={}, status={}, message={}",
                        operation,
                        signal.totalRetriesInARow() + 1,
                        maxRetries(),
                        failure.getErrorType(),
                        failure.getHttpStatus(),
                        failure.getMessage());
            })
            .onRetryExhaustedThrow((spec, signal) -> signal.failure());
}
```

如果把它拆成 Java8 更容易接受的心智模型，大致就是下面这段伪代码：

```java
RetryPolicy retryPolicy = new RetryPolicy();
retryPolicy.setMaxRetries(maxRetries());
retryPolicy.setMinBackoff(minBackoffMillis());
retryPolicy.setMaxBackoff(maxBackoffMillis());
retryPolicy.setJitter(RETRY_JITTER);
retryPolicy.setRetryablePredicate(this::isRetryableFailure);
retryPolicy.setBeforeRetryLogger(...);
retryPolicy.setExhaustedHandler(lastFailure -> lastFailure);
```

Reactor 只是把这套规则写成了链式 API，本质并没有改变。

---

### 逐行理解这段重试规则

#### 1. `Retry.backoff(...)`

```java
Retry.backoff(maxRetries(), Duration.ofMillis(minBackoffMillis()))
```

意思是：

- 最多重试 `maxRetries()` 次
- 从 `minBackoffMillis()` 开始等待
- 后续等待时间按指数退避增长

#### 2. `.maxBackoff(...)`

```java
.maxBackoff(Duration.ofMillis(maxBackoffMillis()))
```

意思是：

- 即使按指数退避不断增长，也不能超过这个上限

否则等待时间会越来越夸张，恢复价值开始下降。

#### 3. `.jitter(...)`

```java
.jitter(RETRY_JITTER)
```

当前代码里 `RETRY_JITTER = 0.2d`，可以先把它理解成：

> 在理论等待时间附近，允许有 20% 左右的随机扰动

它的目的不是“更随机更酷”，而是避免大量请求在同一个时刻齐刷刷地重试。

#### 4. `.filter(...)`

```java
.filter(this::isRetryableFailure)
```

这里的 `this::isRetryableFailure` 是方法引用，Java8 就有这个语法。

它等价于：

```java
.filter(error -> this.isRetryableFailure(error))
```

意思是：

- 只有 `retryable = true` 的错误才允许进入重试流程
- `400`、`401`、`403` 这类错误会立刻失败

#### 5. `.doBeforeRetry(...)`

```java
.doBeforeRetry(signal -> {
    LlmException failure = asLlmException(signal.failure());
    // 打日志
})
```

这里的 lambda 代表：

> 每次真正开始下一轮重试前，先执行这一段逻辑

当前实现里，我们把操作名、重试次数、错误类型、状态码和错误信息都写进日志，方便后面排查。

#### 6. `.onRetryExhaustedThrow(...)`

```java
.onRetryExhaustedThrow((spec, signal) -> signal.failure())
```

意思是：

- 如果一个错误具备重试资格
- 但重试次数已经用完
- 那就直接把最后一次失败继续抛出去

也就是说，客户端不会因为“尝试过恢复”就吞掉异常。

---

### 指数退避为什么是核心

这一节里最值得真正吃透的点，不是 API 名字，而是 **指数退避** 这个策略本身。

很多人第一次听到这个词，只会记住一句模糊的话：

> 每次失败后，下一次等久一点

这句话不算错，但不够精确。

更准确地说，指数退避指的是：

> 每轮重试前的等待时间，不是固定增加，而是按倍数增长。

最常见的时间线长这样：

```text
第 1 次重试：200ms
第 2 次重试：400ms
第 3 次重试：800ms
第 4 次重试：1600ms
第 5 次重试：3200ms
```

而当前实现又设置了上限：

```java
private Integer maxRetries = 3;
private Long retryMinBackoffMillis = 200L;
private Long retryMaxBackoffMillis = 2000L;
```

所以真实节奏更接近：

```text
200ms -> 400ms -> 800ms -> 1600ms -> 2000ms -> 2000ms
```

也就是：

- 前几轮先快速试探
- 如果还是失败，就主动把节奏拉开
- 到了上限后不再继续翻倍

---

### 为什么它比固定间隔更合适

假设上游模型服务正在抖动，1000 个客户端同时失败。

如果大家都用固定间隔：

```text
失败 -> 1 秒后集体重试
再失败 -> 1 秒后再次集体重试
```

那么服务端刚喘一口气，就会被下一波请求同时砸中。

而指数退避的思路是：

- 短暂抖动时，先快速试探恢复
- 持续失败时，主动放慢节奏

它的本质不是“慢一点更优雅”，而是：

> 对系统压力更敏感，也更愿意在高压时主动让路。

这也是为什么分布式系统、消息队列、云 SDK、网络客户端里几乎都会看到它。

---

### `jitter` 和指数退避是什么关系

这两个点经常被混在一起，其实它们负责的是两件不同的事。

**指数退避** 决定：

> 整体节奏应该越来越慢

**jitter** 决定：

> 即使节奏一致，也不要所有请求在同一毫秒一起出发

你可以把它理解成：

- 指数退避控制“队伍往前走的速度”
- jitter 控制“队伍里每个人的步点稍微错开”

两者是配套关系，不是二选一。

---

### 让 `chat()` 和 `stream()` 共用一套重试能力

如果重试只服务 `chat()`，那这个客户端仍然是不完整的。

当前实现里，`Mono` 和 `Flux` 都经过同一个入口：

```java
private <T> Mono<T> applyRetry(Mono<T> pipeline, String operation) {
    if (maxRetries() <= 0) {
        return pipeline;
    }
    return pipeline.retryWhen(buildRetrySpec(operation));
}

private <T> Flux<T> applyRetry(Flux<T> pipeline, String operation) {
    if (maxRetries() <= 0) {
        return pipeline;
    }
    return pipeline.retryWhen(buildRetrySpec(operation));
}
```

这意味着：

- `chat()` 和 `stream()` 共享同一套重试规则
- 是否重试完全由 `LlmException.retryable` 决定
- 日志格式一致
- 后续调整退避参数时，不用改两份逻辑

这就是为什么我们上一节一定要先把失败语义统一掉。

---

### 把参数外置到配置里

当前配置放在 `LlmProperties`：

```java
private Integer maxRetries = 3;
private Long retryMinBackoffMillis = 200L;
private Long retryMaxBackoffMillis = 2000L;
```

这样做有两个直接好处：

1. 开发环境和生产环境可以用不同策略
2. 以后要扩展 provider 级策略时，入口已经留好了

但要注意，目前仍然是 **全局 LLM Client 级别配置**。

这节课还没有做：

- 按 provider 配独立重试预算
- 读取 `Retry-After`
- fallback 到其他 provider
- 更高层的任务补偿

我们先把这一层打稳，不提前透支复杂度。

---

### 这次代码是怎么验证的

这次新增的测试文件是：

`OpenAiCompatibleLlmClientReliabilityTest.java`

覆盖了三个关键场景：

1. `chat()` 第一次返回 `503`，会自动重试，随后成功
2. `chat()` 返回 `401` 时不会重试，而是直接抛出 `LlmException`
3. `stream()` 第一次返回 `503`，也会走同一套重试规则，并最终吐出正常的 SSE chunk

验证命令：

```bash
./mvnw -Dtest=OpenAiCompatibleLlmClientReliabilityTest test
./mvnw test
./mvnw -DskipTests compile
```

这也对应我们在课程仓库里的维护流程：

> 先写代码，先验证，再写文档。

---

### 本节小结

- `Retry.backoff(...)` 本质上是在声明重试规则，不是在手写循环
- 指数退避负责拉开节奏，jitter 负责错开同一时刻的集中重试
- `applyRetry(...)` 让 `chat()` 和 `stream()` 共享同一套恢复能力
- `LlmProperties` 把重试策略变成可配置项
- 可靠性测试验证了“该重试的会重试，不该重试的不会重试”

下一节我们回到功能扩展，开始让一个客户端支持多个 LLM Provider。
