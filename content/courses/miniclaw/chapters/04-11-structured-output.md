---
title: "第4.11节：结构化输出 - 让 LLM 返回 JSON"
summary: "实现结构化输出能力，让 LLM 以 JSON 等固定结构返回结果。"
slug: structured-output
date: 2026-03-14
tags:
  - course
  - miniclaw
  - json
order: 11
status: published
---

> **学习目标**：理解如何让 LLM 返回结构化的 JSON 数据
> **预计时长**：25 分钟

---

### 核心问题：如何让 LLM 返回结构化数据？

**真实场景**：

```
用户：提取这篇文章的标题、作者、发布日期
LLM：这篇文章的标题是...作者是...发布日期是...
用户：我想要 JSON 格式！
LLM：好的，{"title": "...", "author": "...", "date": "..."}
用户：有时候是 "date"，有时候是 "publish_date"，不一致！
```

**问题**：
- LLM 返回自由文本，格式不稳定
- 解析困难，容易出错
- 字段名不一致

**结构化输出的解决方案**：
- 告诉 LLM 返回 JSON Schema
- LLM 严格按照 Schema 返回
- 字段名和类型都固定

---

### 对比：自由文本 vs 结构化输出

**自由文本**：
```json
{
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "提取文章信息"}]
}
```

响应：
```
这篇文章的标题是《AI Agent 实战》，作者是 Jaguar Liu，发布于 2026-03-11。
```

**结构化输出**：
```json
{
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "提取文章信息"}],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "article_info",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "title": {"type": "string"},
          "author": {"type": "string"},
          "publishDate": {"type": "string"}
        },
        "required": ["title", "author", "publishDate"]
      }
    }
  }
}
```

响应：
```json
{
  "title": "AI Agent 实战",
  "author": "Jaguar Liu",
  "publishDate": "2026-03-11"
}
```

**关键差异**：
- 自由文本：不可预测，难以解析
- 结构化输出：固定格式，直接解析

---

### 第一步：理解 JSON Schema

**1.1 什么是 JSON Schema？**

JSON Schema 是描述 JSON 数据结构的规范：

```json
{
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "age": {"type": "integer"},
    "email": {"type": "string"}
  },
  "required": ["name", "age"]
}
```

**含义**：
- 必须是对象（object）
- 有 3 个字段：name、age、email
- name 和 age 是必填，email 可选

**1.2 JSON Schema 的常用类型**

| 类型 | 说明 | 示例 |
|------|------|------|
| string | 字符串 | {"type": "string"} |
| integer | 整数 | {"type": "integer"} |
| number | 数字 | {"type": "number"} |
| boolean | 布尔 | {"type": "boolean"} |
| array | 数组 | {"type": "array", "items": {...}} |
| object | 对象 | {"type": "object", "properties": {...}} |

---

### 第二步：OpenAI 结构化输出格式

**2.1 response_format 参数**

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "response_schema",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "field1": {"type": "string"},
          "field2": {"type": "integer"}
        },
        "required": ["field1", "field2"]
      }
    }
  }
}
```

**关键字段**：
- `type: "json_schema"`：使用 JSON Schema 模式
- `strict: true`：严格模式，确保输出符合 Schema
- `schema`：JSON Schema 定义

**2.2 简化模式（json_object）**

```json
{
  "response_format": {
    "type": "json_object"
  }
}
```

**区别**：
- `json_object`：只保证返回 JSON，不保证格式
- `json_schema`：严格按照 Schema 返回

**选择建议**：
- 简单场景 → `json_object`
- 需要严格格式 → `json_schema`

---

### 第三步：创建 ResponseFormat 类

**3.1 为什么需要 ResponseFormat 类？**

**不推荐**：直接用 Map
```java
// ❌ 类型不安全
Map<String, Object> format = new HashMap<>();
format.put("type", "json_schema");
format.put("json_schema", Map.of(
    "name", "response",
    "strict", true,
    "schema", schemaMap
));
```

**推荐**：用类定义
```java
// ✅ 类型安全，IDE 支持
ResponseFormat format = ResponseFormat.jsonSchema(schema);
```

**3.2 创建 ResponseFormat 类**

在 `llm/model/` 包下创建 `ResponseFormat.java`：

```java
package com.miniclaw.llm.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * LLM 响应格式配置
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResponseFormat {

    /**
     * 格式类型：json_object 或 json_schema
     */
    private String type;

    /**
     * JSON Schema 配置（type=json_schema 时使用）
     */
    private JsonSchemaConfig json_schema;

    /**
     * 创建 json_object 格式
     */
    public static ResponseFormat jsonObject() {
        return ResponseFormat.builder()
                .type("json_object")
                .build();
    }

    /**
     * 创建 json_schema 格式
     */
    public static ResponseFormat jsonSchema(Object schema) {
        return ResponseFormat.builder()
                .type("json_schema")
                .json_schema(JsonSchemaConfig.builder()
                        .name("response")
                        .strict(true)
                        .schema(schema)
                        .build())
                .build();
    }

    /**
     * 创建 json_schema 格式（自定义名称）
     */
    public static ResponseFormat jsonSchema(String name, Object schema) {
        return ResponseFormat.builder()
                .type("json_schema")
                .json_schema(JsonSchemaConfig.builder()
                        .name(name)
                        .strict(true)
                        .schema(schema)
                        .build())
                .build();
    }

    /**
     * JSON Schema 配置
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class JsonSchemaConfig {
        private String name;
        private Boolean strict;
        private Object schema;
    }
}
```

---

### 第四步：扩展 LlmRequest

**4.1 添加 response_format 字段**

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
    private String providerId;
    
    /**
     * 响应格式（结构化输出）
     */
    private ResponseFormat responseFormat;
    
    // ... 其他代码
}
```

**4.2 修改 OpenAiRequest**

```java
@Data
private static class OpenAiRequest {
    private String model;
    private List<MessageDto> messages;
    private Double temperature;
    
    @JsonProperty("max_tokens")
    private Integer maxTokens;
    
    @JsonProperty("response_format")
    private Object responseFormat;  // 新增

    public OpenAiRequest(LlmRequest request, String defaultModel) {
        this.model = request.getModel() != null ? request.getModel() : defaultModel;
        this.messages = request.getMessages().stream()
                .map(MessageDto::new)
                .collect(Collectors.toList());
        this.temperature = request.getTemperature();
        this.maxTokens = request.getMaxTokens();
        this.responseFormat = request.getResponseFormat();  // 直接传递
    }
}
```

**需要添加导入**：
```java
import com.fasterxml.jackson.annotation.JsonProperty;
```

---

### 第五步：验证编译

```bash
cd backend
./mvnw clean compile
```

---

### 第六步：创建测试

**6.1 测试结构化输出**

在测试项目中创建：

```java
package com.miniclaw.llm;

import com.miniclaw.config.LlmProperties;
import com.miniclaw.llm.model.LlmRequest;
import com.miniclaw.llm.model.LlmRequest.Message;
import com.miniclaw.llm.model.LlmResponse;
import com.miniclaw.llm.model.ResponseFormat;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class OpenAiCompatibleLlmClientStructuredOutputTest {

    @Test
    void testJsonObjectFormat() {
        // json_object 模式（简单）
        LlmProperties properties = new LlmProperties();
        properties.setEndpoint("https://api.deepseek.com");
        properties.setApiKey("sk-xxx");
        properties.setModel("deepseek-chat");
        properties.setTimeout(60);

        OpenAiCompatibleLlmClient client = new OpenAiCompatibleLlmClient(properties);

        LlmRequest request = LlmRequest.builder()
                .messages(List.of(
                    Message.user("请用 JSON 格式返回：今天的日期是？")
                ))
                .responseFormat(ResponseFormat.jsonObject())
                .build();

        LlmResponse response = client.chat(request);
        
        assertNotNull(response.getContent());
        System.out.println("JSON 响应：" + response.getContent());
        
        // 验证是合法的 JSON
        assertTrue(response.getContent().startsWith("{"));
    }

    @Test
    void testJsonSchemaFormat() {
        // json_schema 模式（严格）
        LlmProperties properties = new LlmProperties();
        properties.setEndpoint("https://api.openai.com");
        properties.setApiKey("sk-yyy");
        properties.setModel("gpt-4-turbo");
        properties.setTimeout(60);

        OpenAiCompatibleLlmClient client = new OpenAiCompatibleLlmClient(properties);

        // 定义 JSON Schema
        Map<String, Object> schema = Map.of(
            "type", "object",
            "properties", Map.of(
                "title", Map.of("type", "string"),
                "author", Map.of("type", "string"),
                "publishDate", Map.of("type", "string")
            ),
            "required", List.of("title", "author", "publishDate")
        );

        LlmRequest request = LlmRequest.builder()
                .messages(List.of(
                    Message.user("从这段文字中提取信息：《AI Agent 实战》，作者 Jaguar Liu，2026-03-11 发布")
                ))
                .responseFormat(ResponseFormat.jsonSchema("article_info", schema))
                .build();

        LlmResponse response = client.chat(request);
        
        assertNotNull(response.getContent());
        System.out.println("结构化响应：" + response.getContent());
        
        // 验证包含必需字段
        assertTrue(response.getContent().contains("\"title\""));
        assertTrue(response.getContent().contains("\"author\""));
        assertTrue(response.getContent().contains("\"publishDate\""));
    }
}
```

**6.2 运行测试**

```bash
./mvnw test -Dtest=OpenAiCompatibleLlmClientStructuredOutputTest
```

---

### 第七步：站在学生角度审视

**检查点**：

**1. 核心问题讲清楚了吗？**
- ✅ 为什么需要结构化输出（格式不稳定的问题）
- ✅ 对比了自由文本 vs 结构化输出

**2. 每步都解释了"为什么"吗？**
- ✅ 为什么用 Object content（Jackson 自动处理）
- ✅ 为什么需要 ResponseFormat 类（类型安全）
- ✅ 为什么有 `json_object` 和 `json_schema` 两种模式

**3. 有循序渐进吗？**
- ✅ 第一步：理解 JSON Schema（基础概念）
- ✅ 第二步：OpenAI 格式（两种模式对比）
- ✅ 第三步：创建 ResponseFormat 类
- ✅ 第四步：扩展 LlmRequest
- ✅ 第五步：验证编译
- ✅ 第六步：创建测试

**4. 有验证点吗？**
- ✅ 编译验证
- ✅ 测试验证

**5. 有自检问题吗？**
- ✅ 3 道自检问题（json_object vs json_schema、为什么用 Object、JSON Schema 的作用）

**6. 代码可以直接复制使用吗？**
- ✅ 所有代码都是完整的
- ✅ 有导入说明

---

### 本节总结：我们解决了什么问题？

**核心问题**：如何让 LLM 返回结构化的 JSON 数据？

**解决方案**：
1. **JSON Schema**：定义数据结构
2. **ResponseFormat 类**：配置响应格式
3. **两种模式**：`json_object`（简单）和 `json_schema`（严格）

**关键设计**：
- `ResponseFormat.jsonObject()`：简单场景
- `ResponseFormat.jsonSchema(schema)`：严格场景
- `strict: true`：确保输出符合 Schema

**学完这节，你理解了**：
- JSON Schema 的作用
- 结构化输出的两种模式
- 如何扩展 LlmRequest 支持结构化输出

---

### 验证点

**在继续之前，确保**：

- [ ] ResponseFormat 类已创建
- [ ] LlmRequest 已添加 responseFormat 字段
- [ ] OpenAiRequest 已添加 responseFormat 序列化
- [ ] 编译通过
- [ ] 测试通过

---

### 动手实践

**任务**：实现结构化输出

**步骤**：
1. 创建 ResponseFormat 类
2. 添加工厂方法
3. 扩展 LlmRequest
4. 修改 OpenAiRequest
5. 测试两种模式

**思考题**：
- 如何处理嵌套的 JSON Schema？
- 如何验证返回的 JSON 是否符合 Schema？

---

### 自检：你真的掌握了吗？

**问题 1**：`json_object` 和 `json_schema` 有什么区别？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**json_object**：
- 只保证返回 JSON
- 不保证字段名和类型
- 适合简单场景

**json_schema**：
- 严格按照 Schema 返回
- 字段名和类型都固定
- 适合需要严格格式的场景

**选择建议**：
- 简单提取 → `json_object`
- 需要验证 → `json_schema`

</details>

---

**问题 2**：为什么 `schema` 字段用 `Object` 类型？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**因为 JSON Schema 可以是复杂的嵌套结构**：

```java
// 简单 Schema
Map<String, Object> schema = Map.of("type", "object", ...);

// 复杂 Schema（嵌套）
Map<String, Object> schema = Map.of(
    "type", "object",
    "properties", Map.of(
        "user", Map.of(
            "type", "object",
            "properties", Map.of(
                "name", Map.of("type", "string"),
                "address", Map.of(
                    "type", "object",
                    "properties", Map.of(...)
                )
            )
        )
    )
);
```

**用 Object 的好处**：
- 支持 Map、自定义类等多种类型
- Jackson 会自动序列化
- 灵活性高

</details>

---

**问题 3**：JSON Schema 的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**JSON Schema 定义数据结构**：

1. **约束类型**：`{"type": "string"}` 必须是字符串
2. **必填字段**：`"required": ["name", "age"]` 必须存在
3. **嵌套结构**：可以定义复杂的嵌套对象
4. **数组约束**：`{"type": "array", "items": {...}}`

**作用**：
- 告诉 LLM 返回什么格式
- LLM 会严格按照 Schema 生成
- 应用端可以直接解析，不用担心格式变化

**示例**：
```json
{
  "type": "object",
  "properties": {
    "title": {"type": "string"},
    "tags": {"type": "array", "items": {"type": "string"}}
  },
  "required": ["title"]
}
```

</details>

---

### 本节小结

- 我们实现了结构化输出功能
- 关键要点：
  - JSON Schema 定义数据结构
  - ResponseFormat 类配置响应格式
  - json_object 简单，json_schema 严格
  - Object schema 支持复杂结构
- 恭喜！第 4 章全部完成！
