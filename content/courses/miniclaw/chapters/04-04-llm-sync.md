---
title: "第4.4节：同步调用实现 - 从零手写 chat() 方法"
summary: "从零实现同步 chat() 调用，打通请求发送与响应解析链路。"
slug: llm-sync
date: 2026-03-14
tags:
  - course
  - miniclaw
  - llm
order: 4
status: published
---

> **学习目标**：从零实现 LLM 同步调用，理解请求-响应的完整流程
> **预计时长**：25 分钟
> **难度**：入门

### 前置知识检查

**你应该已经掌握**：
- [x] 4.2 接口和数据模型已创建
- [x] 4.3 HTTP 客户端基础已搭建
- [ ] Jackson JSON 解析

**如果你不确定**：
- JSON 解析不熟悉 → 本节会边写边讲

---

### 核心问题：如何调用 LLM API 获取响应？

这节我们要实现 `chat()` 方法。但在此之前，先理解：

**同步调用是什么？**
```
用户发送 "你好" → 等待 2 秒 → 返回 "你好！有什么可以帮助你的？"
```

**与流式调用的对比**：
```
同步：等待 → 完整响应
流式：立即开始 → 逐字输出
```

**什么时候用同步调用？**
- 批量处理任务
- 后台定时任务
- 短文本生成（<100字）
- 不需要实时反馈的场景

---

### 第一步：理解 OpenAI API 的响应格式

**1.1 请求格式（4.3 已实现）**

```json
{
  "model": "deepseek-chat",
  "messages": [{"role": "user", "content": "你好"}],
  "temperature": 0.7
}
```

**1.2 响应格式（本节要解析）**

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepseek-chat",
  "choices": [
    {
      "index": 0,
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
- 响应在 `choices[0].message.content`
- 完成原因在 `choices[0].finish_reason`
- Token 统计在 `usage`

---

### 第二步：创建响应解析类

**2.1 为什么需要响应解析类？**

**不推荐**：
```java
// ❌ 直接解析 JSON
JsonNode root = objectMapper.readTree(response);
String content = root.get("choices").get(0).get("message").get("content").asText();
```

**问题**：
- 代码冗长
- 容易出错
- 难以维护

**推荐**：
```java
// ✅ 用类映射
OpenAiResponse response = objectMapper.readValue(json, OpenAiResponse.class);
String content = response.getContent();
```

**2.2 创建 OpenAiResponse 类**

在 `OpenAiCompatibleLlmClient` 中添加内部类：

```java
/**
 * OpenAI API 响应格式
 */
@Data
private static class OpenAiResponse {
    private List<Choice> choices;
    private Usage usage;

    /**
     * 获取响应内容
     */
    public String getContent() {
        if (choices == null || choices.isEmpty()) {
            return null;
        }
        return choices.get(0).getMessage().getContent();
    }

    /**
     * 获取完成原因
     */
    public String getFinishReason() {
        if (choices == null || choices.isEmpty()) {
            return null;
        }
        return choices.get(0).getFinishReason();
    }

    @Data
    public static class Choice {
        private Integer index;
        private Message message;
        private String finish_reason;
    }

    @Data
    public static class Message {
        private String role;
        private String content;
    }

    @Data
    public static class Usage {
        private Integer prompt_tokens;
        private Integer completion_tokens;
        private Integer total_tokens;
    }
}
```

**需要添加导入**：
```java
import lombok.Data;
import java.util.List;
```

---

### 第三步：实现 chat() 方法

**3.1 方法签名**

```java
@Override
public LlmResponse chat(LlmRequest request) {
    // 待实现
}
```

**3.2 为什么用 block()？**

WebClient 默认是响应式的（返回 Mono/Flux），但我们现在是同步调用：

```java
// 响应式（异步）
Mono<LlmResponse> mono = webClient.post()
    .bodyValue(request)
    .retrieve()
    .bodyToMono(LlmResponse.class);

// 同步（阻塞等待）
LlmResponse response = mono.block();
```

**block() 的作用**：阻塞当前线程，等待响应完成。

**3.3 完整实现**

```java
@Override
public LlmResponse chat(LlmRequest request) {
    // 1. 构建请求
    OpenAiRequest apiRequest = new OpenAiRequest(request, properties.getModel());

    // 2. 发送请求并获取响应
    OpenAiResponse apiResponse = webClient.post()
            .uri("/chat/completions")
            .bodyValue(apiRequest)
            .retrieve()
            .bodyToMono(OpenAiResponse.class)
            .timeout(Duration.ofSeconds(properties.getTimeout()))
            .block();

    // 3. 转换为我们的响应格式
    return LlmResponse.builder()
            .content(apiResponse.getContent())
            .finishReason(apiResponse.getFinishReason())
            .usage(LlmResponse.Usage.builder()
                    .promptTokens(apiResponse.getUsage().getPrompt_tokens())
                    .completionTokens(apiResponse.getUsage().getCompletion_tokens())
                    .totalTokens(apiResponse.getUsage().getTotal_tokens())
                    .build())
            .build();
}
```

**3.4 需要添加的导入**

```java
import java.time.Duration;
```

---

### 第四步：处理可能的空值

**4.1 问题：API 可能返回空响应**

**不安全的代码**：
```java
// ❌ 可能 NPE
return LlmResponse.builder()
    .content(apiResponse.getContent())  // 可能 null
    .usage(apiResponse.getUsage())       // 可能 null
    .build();
```

**安全的代码**：
```java
// ✅ 空值安全
if (apiResponse == null || apiResponse.getChoices() == null) {
    throw new RuntimeException("LLM API returned empty response");
}

return LlmResponse.builder()
        .content(apiResponse.getContent() != null ? apiResponse.getContent() : "")
        .finishReason(apiResponse.getFinishReason())
        .usage(apiResponse.getUsage() != null ? LlmResponse.Usage.builder()
                .promptTokens(apiResponse.getUsage().getPrompt_tokens())
                .completionTokens(apiResponse.getUsage().getCompletion_tokens())
                .totalTokens(apiResponse.getUsage().getTotal_tokens())
                .build() : null)
        .build();
```

---

### 第五步：验证编译

```bash
cd backend
./mvnw clean compile
```

看到 `BUILD SUCCESS` 就对了。

---

### 第六步：创建测试

**6.1 创建测试类**

```java
package com.miniclaw.llm;

import com.miniclaw.config.LlmProperties;
import com.miniclaw.llm.model.LlmRequest;
import com.miniclaw.llm.model.LlmRequest.Message;
import com.miniclaw.llm.model.LlmResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

class OpenAiCompatibleLlmClientChatTest {

    @Test
    void testChat() {
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
                    Message.system("你是一个有帮助的助手"),
                    Message.user("请用一句话介绍 Spring Boot")
                ))
                .temperature(0.7)
                .build();

        // 调用同步接口
        LlmResponse response = client.chat(request);

        // 验证响应
        System.out.println("响应内容：" + response.getContent());
        System.out.println("完成原因：" + response.getFinishReason());
        System.out.println("Token 统计：" + response.getUsage().getTotalTokens());

        assert response.getContent() != null;
        assert "stop".equals(response.getFinishReason());
        assert response.getUsage() != null;

        System.out.println("\n✅ 测试通过！");
    }
}
```

**6.2 运行测试**

```bash
./mvnw test -Dtest=OpenAiCompatibleLlmClientChatTest
```

**预期输出**：
```
响应内容：Spring Boot 是一个简化 Spring 应用开发的框架...
完成原因：stop
Token 统计：45

✅ 测试通过！
```

---

### 本节总结：我们解决了什么问题？

**核心问题**：如何调用 LLM API 获取完整响应？

**解决方案**：
1. 创建响应解析类（`OpenAiResponse`）
2. 使用 WebClient 发送 POST 请求
3. 用 `block()` 同步等待响应
4. 转换为我们的 `LlmResponse` 格式

**关键设计**：
- **响应解析类**：类型安全，易于维护
- **block()**：将响应式转为同步
- **空值处理**：避免 NPE

**学完这节，你理解了**：
- 同步调用的完整流程
- 为什么需要响应解析类
- block() 的作用和适用场景
- 如何处理空值

---

### 验证点

**在继续之前，确保**：

- [ ] OpenAiResponse 类已创建
- [ ] chat() 方法已实现
- [ ] 编译通过
- [ ] 测试通过（能成功调用 DeepSeek API）

**如果遇到问题**：
1. 401 Unauthorized → 检查 API Key
2. 连接超时 → 检查网络和 endpoint
3. 响应解析失败 → 检查 OpenAiResponse 字段名

---

### 动手实践

**任务**：实现同步调用

**步骤**：
1. 创建 OpenAiResponse 解析类
2. 实现 chat() 方法
3. 处理空值
4. 创建测试验证
5. 观察响应内容

**思考题**：
- 如果要添加超时控制，应该怎么做？
- 如果 API 返回错误（4xx/5xx），应该如何处理？

---

### 自检：你真的掌握了吗？

**问题 1**：为什么用 block() 而不是直接返回 Mono？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**因为我们的接口定义是同步的**：

```java
// 接口定义
LlmResponse chat(LlmRequest request);  // 同步，直接返回结果

// 如果不 block
Mono<LlmResponse> chat(LlmRequest request);  // 异步，返回 Mono
```

**block() 的作用**：
- 阻塞当前线程
- 等待响应完成
- 返回实际结果

**适用场景**：
- 同步接口：必须用 block()
- 流式接口：不能 block()，返回 Flux

</details>

---

**问题 2**：为什么需要 OpenAiResponse 解析类？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**不推荐直接解析**：
```java
// ❌ 冗长、易错
JsonNode root = objectMapper.readTree(response);
String content = root.get("choices").get(0).get("message").get("content").asText();
```

**推荐用类映射**：
```java
// ✅ 类型安全、简洁
OpenAiResponse response = objectMapper.readValue(json, OpenAiResponse.class);
String content = response.getContent();
```

**好处**：
1. **类型安全**：编译期检查
2. **易于维护**：字段名修改只改一处
3. **可读性好**：`getContent()` 比 `get("content")` 更清晰
4. **IDE 支持**：自动补全、重构

</details>

---

**问题 3**：finish_reason 有哪些可能的值？分别是什么意思？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**常见的 finish_reason**：

| 值 | 含义 | 说明 |
|----|------|------|
| `stop` | 正常完成 | 模型完整回复了 |
| `length` | 达到长度限制 | 超过 max_tokens |
| `content_filter` | 内容过滤 | 触发安全策略 |
| `tool_calls` | 工具调用 | 模型要调用工具（第7章） |

**处理建议**：
- `stop`：正常处理
- `length`：提示用户继续或增加 max_tokens
- `content_filter`：提示用户修改问题
- `tool_calls`：执行工具调用

</details>

---

### 本节小结

- 我们实现了 LLM 同步调用的完整流程
- 关键要点：
  - 响应解析类让代码更安全、更易维护
  - block() 将响应式转为同步
  - 需要处理空值避免 NPE
  - finish_reason 表示调用结果状态
- 下一节我们将学习 SSE 协议，为流式输出做准备
