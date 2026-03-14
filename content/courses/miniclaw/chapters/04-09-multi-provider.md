---
title: "第4.9节：多模型适配 - 让一个客户端支持多个 LLM"
summary: "抽象多模型适配层，让一个客户端支持多个 LLM 提供商。"
slug: multi-provider
date: 2026-03-14
tags:
  - course
  - miniclaw
  - providers
order: 9
status: published
---

> **学习目标**：理解如何配置和切换多个 LLM 提供商
> **预计时长**：20 分钟
> **难度**：进阶

### 前置知识检查

**你应该已经掌握**：
- [x] 4.3 HTTP 客户端基础（OpenAI 兼容协议）
- [x] 4.4 同步调用实现
- [ ] YAML 配置

**如果你不确定**：
- YAML 配置不熟悉 → 本节会边讲边说明

---

### 核心问题：如何支持多个 LLM 提供商？

**真实场景**：

```
开发环境：用 Ollama（本地，免费）
测试环境：用 DeepSeek（便宜）
生产环境：用 GPT-4（质量高）
```

**问题**：
- 每个环境都要改代码？
- 能不能通过配置切换？

**回顾：4.3 讲过的 OpenAI 兼容协议**

因为 OpenAI、DeepSeek、Ollama 都使用相同的 API 格式，所以：
- 只需要一个客户端类
- 只需要换 `endpoint`、`apiKey`、`model`

---

### 第一步：配置文件设计

**1.1 单个 Provider 配置（当前）**

```yaml
llm:
  endpoint: https://api.deepseek.com
  api-key: sk-xxx
  model: deepseek-chat
  temperature: 0.7
  timeout: 60
```

**问题**：只能配置一个 LLM

**1.2 多个 Provider 配置（目标）**

```yaml
llm:
  # 默认使用的 Provider（格式：providerId:modelName）
  default-model: deepseek:deepseek-chat
  
  # Provider 列表
  providers:
    # DeepSeek（云服务，便宜）
    - id: deepseek
      endpoint: https://api.deepseek.com
      api-key: sk-xxx
      models:
        - deepseek-chat
        - deepseek-coder
    
    # OpenAI（云服务，质量高）
    - id: openai
      endpoint: https://api.openai.com
      api-key: sk-yyy
      models:
        - gpt-4
        - gpt-4-turbo
        - gpt-3.5-turbo
    
    # Ollama（本地运行，免费）
    - id: ollama
      endpoint: http://localhost:11434/v1
      api-key: ""  # Ollama 不需要
      models:
        - llama3
        - mistral
```

**好处**：
- 配置清晰，易于管理
- 可以随时切换默认模型
- 可以在代码中指定使用哪个 Provider

---

### 第二步：扩展 LlmProperties

**2.1 创建 Provider 配置类**

在 `config/` 包下创建 `LlmProviderConfig.java`：

```java
package com.miniclaw.config;

import lombok.Data;
import java.util.List;

/**
 * LLM Provider 配置
 */
@Data
public class LlmProviderConfig {
    
    /**
     * Provider 唯一标识
     */
    private String id;
    
    /**
     * API 端点
     */
    private String endpoint;
    
    /**
     * API Key
     */
    private String apiKey;
    
    /**
     * 支持的模型列表
     */
    private List<String> models;
}
```

**2.2 扩展 LlmProperties**

```java
package com.miniclaw.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * LLM 配置属性
 */
@Data
@Component
@ConfigurationProperties(prefix = "llm")
public class LlmProperties {

    // ==================== 旧字段（向后兼容）====================
    
    private String endpoint = "https://api.deepseek.com";
    private String apiKey;
    private String model = "deepseek-chat";
    private Double temperature = 0.7;
    private Integer maxTokens = 2048;
    private Integer timeout = 60;
    private Integer maxRetries = 3;

    // ==================== 新字段（多 Provider）====================
    
    /**
     * 默认模型（格式：providerId:modelName）
     * 例如：deepseek:deepseek-chat
     */
    private String defaultModel;
    
    /**
     * Provider 列表
     */
    private List<LlmProviderConfig> providers = new ArrayList<>();
    
    // ==================== 辅助方法 ====================
    
    /**
     * 获取指定 Provider
     */
    public LlmProviderConfig getProvider(String id) {
        if (id == null || providers == null) {
            return null;
        }
        return providers.stream()
                .filter(p -> id.equals(p.getId()))
                .findFirst()
                .orElse(null);
    }
    
    /**
     * 获取默认 Provider ID
     */
    public String getDefaultProviderId() {
        if (defaultModel == null || !defaultModel.contains(":")) {
            return null;
        }
        return defaultModel.split(":")[0];
    }
    
    /**
     * 获取默认模型名称
     */
    public String getDefaultModelName() {
        if (defaultModel == null || !defaultModel.contains(":")) {
            return model;  // 向后兼容旧配置
        }
        return defaultModel.split(":")[1];
    }
}
```

---

### 第三步：扩展 LlmRequest

**3.1 添加 providerId 字段**

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LlmRequest {
    
    private List<Message> messages;
    private String model;
    private Double temperature;
    private Integer maxTokens;
    
    // ==================== 新增字段 ====================
    
    /**
     * 指定使用的 Provider ID
     * 如果为空，使用默认 Provider
     */
    private String providerId;
    
    // ... 其他字段
}
```

---

### 第四步：重构 OpenAiCompatibleLlmClient

**4.1 支持多 WebClient**

```java
@Slf4j
@Component
public class OpenAiCompatibleLlmClient implements LlmClient {

    private final LlmProperties properties;
    
    /**
     * 多个 WebClient 缓存（每个 Provider 一个）
     */
    private final ConcurrentHashMap<String, WebClient> clientCache = new ConcurrentHashMap<>();

    public OpenAiCompatibleLlmClient(LlmProperties properties) {
        this.properties = properties;
        
        // 初始化所有已配置的 Provider 的 WebClient
        if (properties.getProviders() != null) {
            for (LlmProviderConfig provider : properties.getProviders()) {
                if (provider.getEndpoint() != null && !provider.getEndpoint().isBlank()) {
                    String endpoint = normalizeEndpoint(provider.getEndpoint());
                    clientCache.put(provider.getId(), buildWebClient(endpoint, provider.getApiKey()));
                    log.info("LLM Client initialized: id={}, endpoint={}", provider.getId(), endpoint);
                }
            }
        }
        
        // 向后兼容：如果没有 providers 但有旧配置
        if (clientCache.isEmpty() && properties.getEndpoint() != null) {
            String endpoint = normalizeEndpoint(properties.getEndpoint());
            clientCache.put("__default__", buildWebClient(endpoint, properties.getApiKey()));
            log.info("LLM Client initialized (legacy): endpoint={}", endpoint);
        }
    }
    
    /**
     * 解析请求对应的 WebClient
     */
    private WebClient resolveClient(LlmRequest request) {
        // 1. 优先使用请求中指定的 providerId
        String providerId = request.getProviderId();
        if (providerId != null && !providerId.isBlank()) {
            WebClient client = clientCache.get(providerId);
            if (client != null) {
                return client;
            }
            log.warn("No WebClient for providerId={}, falling back to default", providerId);
        }
        
        // 2. 使用默认 Provider
        String defaultProviderId = properties.getDefaultProviderId();
        if (defaultProviderId != null) {
            WebClient client = clientCache.get(defaultProviderId);
            if (client != null) {
                return client;
            }
        }
        
        // 3. 兜底：使用 __default__ 或第一个可用的
        WebClient client = clientCache.get("__default__");
        if (client != null) {
            return client;
        }
        
        if (!clientCache.isEmpty()) {
            return clientCache.values().iterator().next();
        }
        
        throw new IllegalStateException("No LLM client configured");
    }
    
    /**
     * 规范化 endpoint 路径
     */
    private String normalizeEndpoint(String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            return "http://localhost:11434/v1";
        }
        // 移除末尾斜杠
        endpoint = endpoint.replaceAll("/+$", "");
        // 如果已经有 /v1，不重复添加
        if (endpoint.matches(".*?/v\\d+$")) {
            return endpoint;
        }
        return endpoint + "/v1";
    }
    
    // ... 其他方法
}
```

**4.2 修改 doChat() 使用 resolveClient()**

```java
private LlmResponse doChat(LlmRequest request) {
    OpenAiRequest apiRequest = new OpenAiRequest(request, properties.getDefaultModelName());
    
    // 使用 resolveClient 获取对应的 WebClient
    WebClient webClient = resolveClient(request);
    
    OpenAiResponse response = webClient.post()
            .uri("/chat/completions")
            .bodyValue(apiRequest)
            .retrieve()
            .bodyToMono(OpenAiResponse.class)
            .timeout(Duration.ofSeconds(properties.getTimeout()))
            .block();
    
    // ... 其余代码不变
}
```

---

### 第五步：验证编译

```bash
cd backend
./mvnw clean compile
```

---

### 第六步：创建测试

**6.1 测试多 Provider 配置**

```java
package com.miniclaw.llm;

import com.miniclaw.config.LlmProperties;
import com.miniclaw.config.LlmProviderConfig;
import com.miniclaw.llm.model.LlmRequest;
import com.miniclaw.llm.model.LlmRequest.Message;
import com.miniclaw.llm.model.LlmResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OpenAiCompatibleLlmClientMultiProviderTest {

    @Test
    void testMultiProviderConfig() {
        // 准备多 Provider 配置
        LlmProperties properties = new LlmProperties();
        properties.setDefaultModel("deepseek:deepseek-chat");
        properties.setProviders(List.of(
            LlmProviderConfig.builder()
                .id("deepseek")
                .endpoint("https://api.deepseek.com")
                .apiKey("sk-xxx")
                .models(List.of("deepseek-chat", "deepseek-coder"))
                .build(),
            LlmProviderConfig.builder()
                .id("ollama")
                .endpoint("http://localhost:11434")
                .apiKey("")
                .models(List.of("llama3", "mistral"))
                .build()
        ));
        properties.setTimeout(60);
        properties.setMaxRetries(2);

        // 创建客户端
        OpenAiCompatibleLlmClient client = new OpenAiCompatibleLlmClient(properties);

        // 测试使用默认 Provider
        LlmRequest request1 = LlmRequest.builder()
                .messages(List.of(Message.user("你好")))
                .build();

        LlmResponse response1 = client.chat(request1);
        assertNotNull(response1.getContent());
        System.out.println("默认 Provider 响应：" + response1.getContent());

        // 测试指定 Provider
        LlmRequest request2 = LlmRequest.builder()
                .providerId("deepseek")  // 指定使用 deepseek
                .messages(List.of(Message.user("你好")))
                .build();

        LlmResponse response2 = client.chat(request2);
        assertNotNull(response2.getContent());
        System.out.println("指定 deepseek 响应：" + response2.getContent());

        System.out.println("✅ 多 Provider 测试通过！");
    }

    @Test
    void testBackwardCompatibility() {
        // 测试旧配置格式的向后兼容
        LlmProperties properties = new LlmProperties();
        properties.setEndpoint("https://api.deepseek.com");
        properties.setApiKey("sk-xxx");
        properties.setModel("deepseek-chat");
        properties.setTimeout(60);

        OpenAiCompatibleLlmClient client = new OpenAiCompatibleLlmClient(properties);

        LlmRequest request = LlmRequest.builder()
                .messages(List.of(Message.user("你好")))
                .build();

        LlmResponse response = client.chat(request);
        assertNotNull(response.getContent());

        System.out.println("✅ 向后兼容测试通过！");
    }
}
```

---

### 本节总结：我们解决了什么问题？

**核心问题**：如何支持多个 LLM 提供商？

**解决方案**：
1. **配置文件**：多 Provider 配置，清晰的格式
2. **LlmProperties**：支持多 Provider，向后兼容旧配置
3. **WebClient 缓存**：每个 Provider 一个 WebClient
4. **resolveClient()**：根据请求动态选择 WebClient
5. **向后兼容**：旧配置格式仍然可用

**关键设计**：
- `defaultModel` 格式：`providerId:modelName`
- `providerId` 字段：请求中指定 Provider
- `clientCache`：避免重复创建 WebClient

**学完这节，你理解了**：
- 多 Provider 的配置方式
- 如何动态选择 WebClient
- 向后兼容的重要性

---

### 验证点

**在继续之前，确保**：

- [ ] LlmProviderConfig 类已创建
- [ ] LlmProperties 已扩展
- [ ] LlmRequest 已添加 providerId
- [ ] OpenAiCompatibleLlmClient 支持多 WebClient
- [ ] resolveClient() 方法已实现
- [ ] 编译通过

---

### 动手实践

**任务**：实现多模型适配

**步骤**：
1. 创建 LlmProviderConfig 类
2. 扩展 LlmProperties
3. 添加 providerId 到 LlmRequest
4. 重构 OpenAiCompatibleLlmClient
5. 测试多 Provider 配置

**思考题**：
- 如何支持运行时动态添加 Provider？
- 如何实现 Provider 的健康检查？

---

### 自检：你真的掌握了吗？

**问题 1**：为什么用 `ConcurrentHashMap` 缓存 WebClient？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**线程安全**：

1. **多线程访问**：多个请求可能同时调用 `resolveClient()`
2. **并发读写**：初始化时写入，运行时读取
3. **性能**：ConcurrentHashMap 比同步的 HashMap 性能更好

**为什么不用 HashMap**：
```java
// ❌ 非线程安全
private Map<String, WebClient> clientCache = new HashMap<>();

// ✅ 线程安全
private ConcurrentHashMap<String, WebClient> clientCache = new ConcurrentHashMap<>();
```

</details>

---

**问题 2**：`defaultModel: deepseek:deepseek-chat` 格式的好处是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**格式**：`providerId:modelName`

**好处**：

1. **明确指定**：一眼看出用哪个 Provider 的哪个模型
2. **避免冲突**：不同 Provider 可能有同名模型
3. **易于切换**：改一行配置就切换默认模型

**对比只用 modelName**：
```
❌ model: gpt-4  // 不知道是哪个 Provider
✅ default-model: openai:gpt-4  // 明确是 OpenAI 的 GPT-4
```

**示例**：
```yaml
default-model: deepseek:deepseek-chat  # 默认用 DeepSeek
# default-model: openai:gpt-4  # 切换到 OpenAI 只需改这一行
```

</details>

---

**问题 3**：如何实现向后兼容？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**向后兼容策略**：

1. **保留旧字段**：`endpoint`、`apiKey`、`model` 不删除
2. **默认值处理**：如果新字段为空，使用旧字段
3. **兜底 WebClient**：创建 `__default__` WebClient

**代码实现**：
```java
// 向后兼容：如果没有 providers 但有旧配置
if (clientCache.isEmpty() && properties.getEndpoint() != null) {
    String endpoint = normalizeEndpoint(properties.getEndpoint());
    clientCache.put("__default__", buildWebClient(endpoint, properties.getApiKey()));
}

// 默认模型名：优先用新格式，否则用旧字段
public String getDefaultModelName() {
    if (defaultModel == null || !defaultModel.contains(":")) {
        return model;  // 向后兼容
    }
    return defaultModel.split(":")[1];
}
```

**好处**：
- 用户不需要立即修改配置
- 平滑升级，不破坏现有功能

</details>

---

### 本节小结

- 我们实现了多模型适配功能
- 关键要点：
  - 配置文件支持多 Provider
  - WebClient 缓存避免重复创建
  - 向后兼容保证平滑升级
  - `providerId:modelName` 格式明确指定
- 下一节我们将实现多模态支持
