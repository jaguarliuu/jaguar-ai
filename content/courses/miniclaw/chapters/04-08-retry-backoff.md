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

### 先看重试是接到哪里的

这一节我们不做“代码讲评”，直接按真正写代码的顺序往下走。

目标非常明确：

> 先把重试入口接上，再把重试规则一行一行补进去。

---

### 第一步：先在调用点留出重试入口

我们已经有了上一节的异常收口能力，所以现在先不要急着写 `Retry.backoff(...)`。

第一步更简单：先决定重试要挂在哪里。

先看 `chat()`：

```java
private Mono<LlmResponse> executeChat(LlmRequest request) {
    Mono<LlmResponse> pipeline = webClient.post()
            .uri("/chat/completions")
            .bodyValue(apiRequest)
            .exchangeToMono(this::readChatBody)
            .timeout(Duration.ofSeconds(properties.getTimeout()))
            .map(this::parseResponse)
            .onErrorMap(this::asLlmException);

    return applyRetry(pipeline, "chat");
}
```

这里你先只做一件事：

- 把“原始请求流水线”保存到 `pipeline`
- 在最后一行新增 `applyRetry(pipeline, "chat")`

再看 `stream()`：

```java
Flux<LlmChunk> pipeline = webClient.post()
        .uri("/chat/completions")
        .bodyValue(apiRequest)
        .accept(MediaType.TEXT_EVENT_STREAM)
        .exchangeToFlux(this::readStreamBody)
        .timeout(Duration.ofSeconds(properties.getTimeout()))
        .filter(line -> !line.isBlank())
        .flatMap(this::parseSseChunk)
        .onErrorMap(this::asLlmException);

return applyRetry(pipeline, "stream");
```

做到这里，你先建立一个直觉：

- `pipeline` 代表“还没接重试之前的请求链路”
- `applyRetry(...)` 代表“在最后统一补上一层重试能力”

这一步还不需要知道重试规则细节，只需要先把接入点卡准。

---

### 第二步：先把 `applyRetry(...)` 建出来，哪怕先什么都不做

调用点已经有了，下一步就是把 `applyRetry(...)` 这个方法先建出来。

一开始你甚至可以先写最朴素的版本：

```java
private <T> Mono<T> applyRetry(Mono<T> pipeline, String operation) {
    return pipeline;
}

private <T> Flux<T> applyRetry(Flux<T> pipeline, String operation) {
    return pipeline;
}
```

这个版本什么都不做，但它有一个很重要的价值：

> 先把“重试入口”这层抽象立住。

也就是说，从现在开始：

- `chat()` 不直接关心重试实现细节
- `stream()` 也不直接关心重试实现细节
- 两条链路统一交给 `applyRetry(...)`

课程里这样写，读者更容易理解我们是在“先搭骨架，再填实现”。

---

### 第三步：先补一个最小判断，支持“关闭重试”

骨架已经有了，先不要立刻写 `retryWhen(...)`。

我们先补一个最小判断：

```java
private <T> Mono<T> applyRetry(Mono<T> pipeline, String operation) {
    if (maxRetries() <= 0) {
        return pipeline;
    }
    return pipeline;
}

private <T> Flux<T> applyRetry(Flux<T> pipeline, String operation) {
    if (maxRetries() <= 0) {
        return pipeline;
    }
    return pipeline;
}
```

这一步的意义很简单：

- 如果配置里把重试次数设成 `0`
- 客户端就直接走原始链路
- 后面即使补上 `retryWhen(...)`，这里也已经有了清晰边界

课程里按这个顺序写，读者更容易接受，因为每一步都只新增一个很小的能力。

---

### 第四步：现在再接上 `retryWhen(...)`

骨架有了，现在再把真正逻辑补进去：

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

这时很多 Java8 同学会冒出一个疑问：

> 为什么返回值后面还能继续挂方法？这是不是 AOP？

这里一定要当场解释清楚：

> 这不是 AOP。  
> 这只是普通的 Java 链式调用，因为 `pipeline` 本身就是一个 `Mono` 或 `Flux` 对象。

最普通的类比是：

```java
String result = " hello ".trim().toUpperCase();
```

这里没有任何 AOP，只是：

1. `trim()` 返回了一个新的 `String`
2. 返回值仍然是对象
3. 所以你可以继续调用 `.toUpperCase()`

Reactor 完全一样。

比如：

- `timeout(...)` 返回一个新的 `Mono`
- `map(...)` 返回一个新的 `Mono`
- `onErrorMap(...)` 返回一个新的 `Mono`
- `retryWhen(...)` 也返回一个新的 `Mono`

如果你把这一行展开来看：

```java
Mono<T> retried = pipeline.retryWhen(buildRetrySpec(operation));
return retried;
```

就不神秘了。

这里不是“框架偷偷织入逻辑”，而是：

> 你拿着一个 `Mono` 对象，显式调用它的实例方法，得到一个带重试能力的新 `Mono`。

---

### 第五步：先把 `buildRetrySpec(...)` 写到最小可用

现在 `applyRetry(...)` 已经有了：

```java
return pipeline.retryWhen(buildRetrySpec(operation));
```

所以下一个问题自然变成：

> `buildRetrySpec(operation)` 到底先返回什么？

先不要一口气把整段实现写满，先写到最小可用：

```java
private RetryBackoffSpec buildRetrySpec(String operation) {
    return Retry.backoff(maxRetries(), Duration.ofMillis(minBackoffMillis()));
}
```

这一行先完成两件事：

- 指定最多重试几次
- 指定最小退避时间从哪里开始

也就是说，到这里你已经不是“没有重试”，而是已经有了一版最基础的指数退避重试。

---

### 第六步：继续往后补 `.maxBackoff(...)`

有了最小版本之后，下一行自然就是给指数退避加上限：

```java
private RetryBackoffSpec buildRetrySpec(String operation) {
    return Retry.backoff(maxRetries(), Duration.ofMillis(minBackoffMillis()))
            .maxBackoff(Duration.ofMillis(maxBackoffMillis()));
}
```

为什么这一步要紧跟在 `Retry.backoff(...)` 后面？

因为你刚刚引入了“指数增长”，那马上就要回答另一个问题：

> 最多允许它增长到哪里？

这就是课程里“写一行，解释这一行解决了什么问题”的节奏。

---

### 第七步：再补 `.jitter(...)`

上限有了，下一步补随机扰动：

```java
private RetryBackoffSpec buildRetrySpec(String operation) {
    return Retry.backoff(maxRetries(), Duration.ofMillis(minBackoffMillis()))
            .maxBackoff(Duration.ofMillis(maxBackoffMillis()))
            .jitter(RETRY_JITTER);
}
```

这一步先不用讲太深，先让学生知道：

- 指数退避解决“节奏越来越慢”
- `jitter` 解决“别让所有请求同一时刻一起重试”

先把代码接上，后面再展开讲原理。

---

### 第八步：补 `.filter(...)`，只重试该重试的错误

现在再补上最关键的一行：

```java
private RetryBackoffSpec buildRetrySpec(String operation) {
    return Retry.backoff(maxRetries(), Duration.ofMillis(minBackoffMillis()))
            .maxBackoff(Duration.ofMillis(maxBackoffMillis()))
            .jitter(RETRY_JITTER)
            .filter(this::isRetryableFailure);
}
```

到这里，重试机制才真正和上一节的 `LlmException.retryable` 连上。

也就是说：

- `401`、`403`、`400` 不会进入重试
- `429`、`TIMEOUT`、`NETWORK`、`SERVER_ERROR` 才有资格重试

这一步写完，整个设计才真正闭环。

---

### 第九步：补日志回调和“重试耗尽”处理

最后再把观察性和失败出口补齐：

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

到这里，`buildRetrySpec(...)` 才算真正写完。

你会发现整段代码不是一上来就“背下来”的，而是按下面顺序自然长出来的：

1. 先有接入点
2. 再有空骨架
3. 再有关闭重试的边界
4. 再接上 `retryWhen(...)`
5. 再从 `Retry.backoff(...)` 开始一行一行补规则

这才是更像真实开发、也更像真实课堂的顺序。

---

### 现在再回头看完整的 `buildRetrySpec(...)`

前面是一行一行长出来的过程。现在代码补齐了，我们再把完整版本放在一起看：

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

这时再回头看整条链，整体感就很清楚了：

- `pipeline` 是原始请求流水线
- `applyRetry(...)` 是统一接入点
- `buildRetrySpec(...)` 是具体的重试规则
- `retryWhen(...)` 负责把规则挂到流水线上

如果翻译成更命令式的心智模型，大致就是：

```java
RetryPolicy retryPolicy = buildRetryPolicy(operation);
return runWithRetry(pipeline, retryPolicy);
```

也就是说，`buildRetrySpec(...)` 不是“已经开始重试”。

它真正做的是：

> 先定义一份规则，然后把规则交给 `retryWhen(...)` 使用。

到这一步，再进入逐行拆解，读者就不会觉得自己是在背 API 了。

---

### 再逐行拆解这段重试规则

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

### 为什么一定要同时接到 `chat()` 和 `stream()`

如果重试只服务 `chat()`，那这个客户端仍然是不完整的。

现在你回头再看前面的 `executeChat()` 和 `stream()` 就会更清楚：

- 两条链路都会先产出自己的 `pipeline`
- 两条链路最后都会走 `applyRetry(...)`
- 两条链路共用同一个 `buildRetrySpec(...)`

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
