---
title: "第4.10节：多模态支持 - 让 LLM 理解图片"
summary: "扩展消息结构与请求格式，让 LLM 客户端支持图片输入。"
slug: multimodal
date: 2026-03-14
tags:
  - course
  - miniclaw
  - multimodal
order: 10
status: published
---

> **学习目标**：理解如何发送图片给 LLM，实现视觉理解
> **预计时长**：20 分钟

---

### 核心问题：如何让 LLM 看懂图片？

**真实场景**：

```
用户：[发送一张代码截图] 这段代码有什么问题？
LLM：我看到这段代码有个 bug，在第 10 行...
```

**多模态（Multimodal）**：
- 文本 + 图片作为输入
- LLM 同时理解文本和视觉信息
- GPT-4 Vision、Claude 3、Gemini 都支持

**学完本节，你将能够**：
- 发送图片给 LLM
- 理解多模态 API 的格式
- 扩展数据模型支持图片

---

### OpenAI 多模态 API 格式对比

**文本消息（之前）**：
```json
{
  "role": "user",
  "content": "你好"
}
```

**图片消息（多模态）**：
```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "这张图片里有什么？"
    },
    {
      "type": "image_url",
      "image_url": {
        "url": "data:image/jpeg;base64,/9j/4AAQ..."
      }
    }
  ]
}
```

**关键差异**：
- `content` 从 `String` 变成 `Array`
- 每个元素有 `type`：`text` 或 `image_url`
- 图片通过 Base64 编码或 URL 传递

---

### 第一步：理解 Base64 编码

**1.1 为什么需要 Base64？**

**问题**：
- 图片是二进制数据：`FF D8 FF E0 ...`
- JSON 只能传输文本
- 无法直接在 JSON 中传输二进制

**解决**：
- Base64 编码把二进制转成文本
- 可以在 JSON 中传输

**示例**：
```
原始图片（二进制）：FF D8 FF E0 00 10 4A 46 49 46
Base64 编码后：/9j/4AAQSkZJRgABAQAAAQABAAD
Data URL：data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD
```

**1.2 Java 读取图片为 Base64**

```java
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

public String imageToBase64(String imagePath) throws Exception {
    byte[] bytes = Files.readAllBytes(Path.of(imagePath));
    return Base64.getEncoder().encodeToString(bytes);
}

// 使用
String base64 = imageToBase64("/path/to/image.jpg");
String dataUrl = "data:image/jpeg;base64," + base64;
```

---

### 第二步：理解图片传递方式

**2.1 方式 1：Base64 内嵌（推荐）**

```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/jpeg;base64,/9j/4AAQ..."
  }
}
```

**好处**：
- 不需要额外的图片服务器
- 适合小图片（<1MB）

**2.2 方式 2：URL 外链**

```json
{
  "type": "image_url",
  "image_url": {
    "url": "https://example.com/image.jpg"
  }
}
```

**好处**：
- 适合大图片
- 减少 JSON 大小

**选择建议**：
- 本地图片、小图片 → Base64
- 网络图片、大图片 → URL

---

### 第三步：创建 ContentPart 类

**3.1 为什么需要 ContentPart？**

**不推荐**：直接构建 Map
```java
// ❌ 类型不安全，容易出错
Map<String, Object> textPart = new HashMap<>();
textPart.put("type", "text");
textPart.put("text", "你好");

Map<String, Object> imagePart = new HashMap<>();
imagePart.put("type", "image_url");
imagePart.put("image_url", Map.of("url", "data:image/jpeg;base64,..."));
```

**推荐**：用类定义
```java
// ✅ 类型安全，IDE 支持
ContentPart textPart = ContentPart.text("你好");
ContentPart imagePart = ContentPart.image("data:image/jpeg;base64,...");
```

**3.2 创建 ContentPart 类**

在 `LlmRequest.Message` 内部添加：

```java
/**
 * 消息内容部分（多模态）
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public static class ContentPart {
    
    /**
     * 类型：text 或 image_url
     */
    private String type;
    
    /**
     * 文本内容（type=text 时使用）
     */
    private String text;
    
    /**
     * 图片 URL（type=image_url 时使用）
     */
    private ImageUrl image_url;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImageUrl {
        private String url;
    }
}
```

**3.3 添加工厂方法**

```java
/**
 * 创建文本部分
 */
public static ContentPart text(String text) {
    return ContentPart.builder()
            .type("text")
            .text(text)
            .build();
}

/**
 * 创建图片部分（从 URL）
 */
public static ContentPart image(String url) {
    return ContentPart.builder()
            .type("image_url")
            .image_url(new ImageUrl(url))
            .build();
}

/**
 * 创建图片部分（从 Base64）
 */
public static ContentPart imageFromBase64(String base64, String mimeType) {
    String dataUrl = "data:" + mimeType + ";base64," + base64;
    return image(dataUrl);
}
```

---

### 第四步：修改 Message 类

**4.1 当前 Message 类**

```java
@Data
public static class Message {
    private String role;
    private String content;  // ❌ 只能是字符串
}
```

**问题**：无法表示数组类型的 content

**4.2 修改 content 为 Object**

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public static class Message {
    
    private String role;
    
    /**
     * 内容（可以是字符串或内容数组）
     * 使用 Object 类型，Jackson 会根据实际类型序列化
     */
    private Object content;
    
    // 工厂方法...
}
```

**4.3 添加工厂方法**

```java
/**
 * 纯文本消息
 */
public static Message system(String text) {
    return Message.builder().role("system").content(text).build();
}

public static Message user(String text) {
    return Message.builder().role("user").content(text).build();
}

public static Message assistant(String text) {
    return Message.builder().role("assistant").content(text).build();
}

/**
 * 文本 + 图片消息
 */
public static Message userWithImage(String text, String imageUrl) {
    List<ContentPart> parts = List.of(
        ContentPart.text(text),
        ContentPart.image(imageUrl)
    );
    return Message.builder().role("user").content(parts).build();
}

/**
 * 多张图片消息
 */
public static Message userWithImages(String text, List<String> imageUrls) {
    List<ContentPart> parts = new ArrayList<>();
    parts.add(ContentPart.text(text));
    for (String url : imageUrls) {
        parts.add(ContentPart.image(url));
    }
    return Message.builder().role("user").content(parts).build();
}
```

**需要添加导入**：
```java
import java.util.ArrayList;
import java.util.List;
```

---

### 第五步：验证编译

```bash
cd backend
./mvnw clean compile
```

---

### 第六步：创建测试

**6.1 测试多模态请求**

```java
package com.miniclaw.llm;

import com.miniclaw.config.LlmProperties;
import com.miniclaw.llm.model.LlmRequest;
import com.miniclaw.llm.model.LlmRequest.Message;
import com.miniclaw.llm.model.LlmResponse;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OpenAiCompatibleLlmClientMultimodalTest {

    @Test
    void testMultimodalMessage() throws Exception {
        // 读取本地图片
        byte[] imageBytes = Files.readAllBytes(Path.of("/path/to/test.jpg"));
        String base64 = Base64.getEncoder().encodeToString(imageBytes);
        
        // 构建多模态请求
        LlmProperties properties = new LlmProperties();
        properties.setEndpoint("https://api.openai.com");
        properties.setApiKey("sk-xxx");
        properties.setModel("gpt-4-vision-preview");
        properties.setTimeout(60);

        OpenAiCompatibleLlmClient client = new OpenAiCompatibleLlmClient(properties);

        LlmRequest request = LlmRequest.builder()
                .messages(List.of(
                    Message.userWithImage(
                        "这张图片里有什么？",
                        "data:image/jpeg;base64," + base64
                    )
                ))
                .build();

        LlmResponse response = client.chat(request);
        
        assertNotNull(response.getContent());
        System.out.println("多模态响应：" + response.getContent());
    }

    @Test
    void testTextOnly() {
        // 纯文本消息（向后兼容）
        LlmRequest request = LlmRequest.builder()
                .messages(List.of(Message.user("你好")))
                .build();
        
        // content 仍然可以是 String
        // 向后兼容，不需要修改现有代码
    }
}
```

---

### 支持视觉的模型

| Provider | 模型 | 说明 |
|----------|------|------|
| OpenAI | gpt-4-vision-preview | 支持 Base64 和 URL |
| OpenAI | gpt-4-turbo | 支持视觉 |
| Claude | claude-3-opus | 支持视觉 |
| Gemini | gemini-pro-vision | 支持视觉 |

**注意**：
- DeepSeek 不支持视觉
- 发送图片给不支持视觉的模型会报错

---

### 本节总结：我们解决了什么问题？

**核心问题**：如何让 LLM 理解图片？

**解决方案**：
1. **Base64 编码**：把图片转为文本
2. **ContentPart 类**：表示文本和图片部分
3. **Message.content 扩展**：从 String 到 Object
4. **工厂方法**：简化多模态消息创建

**关键设计**：
- `Object content`：支持 String 或 `List<ContentPart>`
- Jackson 智能序列化：根据类型自动序列化
- 工厂方法：`userWithImage()`、`userWithImages()`

**学完这节，你理解了**：
- 多模态 API 的格式差异
- Base64 编码的作用
- 如何扩展 Message 类
- 向后兼容的重要性

---

### 验证点

**在继续之前，确保**：

- [ ] ContentPart 类已创建
- [ ] Message.content 改为 Object
- [ ] 工厂方法已添加
- [ ] 编译通过
- [ ] 纯文本消息仍然可用（向后兼容）

---

### 动手实践

**任务**：实现多模态支持

**步骤**：
1. 创建 ContentPart 类
2. 添加工厂方法
3. 修改 Message.content 为 Object
4. 添加便捷工厂方法
5. 测试多模态请求

**思考题**：
- 如何处理图片大小限制？（OpenAI 限制 20MB）
- 如何优化大量图片的传输？

---

### 自检：你真的掌握了吗？

**问题 1**：为什么用 `Object content` 而不是 `String content`？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**因为 content 有两种类型**：

1. **纯文本**：`"你好"`（String）
2. **多模态**：`[{"type": "text", ...}, {"type": "image_url", ...}]`（List）

**用 String 的问题**：
```java
private String content;  // ❌ 只能是字符串
```

**用 Object 的好处**：
```java
private Object content;  // ✅ 可以是 String 或 List<ContentPart>
```

**Jackson 自动处理**：
- content 是 String → `"content": "你好"`
- content 是 List → `"content": [{"type": "text", ...}]`

</details>

---

**问题 2**：Base64 编码的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**Base64 将二进制数据转为文本**：

**问题**：
- 图片是二进制数据：`FF D8 FF E0 ...`
- JSON 只能传输文本

**解决**：
- Base64 编码：`FF D8 FF E0` → `/9j/4AAQ`
- 可以在 JSON 中传输

**示例**：
```
原始图片：FF D8 FF E0 00 10 4A 46 49 46
Base64：/9j/4AAQSkZJRgABAQAAAQABAAD
Data URL：data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD
```

</details>

---

**问题 3**：为什么需要向后兼容？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**因为现有代码都在用纯文本消息**：

```java
// 已有代码
Message.user("你好")  // content 是 String

// 如果不支持 String，所有现有代码都要改
```

**向后兼容的好处**：
- 现有代码不需要修改
- 纯文本消息仍然可用
- 平滑升级

**实现方式**：
- `Object content` 支持 String 和 List
- 保留原有的 `user(String)` 工厂方法
- 新增 `userWithImage()` 方法

</details>

---

### 本节小结

- 我们实现了多模态支持
- 关键要点：
  - Base64 编码把图片转为文本
  - ContentPart 类表示文本或图片
  - Object content 支持两种类型
  - 工厂方法简化使用
- 下一节我们将实现结构化输出
