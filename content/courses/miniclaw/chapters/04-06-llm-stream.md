---
title: "第4.6节：流式输出实现 - 手把手实现 stream() 方法"
summary: "手把手实现 stream() 方法，让客户端支持 LLM 流式返回。"
slug: llm-stream
date: 2026-03-14
tags:
  - course
  - miniclaw
  - streaming
order: 6
status: published
---

> **学习目标**：从零实现 LLM 流式调用，理解 SSE 数据流的处理
> **预计时长**：30 分钟
> **难度**：进阶

### 前置知识检查

**你应该已经掌握**：
- [x] 4.3 HTTP 客户端基础
- [x] 4.4 同步调用实现
- [x] 4.5 SSE 协议原理
- [ ] Reactor Flux 基础

**如果你不确定**：
- Flux 不熟悉 → 本节会边写边讲

---

### 为什么这节很重要？

流式输出是现代 AI 应用的标配。用户不想等待完整响应，而是希望看到**逐字输出**的效果。

**学完本节，你将能够**：
- 实现 stream() 方法
- 处理 SSE 数据流
- 累积增量内容
- 返回 `Flux<LlmChunk>`

---

### 流式 vs 同步对比

**同步调用（4.4 节）**：
```
用户发送 → 等待 3 秒 → 完整响应显示
```

**流式调用（本节）**：
```
用户发送 → 立即开始 → 逐字显示 → 完成标记
```

**用户体验差异**：
- 同步：用户等待时不知道发生了什么
- 流式：用户看到"正在思考"，体验更好

---

### 第一步：设置 stream=true

**1.1 修改请求构建方法**

在 `OpenAiCompatibleLlmClient.java` 中，找到 `OpenAiRequest` 内部类：

```java
@Data
private static class OpenAiRequest {
    private String model;
    private List<MessageDto> messages;
    private Double temperature;
    private Integer max_tokens;
    private Boolean stream;

    public OpenAiRequest(LlmRequest request, String defaultModel, boolean stream) {
        this.model = request.getModel() != null ? request.getModel() : defaultModel;
        this.messages = request.getMessages().stream()
                .map(MessageDto::new)
                .collect(Collectors.toList());
        this.temperature = request.getTemperature();
        this.max_tokens = request.getMaxTokens();
        this.stream = stream;  // 新增参数
    }
}
```

**1.2 更新 chat() 方法调用**

```java
@Override
public LlmResponse chat(LlmRequest request) {
    OpenAiRequest apiRequest = new OpenAiRequest(request, properties.getModel(), false);
    // ... 其余代码不变
}
```

---

### 第二步：实现 stream() 方法骨架

**2.1 添加必要的导入**

```java
import org.springframework.http.MediaType;
import java.time.Duration;
```

**2.2 实现 stream() 方法**

```java
@Override
public Flux<LlmChunk> stream(LlmRequest request) {
    OpenAiRequest apiRequest = new OpenAiRequest(request, properties.getModel(), true);

    return webClient.post()
            .uri("/chat/completions")
            .bodyValue(apiRequest)
            .accept(MediaType.TEXT_EVENT_STREAM)  // 关键：告诉服务器返回 SSE
            .retrieve()
            .bodyToFlux(String.class)  // 每行是一个 SSE 事件
            .timeout(Duration.ofSeconds(properties.getTimeout()))
            .filter(line -> !line.isBlank())  // 过滤空行
            .flatMap(this::parseSseChunk)  // 解析每一行
            .doOnError(e -> log.error("Stream error", e));
}
```

**此时会报错**：`parseSseChunk` 方法未定义。继续。

---

### 第三步：解析 SSE 数据块

**3.1 实现 parseSseChunk 方法**

```java
/**
 * 解析 SSE 数据块
 */
private Flux<LlmChunk> parseSseChunk(String line) {
    // 提取 data: 后面的内容
    String data = line;
    if (line.startsWith("data:")) {
        data = line.substring(5).trim();
    }

    // 处理 [DONE] 信号
    if (data.equals("[DONE]") || data.isEmpty()) {
        return Flux.just(LlmChunk.builder().done(true).build());
    }

    try {
        // 解析 JSON
        JsonNode root = objectMapper.readTree(data);
        JsonNode choices = root.get("choices");

        if (choices == null || choices.isEmpty()) {
            return Flux.empty();
        }

        JsonNode firstChoice = choices.get(0);
        JsonNode delta = firstChoice.get("delta");
        JsonNode finishReasonNode = firstChoice.get("finish_reason");

        // 提取内容
        String content = null;
        if (delta != null && delta.has("content") && !delta.get("content").isNull()) {
            content = delta.get("content").asText();
        }

        // 提取 finish_reason
        String finishReason = null;
        if (finishReasonNode != null && !finishReasonNode.isNull()) {
            finishReason = finishReasonNode.asText();
        }

        boolean isDone = finishReason != null;

        // 构建 chunk
        LlmChunk chunk = LlmChunk.builder()
                .delta(content)
                .finishReason(finishReason)
                .done(isDone)
                .build();

        // 如果没有内容且不是结束，跳过
        if (content == null && !isDone) {
            return Flux.empty();
        }

        return Flux.just(chunk);

    } catch (Exception e) {
        log.warn("Failed to parse SSE chunk: {}", data, e);
        return Flux.empty();
    }
}
```

**3.2 添加必要的导入**

```java
import com.fasterxml.jackson.databind.JsonNode;
```

**3.3 添加 objectMapper 字段**

在类中添加：

```java
private final ObjectMapper objectMapper = new ObjectMapper();
```

---

### 第四步：验证编译

```bash
cd backend
./mvnw clean compile
```

看到 `BUILD SUCCESS` 就对了。

---

### 第五步：创建测试

**5.1 创建测试类**

```java
package com.miniclaw.llm;

import com.miniclaw.config.LlmProperties;
import com.miniclaw.llm.model.LlmChunk;
import com.miniclaw.llm.model.LlmRequest;
import com.miniclaw.llm.model.LlmRequest.Message;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

import java.util.List;

class OpenAiCompatibleLlmClientStreamTest {

    @Test
    void testStream() {
        // 准备配置
        LlmProperties properties = new LlmProperties();
        properties.setEndpoint("https://api.deepseek.com");
        properties.setApiKey("sk-xxx");  // 替换为你的 API Key
        properties.setModel("deepseek-chat");
        properties.setTimeout(60);

        // 创建客户端
        OpenAiCompatibleLlmClient client = new OpenAiCompatibleLlmClient(properties);

        // 构建请求
        LlmRequest request = LlmRequest.builder()
                .messages(List.of(
                    Message.user("请用一句话介绍 Spring Boot")
                ))
                .build();

        // 调用流式接口
        Flux<LlmChunk> stream = client.stream(request);

        // 订阅并打印每个 chunk
        stream
            .doOnNext(chunk -> {
                if (chunk.getDelta() != null) {
                    System.out.print(chunk.getDelta());
                }
                if (chunk.isDone()) {
                    System.out.println("\n[完成] finish_reason=" + chunk.getFinishReason());
                }
            })
            .blockLast();  // 阻塞等待完成

        System.out.println("\n测试通过！");
    }
}
```

**5.2 运行测试**

```bash
./mvnw test -Dtest=OpenAiCompatibleLlmClientStreamTest
```

**预期输出**：
```
Spring Boot 是一个简化 Spring 应用开发的框架...
[完成] finish_reason=stop

测试通过！
```

---

### 第六步：理解完整流程

**6.1 请求流程**

```
1. 用户发送 "请介绍 Spring Boot"
2. 构建请求：{model, messages, stream: true}
3. WebClient 发送 POST /chat/completions
4. Accept: text/event-stream
```

**6.2 响应流程**

```
服务器返回 SSE 流：
data: {"choices":[{"delta":{"content":"Spring"}}]}
data: {"choices":[{"delta":{"content":" Boot"}}]}
data: {"choices":[{"delta":{"content":" 是"}}]}
...
data: {"choices":[{"delta":{},"finish_reason":"stop"}]}
data: [DONE]

每个 data: 触发一次 parseSseChunk()
返回一个 LlmChunk
```

**6.3 Flux 流水线**

```java
bodyToFlux(String.class)     // 读取每行
  .filter(line -> !line.isBlank())  // 过滤空行
  .flatMap(this::parseSseChunk)     // 解析为 LlmChunk
  .doOnNext(chunk -> ...)           // 订阅者处理
```

---

### 完整代码

**OpenAiCompatibleLlmClient.java（本节新增部分）**：

```java
@Override
public Flux<LlmChunk> stream(LlmRequest request) {
    OpenAiRequest apiRequest = new OpenAiRequest(request, properties.getModel(), true);

    return webClient.post()
            .uri("/chat/completions")
            .bodyValue(apiRequest)
            .accept(MediaType.TEXT_EVENT_STREAM)
            .retrieve()
            .bodyToFlux(String.class)
            .timeout(Duration.ofSeconds(properties.getTimeout()))
            .filter(line -> !line.isBlank())
            .flatMap(this::parseSseChunk)
            .doOnError(e -> log.error("Stream error", e));
}

private Flux<LlmChunk> parseSseChunk(String line) {
    String data = line;
    if (line.startsWith("data:")) {
        data = line.substring(5).trim();
    }

    if (data.equals("[DONE]") || data.isEmpty()) {
        return Flux.just(LlmChunk.builder().done(true).build());
    }

    try {
        JsonNode root = objectMapper.readTree(data);
        JsonNode choices = root.get("choices");

        if (choices == null || choices.isEmpty()) {
            return Flux.empty();
        }

        JsonNode firstChoice = choices.get(0);
        JsonNode delta = firstChoice.get("delta");
        JsonNode finishReasonNode = firstChoice.get("finish_reason");

        String content = null;
        if (delta != null && delta.has("content") && !delta.get("content").isNull()) {
            content = delta.get("content").asText();
        }

        String finishReason = null;
        if (finishReasonNode != null && !finishReasonNode.isNull()) {
            finishReason = finishReasonNode.asText();
        }

        boolean isDone = finishReason != null;

        LlmChunk chunk = LlmChunk.builder()
                .delta(content)
                .finishReason(finishReason)
                .done(isDone)
                .build();

        if (content == null && !isDone) {
            return Flux.empty();
        }

        return Flux.just(chunk);

    } catch (Exception e) {
        log.warn("Failed to parse SSE chunk: {}", data, e);
        return Flux.empty();
    }
}
```

---

### 验证点

**在继续之前，确保**：

- [ ] stream() 方法已实现
- [ ] parseSseChunk() 方法已实现
- [ ] 编译通过
- [ ] 测试通过（能看到逐字输出）

**如果遇到问题**：
1. 编译失败 → 检查导入是否完整
2. 测试失败 → 检查 API Key 是否正确
3. 没有输出 → 检查 endpoint 和 model 配置

---

### 动手实践

**任务**：实现流式调用

**步骤**：
1. 修改 OpenAiRequest 添加 stream 参数
2. 实现 stream() 方法
3. 实现 parseSseChunk() 方法
4. 创建测试验证
5. 观察逐字输出效果

**挑战**（可选）：
- 添加 usage 统计（最后一帧包含 token 统计）
- 添加错误重试机制

---

### 自检：你真的掌握了吗？

**问题 1**：`accept(MediaType.TEXT_EVENT_STREAM)` 的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

这个设置告诉服务器：**我期望接收 SSE 格式的响应**。

**HTTP 请求头**：
```
Accept: text/event-stream
```

**服务器响应头**：
```
Content-Type: text/event-stream
```

**不设置会怎样**：
- 服务器可能返回完整的 JSON（同步模式）
- 无法接收流式数据

</details>

---

**问题 2**：为什么用 `flatMap` 而不是 `map`？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**map**：1 对 1 转换
```java
Flux<String> → map → Flux<LlmChunk>
```

**flatMap**：1 对 N 转换
```java
Flux<String> → flatMap → Flux<LlmChunk>
```

**为什么需要 flatMap**：
- `parseSseChunk()` 返回 `Flux<LlmChunk>`，不是单个 `LlmChunk`
- 有时候返回空（`Flux.empty()`），有时候返回 1 个（`Flux.just(chunk)`）
- flatMap 可以"展平"嵌套的 Flux

**对比**：
```java
// 错误：map 会产生 Flux<Flux<LlmChunk>>
.map(this::parseSseChunk)

// 正确：flatMap 展平为 Flux<LlmChunk>
.flatMap(this::parseSseChunk)
```

</details>

---

**问题 3**：`[DONE]` 信号的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

`[DONE]` 是 SSE 流的**结束标记**。

**服务器发送**：
```
data: {"choices":[...]}
data: {"choices":[...]}
data: [DONE]
```

**客户端处理**：
```java
if (data.equals("[DONE]")) {
    return Flux.just(LlmChunk.builder().done(true).build());
}
```

**作用**：
1. 告诉客户端流已结束
2. 可以关闭连接
3. 可以触发完成回调

**注意**：`finish_reason: "stop"` 和 `[DONE]` 是两回事：
- `finish_reason: "stop"`：这个对话完成了
- `[DONE]`：整个 SSE 流结束了

</details>

---

### 本节小结

- 我们实现了 LLM 流式调用的完整流程
- 关键要点：
  - `stream: true` 开启流式模式
  - `Accept: text/event-stream` 告诉服务器返回 SSE
  - `bodyToFlux(String.class)` 读取每行
  - `flatMap` 展平嵌套的 Flux
  - `[DONE]` 信号标记流结束
- 下一节我们将实现错误处理和重试机制
