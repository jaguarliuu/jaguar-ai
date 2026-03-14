---
title: "第4.3节：HTTP 客户端基础 - 理解 OpenAI 兼容协议"
summary: "理解 OpenAI 兼容协议，并为 MiniClaw 搭建底层 HTTP 客户端骨架。"
slug: http-client
date: 2026-03-14
tags:
  - course
  - miniclaw
  - http
order: 3
status: published
---

> **学习目标**：理解 OpenAI 兼容协议，从零构建 HTTP 客户端
> **预计时长**：25 分钟
> **难度**：入门

### 前置知识检查

**你应该已经掌握**：
- [x] 4.2 接口和数据模型已创建
- [ ] HTTP 基本概念

**如果你不确定**：
- HTTP 不熟悉 → 本节会边讲边写

---

### 核心问题：为什么一个接口能对接多个 LLM？

你可能好奇：我们要对接 DeepSeek、OpenAI、通义千问、Ollama，每个 API 都不一样，怎么用一个接口搞定？

**答案**：它们都实现了 **OpenAI 兼容协议**。

---

### 什么是 OpenAI 兼容协议？

#### 真实场景

假设你要对接 4 个 LLM：

**没有兼容协议**：
```java
// 需要写 4 个不同的客户端
public class OpenAiClient {
    public Response call(Request req) {
        // POST https://api.openai.com/v1/chat/completions
        // 特殊的请求格式
    }
}

public class DeepSeekClient {
    public Response call(Request req) {
        // POST https://api.deepseek.com/chat/completions
        // 另一种格式
    }
}

public class QwenClient {
    public Response call(Request req) {
        // POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation
        // 又一种格式
    }
}

// ... 业务代码要判断用哪个客户端
```

**有兼容协议**：
```java
// 只需要一个客户端
public class OpenAiCompatibleLlmClient {
    public Response call(Request req, String endpoint) {
        // 只需要换 endpoint
        // POST {endpoint}/chat/completions
        // 统一的请求格式
    }
}

// 使用
client.call(request, "https://api.openai.com");
client.call(request, "https://api.deepseek.com");
client.call(request, "http://localhost:11434/v1");  // Ollama
```

#### 为什么会出现兼容协议？

**历史背景**：
1. OpenAI 是最早的 LLM API 提供商
2. 大量应用已经对接了 OpenAI API
3. 其他厂商为了降低迁移成本，**直接复用 OpenAI 的 API 格式**

**结果**：
- DeepSeek：完全兼容 OpenAI API
- 通义千问：提供 OpenAI 兼容模式
- Ollama：本地运行，也兼容 OpenAI API
- Claude：部分兼容

**这就是为什么我们只需要实现一个客户端**。

---

### OpenAI API 的核心格式

**请求端点**：
```
POST {endpoint}/chat/completions
```

**请求头**：
```
Authorization: Bearer sk-xxx
Content-Type: application/json
```

**请求体**：
```json
{
  "model": "deepseek-chat",
  "messages": [
    {"role": "system", "content": "你是一个有帮助的助手"},
    {"role": "user", "content": "你好"}
  ],
  "temperature": 0.7,
  "max_tokens": 2048
}
```

**响应体**：
```json
{
  "id": "chatcmpl-xxx",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "你好！有什么可以帮助你的？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

**关键发现**：
- 端点路径一样：`/chat/completions`
- 请求格式一样：`{model, messages, temperature, ...}`
- 响应格式一样：`{choices, usage, ...}`

**只有 3 个变量**：
1. `endpoint`：API 地址
2. `apiKey`：认证密钥
3. `model`：模型名称

---

### 第一步：添加依赖 - 为什么用 WebFlux？

**1.1 可选方案对比**

| 方案 | 同步调用 | 流式调用 | 非阻塞 | 推荐度 |
|------|----------|----------|--------|--------|
| RestTemplate | ✅ | ❌ | ❌ | 不推荐（已维护模式） |
| HttpClient | ✅ | ⚠️ 复杂 | ✅ | 可用 |
| OkHttp | ✅ | ⚠️ 复杂 | ✅ | 可用 |
| **WebClient** | ✅ | ✅ | ✅ | **推荐** |

**为什么选 WebClient？**

1. **流式输出必须**：RestTemplate 无法处理 SSE 流
2. **原生响应式**：Flux/Mono 天然支持流式
3. **Spring 官方推荐**：RestTemplate 已进入维护模式
4. **统一 API**：同步和流式用同一个客户端

**1.2 添加依赖**

在 `backend/pom.xml` 的 `<dependencies>` 中添加：

```xml
<!-- WebClient：响应式 HTTP 客户端 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

**1.3 刷新 Maven**

```bash
cd backend
./mvnw clean compile
```

看到 `BUILD SUCCESS` 就对了。

---

### 第二步：创建客户端骨架 - 为什么这样设计？

**2.1 创建类**

在 `llm/` 包下创建 `OpenAiCompatibleLlmClient.java`：

```java
package com.miniclaw.llm;

import com.miniclaw.config.LlmProperties;
import com.miniclaw.llm.model.LlmChunk;
import com.miniclaw.llm.model.LlmRequest;
import com.miniclaw.llm.model.LlmResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

/**
 * OpenAI 兼容的 LLM 客户端
 * 
 * 支持所有实现了 OpenAI API 协议的 LLM：
 * - OpenAI（原生）
 * - DeepSeek（完全兼容）
 * - 通义千问（OpenAI 兼容模式）
 * - Ollama（本地运行，兼容 OpenAI API）
 */
@Slf4j
@Component
public class OpenAiCompatibleLlmClient implements LlmClient {

    private final WebClient webClient;
    private final LlmProperties properties;

    public OpenAiCompatibleLlmClient(LlmProperties properties) {
        this.properties = properties;
        this.webClient = buildWebClient(properties.getEndpoint(), properties.getApiKey());
    }
}
```

**2.2 为什么注入 LlmProperties？**

**不推荐**：
```java
// ❌ 硬编码配置
public OpenAiCompatibleLlmClient() {
    this.webClient = WebClient.builder()
        .baseUrl("https://api.deepseek.com")  // 硬编码
        .defaultHeader("Authorization", "Bearer sk-xxx")  // 硬编码
        .build();
}
```

**推荐**：
```java
// ✅ 配置注入
public OpenAiCompatibleLlmClient(LlmProperties properties) {
    this.properties = properties;
    this.webClient = buildWebClient(properties.getEndpoint(), properties.getApiKey());
}
```

**原因**：
- 可以通过 `application.yml` 配置
- 可以在不同环境使用不同配置
- 敏感信息（API Key）不用写在代码里

---

### 第三步：构建 WebClient - 为什么这样配置？

**3.1 实现 buildWebClient 方法**

```java
private WebClient buildWebClient(String endpoint, String apiKey) {
    return WebClient.builder()
            .baseUrl(endpoint)
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .defaultHeader("Content-Type", "application/json")
            .build();
}
```

**3.2 为什么需要这些配置？**

**`.baseUrl(endpoint)`**：
```java
// 设置基础 URL，后续只需要写路径
webClient.post().uri("/chat/completions")  // 实际请求 {endpoint}/chat/completions
```

**`.defaultHeader("Authorization", "Bearer " + apiKey)`**：
```
// OpenAI API 要求 Bearer Token 认证
Authorization: Bearer sk-xxx
```

等价于 curl：
```bash
curl -H "Authorization: Bearer sk-xxx" ...
```

**`.defaultHeader("Content-Type", "application/json")`**：
```
// 告诉服务器我们发送的是 JSON
Content-Type: application/json
```

**为什么用 `defaultHeader` 而不是每次设置？**
```java
// ❌ 每次请求都要设置
webClient.post()
    .header("Authorization", "Bearer " + apiKey)
    .header("Content-Type", "application/json")
    ...

// ✅ 默认设置，所有请求自动带上
WebClient.builder()
    .defaultHeader("Authorization", "Bearer " + apiKey)
    .defaultHeader("Content-Type", "application/json")
    .build()
```

---

### 第四步：实现接口方法（占位）

**4.1 添加接口方法**

```java
@Override
public LlmResponse chat(LlmRequest request) {
    // TODO: 4.4 节实现
    throw new UnsupportedOperationException("4.4 节实现");
}

@Override
public Flux<LlmChunk> stream(LlmRequest request) {
    // TODO: 4.6 节实现
    throw new UnsupportedOperationException("4.6 节实现");
}
```

**4.2 验证编译**

```bash
./mvnw clean compile
```

---

### 第五步：构建请求体 - 为什么需要转换？

**5.1 问题：我们的模型和 API 格式不一样**

**我们的模型**：
```java
LlmRequest request = LlmRequest.builder()
    .messages(List.of(Message.user("你好")))
    .temperature(0.7)
    .build();
```

**OpenAI API 需要的格式**：
```json
{
  "model": "deepseek-chat",
  "messages": [{"role": "user", "content": "你好"}],
  "temperature": 0.7
}
```

**差异**：
- 我们没有 `model` 字段（需要从配置获取）
- 我们的字段名是 `maxTokens`，API 是 `max_tokens`（下划线）

**5.2 创建转换类**

在 `OpenAiCompatibleLlmClient` 中添加内部类：

```java
/**
 * OpenAI API 请求格式
 * 
 * 为什么需要这个类？
 * - 字段名需要转换为 API 格式（maxTokens → max_tokens）
 * - 需要添加 model（从配置获取）
 * - 需要控制哪些字段序列化
 */
@Data
private static class OpenAiRequest {
    private String model;
    private List<MessageDto> messages;
    private Double temperature;
    
    @JsonProperty("max_tokens")  // 字段名映射
    private Integer maxTokens;

    public OpenAiRequest(LlmRequest request, String defaultModel) {
        // 如果请求指定了 model，用请求的；否则用默认的
        this.model = request.getModel() != null ? request.getModel() : defaultModel;
        
        // 转换消息列表
        this.messages = request.getMessages().stream()
                .map(MessageDto::new)
                .collect(Collectors.toList());
        
        this.temperature = request.getTemperature();
        this.maxTokens = request.getMaxTokens();
    }
}

/**
 * OpenAI API 消息格式
 */
@Data
private static class MessageDto {
    private String role;
    private String content;

    public MessageDto(LlmRequest.Message message) {
        this.role = message.getRole();
        this.content = message.getContent();
    }
}
```

**5.3 添加导入**

```java
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.stream.Collectors;
```

**5.4 为什么用 @JsonProperty？**

**不使用 @JsonProperty**：
```java
private Integer maxTokens;
// 序列化为：{"maxTokens": 2048}  // OpenAI API 不认识
```

**使用 @JsonProperty**：
```java
@JsonProperty("max_tokens")
private Integer maxTokens;
// 序列化为：{"max_tokens": 2048}  // OpenAI API 认识
```

---

### 第六步：验证完整流程

**6.1 创建测试**

```java
package com.miniclaw.llm;

import com.miniclaw.config.LlmProperties;
import com.miniclaw.llm.model.LlmRequest;
import com.miniclaw.llm.model.LlmRequest.Message;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

class OpenAiCompatibleLlmClientTest {

    @Test
    void testBuildRequest() throws Exception {
        // 准备配置
        LlmProperties properties = new LlmProperties();
        properties.setEndpoint("https://api.deepseek.com");
        properties.setApiKey("sk-xxx");
        properties.setModel("deepseek-chat");

        // 创建客户端
        OpenAiCompatibleLlmClient client = new OpenAiCompatibleLlmClient(properties);

        // 构建请求
        LlmRequest request = LlmRequest.builder()
                .messages(List.of(
                    Message.system("你是一个有帮助的助手"),
                    Message.user("你好")
                ))
                .temperature(0.7)
                .maxTokens(2048)
                .build();

        // 验证请求构建成功
        System.out.println("✅ 客户端创建成功");
        System.out.println("✅ 请求构建成功");
        System.out.println("✅ 接口方法占位成功");
        
        // chat() 还没实现，会抛出异常，这是预期的
        try {
            client.chat(request);
        } catch (UnsupportedOperationException e) {
            System.out.println("✅ chat() 方法将在 4.4 节实现");
        }
    }
}
```

**6.2 运行测试**

```bash
./mvnw test -Dtest=OpenAiCompatibleLlmClientTest
```

**预期输出**：
```
✅ 客户端创建成功
✅ 请求构建成功
✅ 接口方法占位成功
✅ chat() 方法将在 4.4 节实现
```

---

### 本节总结：我们解决了什么问题？

**核心问题**：如何用一个客户端对接多个 LLM？

**解决方案**：OpenAI 兼容协议

**关键设计**：
1. **配置注入**：通过 `LlmProperties` 注入 endpoint/apiKey/model
2. **WebClient**：支持同步和流式两种模式
3. **请求转换**：`OpenAiRequest` 将我们的模型转换为 API 格式
4. **字段映射**：`@JsonProperty` 处理命名差异

**学完这节，你理解了**：
- 为什么一个接口能对接多个 LLM
- 为什么用 WebClient 而不是 RestTemplate
- 为什么要注入配置而不是硬编码
- 为什么需要请求转换类

---

### 验证点

**在继续之前，确保**：

- [ ] 理解 OpenAI 兼容协议的概念
- [ ] 理解为什么用 WebClient
- [ ] WebFlux 依赖已添加
- [ ] OpenAiCompatibleLlmClient 可编译
- [ ] WebClient 已创建（带认证）
- [ ] 请求格式转换类已创建
- [ ] 测试可运行

---

### 动手实践

**任务**：完成 HTTP 客户端基础结构

**步骤**：
1. 添加 WebFlux 依赖（理解为什么）
2. 创建 OpenAiCompatibleLlmClient 类
3. 实现 WebClient 构建（理解每个配置的作用）
4. 创建请求格式转换类（理解字段映射）
5. 创建测试验证

**思考题**：
- 如果要对接 Claude（不完全兼容 OpenAI），需要怎么改？
- 如果要支持多个 endpoint 同时存在，需要怎么改？

---

### 自检：你真的掌握了吗？

**问题 1**：为什么一个客户端能对接 DeepSeek、OpenAI、Ollama？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**答案**：它们都实现了 **OpenAI 兼容协议**。

**背景**：
1. OpenAI 是最早的 LLM API 提供商
2. 大量应用已经对接了 OpenAI
3. 其他厂商为了降低迁移成本，复用了 OpenAI 的 API 格式

**结果**：
- 请求端点相同：`/chat/completions`
- 请求格式相同：`{model, messages, temperature, ...}`
- 响应格式相同：`{choices, usage, ...}`

**只有 3 个变量**：
- `endpoint`：API 地址
- `apiKey`：认证密钥
- `model`：模型名称

</details>

---

**问题 2**：为什么用 WebClient 而不是 RestTemplate？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**核心原因**：**流式输出**。

| 特性 | RestTemplate | WebClient |
|------|--------------|-----------|
| 同步调用 | ✅ | ✅ |
| 流式调用（SSE） | ❌ | ✅ |
| 非阻塞 | ❌ | ✅ |
| Spring 推荐 | 维护模式 | 推荐使用 |

**如果只用同步调用**：RestTemplate 够用。

**如果要流式输出**：必须用 WebClient（或 OkHttp/HttpClient，但更复杂）。

</details>

---

**问题 3**：为什么需要 `OpenAiRequest` 转换类？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**原因 1：字段名不匹配**

我们的模型：
```java
private Integer maxTokens;
```

OpenAI API：
```json
{"max_tokens": 2048}
```

需要 `@JsonProperty("max_tokens")` 映射。

**原因 2：需要补充字段**

我们的请求没有 `model` 字段：
```java
LlmRequest request = LlmRequest.builder()
    .messages(messages)
    .build();  // 没有 model
```

但 API 需要：
```json
{"model": "deepseek-chat", ...}
```

需要从配置补充。

**原因 3：控制序列化**

- 只序列化需要的字段
- 可以添加默认值
- 可以做格式转换

</details>

---

### 本节小结

- 我们理解了 OpenAI 兼容协议的重要性
- 关键要点：
  - 一个接口能对接多个 LLM，因为它们都兼容 OpenAI API
  - WebClient 支持同步和流式两种模式
  - 配置注入让代码更灵活
  - 请求转换类处理格式差异
- 下一节我们将实现 `chat()` 同步调用
