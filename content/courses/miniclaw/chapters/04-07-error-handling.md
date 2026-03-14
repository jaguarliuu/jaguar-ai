---
title: "第4.7节：结构化异常 - 先把失败说明白"
summary: "在 LLM Client 层先建立错误分类与统一异常契约，为下一节的重试机制打底。"
slug: error-handling
date: 2026-03-14
tags:
  - course
  - miniclaw
  - reliability
  - error-handling
order: 7
status: published
---

> **学习目标**：先把失败语义收口，让 `OpenAiCompatibleLlmClient` 永远以一致的方式对外失败
> **预计时长**：18 分钟
> **难度**：进阶

### 这一节只讲“失败怎么表达”

这一节先不讲重试策略，也不讲背压、熔断、provider fallback 这些更高层能力。

我们只解决一个更基础的问题：

> 当模型调用失败时，客户端应该怎样把失败翻译成一个稳定、可理解、可判断的异常对象？

如果这件事没有做好，后面所有“自动恢复”都会变成瞎猜。

---

### 为什么要先讲异常，再讲重试

很多初学者一想到可靠性，第一反应就是多试几次：

```java
while (retryCount <= maxRetries) {
    try {
        return doChat(request);
    } catch (Exception e) {
        Thread.sleep(1000);
    }
}
```

这个写法最大的问题不是丑，而是它把所有失败都混成了同一种失败。

但真实系统里，不同错误的处理方式完全不同：

- `400`：请求参数有问题，不该重试
- `401` / `403`：认证或权限错误，不该重试
- `404`：模型名或接口地址错了，不该重试
- `429`：被限流了，通常应该重试
- `5xx`：服务端暂时出问题，通常应该重试
- 网络抖动 / 超时：通常也属于可恢复错误

所以正确顺序是：

1. 先把错误分类
2. 再把分类结果塞进统一异常对象
3. 最后才根据异常对象决定是否重试

这一节做前两步，下一节再做第三步。

---

### 第一步：定义错误分类

这次我们新增了 `LlmErrorType`：

```java
public enum LlmErrorType {
    BAD_REQUEST,
    AUTHENTICATION,
    PERMISSION_DENIED,
    NOT_FOUND,
    RATE_LIMIT,
    SERVER_ERROR,
    TIMEOUT,
    NETWORK,
    INVALID_RESPONSE,
    UNKNOWN
}
```

这组枚举不是为了“看起来规范”，而是为了把错误从字符串世界拉回到类型世界。

有了它之后：

- 上层不需要再匹配 `"401 Unauthorized"` 这种文本
- 日志、告警、监控可以按错误类型聚合
- 后面的重试逻辑可以明确写成“只重试 `RATE_LIMIT` / `TIMEOUT` / `SERVER_ERROR` / `NETWORK`”

这里有一个细节要记住：

> `retryable` 的判断依赖错误类型，但错误类型本身不等于“已经开始重试”。

也就是说，`RATE_LIMIT` 是“具备重试资格”，不是“系统一定会替你重试”。真正的重试机制放到下一节完成。

---

### 第二步：定义统一异常契约

分类有了，接下来要把分类结果装进一个统一异常对象里。

这次新增的是 `LlmException`：

```java
public class LlmException extends RuntimeException {

    private final LlmErrorType errorType;
    private final boolean retryable;
    private final Integer httpStatus;

    // constructors + getters
}
```

这个类最重要的不是它继承了 `RuntimeException`，而是它把上层最关心的三件事固定下来了：

1. 这是什么错误
   - `errorType`
2. 这个错误有没有重试资格
   - `retryable`
3. 如果它来自 HTTP 响应，状态码是多少
   - `httpStatus`

这样做以后，上层拿到的就不再是零散的底层异常：

- `"Connection reset"`
- `"401 Unauthorized"`
- `"Read timed out"`

而是一个统一的 `LlmException`。

这一层统一之后，后面做重试、熔断、fallback、指标统计，才有共同语言。

---

### 第三步：先把 HTTP 错误翻译对

现在我们不再让 `WebClient.retrieve()` 自动抛一堆通用异常，再在外层猜它到底出了什么问题，而是直接在响应进入客户端时完成语义转换。

同步请求里：

```java
private Mono<String> readChatBody(ClientResponse response) {
    if (response.statusCode().isError()) {
        return response.bodyToMono(String.class)
                .defaultIfEmpty("")
                .flatMap(body -> Mono.error(toHttpException(response.statusCode(), body)));
    }
    return response.bodyToMono(String.class);
}
```

流式请求里：

```java
private Flux<String> readStreamBody(ClientResponse response) {
    if (response.statusCode().isError()) {
        return response.bodyToMono(String.class)
                .defaultIfEmpty("")
                .flatMapMany(body -> Flux.error(toHttpException(response.statusCode(), body)));
    }
    return response.bodyToFlux(String.class);
}
```

真正的映射逻辑集中在 `toHttpException()`：

```java
private LlmException toHttpException(HttpStatusCode status, String responseBody) {
    int statusCode = status.value();
    String detail = extractErrorMessage(responseBody);

    return switch (statusCode) {
        case 400 -> new LlmException(LlmErrorType.BAD_REQUEST, false, statusCode,
                "LLM request was rejected: " + detail);
        case 401 -> new LlmException(LlmErrorType.AUTHENTICATION, false, statusCode,
                "LLM authentication failed: " + detail);
        case 403 -> new LlmException(LlmErrorType.PERMISSION_DENIED, false, statusCode,
                "LLM request was forbidden: " + detail);
        case 404 -> new LlmException(LlmErrorType.NOT_FOUND, false, statusCode,
                "LLM endpoint or model was not found: " + detail);
        case 408 -> new LlmException(LlmErrorType.TIMEOUT, true, statusCode,
                "LLM request timed out: " + detail);
        case 429 -> new LlmException(LlmErrorType.RATE_LIMIT, true, statusCode,
                "LLM rate limit exceeded: " + detail);
        default -> {
            boolean retryable = statusCode >= 500;
            yield new LlmException(
                    retryable ? LlmErrorType.SERVER_ERROR : LlmErrorType.UNKNOWN,
                    retryable,
                    statusCode,
                    "LLM request failed with HTTP " + statusCode + ": " + detail
            );
        }
    };
}
```

这样一来，HTTP 层的职责就很清楚了：

- 读取响应
- 提取错误详情
- 映射为客户端自己的错误语义

而不是把第三方接口的原始异常直接甩给上层。

#### Java 新特性补充 1：`switch` 表达式

如果你目前主要写 Java8，这段代码里最陌生的通常是：

```java
return switch (statusCode) {
    case 400 -> ...
    case 401 -> ...
    default -> ...
};
```

你可以先把它理解成“更适合返回值的 `switch`”。

Java8 的写法通常是：

```java
switch (statusCode) {
    case 400:
        return ...;
    case 401:
        return ...;
    default:
        return ...;
}
```

两者表达的是同一件事，只是新写法更紧凑，尤其适合这种“根据状态码返回不同异常对象”的场景。

---

### 第四步：把非 HTTP 失败也统一收口

只处理 HTTP 状态码还不够，因为很多失败连响应都拿不到，比如：

- 建连失败
- 连接被重置
- Socket 超时
- `timeout()` 触发
- DNS 或代理异常

所以客户端还需要一个总入口，把“各种形状的 Throwable”再收口成 `LlmException`。这就是 `asLlmException()`：

```java
private LlmException asLlmException(Throwable throwable) {
    Throwable failure = Exceptions.unwrap(throwable);
    if (failure instanceof LlmException llmException) {
        return llmException;
    }

    if (failure instanceof WebClientRequestException requestException) {
        if (hasCause(requestException, TimeoutException.class)
                || hasCause(requestException, SocketTimeoutException.class)) {
            return new LlmException(LlmErrorType.TIMEOUT, true, null,
                    "LLM request timed out", requestException);
        }

        return new LlmException(LlmErrorType.NETWORK, true, null,
                "LLM network request failed: " + rootMessage(requestException), requestException);
    }

    if (failure instanceof TimeoutException || failure instanceof SocketTimeoutException) {
        return new LlmException(LlmErrorType.TIMEOUT, true, null,
                "LLM request timed out", failure);
    }

    return new LlmException(LlmErrorType.UNKNOWN, false, null,
            "LLM request failed: " + rootMessage(failure), failure);
}
```

这里有两个值得你刻意理解的点。

#### 1. `Exceptions.unwrap(...)` 是在“拆掉 Reactor 的包装壳”

响应式链路里，原始异常有时会被 Reactor 包上一层再往外抛。

`Exceptions.unwrap(throwable)` 的作用就是：

> 先把这些包装拆掉，尽量拿到真正导致失败的那个异常

这样后面的错误分类才不会被“外壳”误导。

#### 2. `instanceof` 模式匹配是 Java 新语法

这行代码：

```java
if (failure instanceof LlmException llmException) {
    return llmException;
}
```

如果你是 Java8 读者，先把它翻译回老写法：

```java
if (failure instanceof LlmException) {
    LlmException llmException = (LlmException) failure;
    return llmException;
}
```

也就是说，新语法只是把“判断类型”和“强转后起变量名”合并成了一步，本质并没有变。

---

### 到这里，客户端已经获得了什么

做到这里，`OpenAiCompatibleLlmClient` 已经拿到了一个稳定的失败语义层：

- `chat()` 和 `stream()` 都对外暴露 `LlmException`
- HTTP 错误、网络错误、超时错误都能被统一分类
- 是否具备重试资格不再靠字符串猜测
- 上层只需要围绕 `errorType`、`retryable`、`httpStatus` 做判断

注意，这里我们仍然只是把“失败说明白”。

真正把 `retryable = true` 变成自动恢复策略，要到下一节才开始。

---

### 这一节该怎么验证

本节最关键的验证点不是“有没有多试几次”，而是“失败有没有被翻译对”。

你至少要能回答下面几个问题：

- `401` 最终会被映射成什么错误类型
- `503` 为什么应该被标记成可重试
- 网络抖动和超时为什么不能继续裸抛底层异常
- 为什么 `chat()` 和 `stream()` 必须共享同一套异常语义

这也是后面可靠性测试能成立的前提。

---

### 本节小结

- 可靠性的第一步不是重试，而是错误分类
- `LlmErrorType` 让错误进入类型系统
- `LlmException` 让上层拥有稳定的失败契约
- `toHttpException()` 负责翻译 HTTP 错误
- `asLlmException()` 负责把非 HTTP 失败也统一收口

下一节我们再在这个基础上，接入真正的响应式重试、指数退避和 jitter。
