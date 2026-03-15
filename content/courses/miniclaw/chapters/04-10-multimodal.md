---
title: "第4.10节：多模态支持 - 让 LLM 理解图片"
summary: "先在 Provider 配置里声明哪些模型支持图片，再扩展消息结构和 LLM Client，让 MiniClaw 能安全地发送多模态请求。"
slug: multimodal
date: 2026-03-14
tags:
  - course
  - miniclaw
  - multimodal
order: 10
status: published
---

> **学习目标**：让当前的 LLM Client 在保持文本能力不变的前提下，新增图片输入能力，并且只允许多模态模型处理图片
> **预计时长**：30 分钟
> **难度**：进阶

---

### 这一节我们做什么

前面几节，我们已经把一个 LLM Client 的基础能力补得比较完整了：

- 纯文本同步调用
- 纯文本流式调用
- 错误处理
- 重试
- 多 Provider

但如果你真的把这个客户端拿去做 AI 应用，很快就会撞到另一个很常见的需求：

> 用户发来的不只是文本，还有截图、商品图、UI 草图、报错截图。  
> 那客户端怎么把图片也一起发给模型？

这就是这一节要解决的问题。

注意，这一节我们做的是 **图片输入能力**，也就是多模态输入。  
我们还不做：

- 音频输入
- 视频输入
- OCR 专项流程
- 按模型能力自动调度多模态 Provider

这一节的目标非常明确：

> 先让我们的 `OpenAiCompatibleLlmClient` 能安全地发图片，  
> 并且只允许配置里明确声明为“多模态”的模型去识图。

---

### 第一步：先改配置，不要先改代码

这一步和 4.9 很像。

如果你一上来就改 `Message` 结构、改 `WebClient` 请求体，但配置文件里根本没有“谁支持多模态”这层信息，那最后一定会出现一个问题：

> 图片请求发出去了，但到底该走哪个视觉模型，客户端根本不知道。

所以这一节第一步，仍然是先改配置模型。

我们当前的 Provider 配置大概是这样：

```yaml
llm:
  default-model: deepseek:deepseek-chat
  providers:
    - id: deepseek
      endpoint: https://api.deepseek.com
      api-key: ${DEEPSEEK_API_KEY}
      models:
        - deepseek-chat
        - deepseek-reasoner
    - id: qwen
      endpoint: https://dashscope.aliyuncs.com/compatible-mode/v1
      api-key: ${QWEN_API_KEY}
      models:
        - qwen3.5-plus
        - qwen3.5-flash
```

这套配置只能回答一个问题：

> 这个 Provider 下面有哪些模型？

但它回答不了另一个更关键的问题：

> 这些模型里，哪些支持图片？

所以我们把它扩展成下面这样：

```yaml
llm:
  default-model: deepseek:deepseek-chat
  providers:
    - id: deepseek
      endpoint: https://api.deepseek.com
      api-key: ${DEEPSEEK_API_KEY}
      models:
        - deepseek-chat
        - deepseek-reasoner
      multimodal-models: []
    - id: qwen
      endpoint: https://dashscope.aliyuncs.com/compatible-mode/v1
      api-key: ${QWEN_API_KEY}
      models:
        - qwen3.5-plus
        - qwen3.5-flash
      multimodal-models:
        - qwen3-vl-plus
```

这里要特别注意：

- `models`：表示这个 Provider 下所有常规可选模型
- `multimodal-models`：表示这个 Provider 下明确支持图片输入的模型

为什么我不把 `models` 直接改成复杂对象，例如：

```yaml
models:
  - name: qwen3.5-plus
    multimodal: false
  - name: qwen3-vl-plus
    multimodal: true
```

因为这一节还不需要把“模型能力描述系统”设计得那么重。

当前最重要的只是一个教学目标：

> 让学员先理解，多模态模型不是所有模型默认都支持，  
> 所以配置里必须显式区分出来。

这也是为什么这一节我选了一个更轻的结构：

> 保留 `models` 字符串列表，额外补一个 `multimodal-models` 子列表。

这样够用，而且不会把配置复杂度一下拉满。

---

### 第二步：扩展 `LlmProviderConfig`

配置文件改了，Java 的配置对象就得跟着改。

我们先在 `LlmProviderConfig` 里新增一个字段：

```java
@Builder.Default
private List<String> multimodalModels = new ArrayList<>();
```

然后再补两个辅助方法：

```java
public String getDefaultMultimodalModel() {
    return firstNonBlank(multimodalModels);
}

public boolean supportsMultimodal(String modelName) {
    if (modelName == null || modelName.isBlank() || multimodalModels == null) {
        return false;
    }
    return multimodalModels.stream().anyMatch(modelName::equals);
}
```

这两个方法的职责非常明确。

第一个职责，是在图片请求没有自己显式指定模型时，客户端可以自动拿到这个 Provider 的默认多模态模型。

第二个职责，是在图片请求自己显式传了模型名时，客户端可以本地先判断：

> 你传的这个模型，到底是不是多模态模型？

这一步非常关键。

因为我们不希望出现这种情况：

- 用户传了一张图
- `providerId=deepseek`
- 结果客户端还是把请求发到 `deepseek-chat`
- 然后等远端接口报错

这种错误当然最终也能暴露，但它暴露得太晚了。

更合理的做法是：

> 客户端在发请求之前，就根据本地配置先把这类能力错误拦下来。

---

### 第三步：不要把 `Message.content` 直接改成 `Object`

很多人做到这里，会立刻想到一个方案：

> OpenAI 兼容的多模态请求里，`content` 有时候是字符串，有时候是数组。  
> 那我直接把 `Message.content` 改成 `Object` 不就完了吗？

这个想法表面上很省事，但它会带来一个问题：

> 你把“外部协议层的多态”直接污染进了内部请求模型。

对当前课程阶段来说，这不是最好的设计。

因为我们内部的 `LlmRequest.Message` 其实完全可以继续保持可读性：

- 纯文本消息继续用 `content`
- 多模态消息另外加一个结构化字段

所以我们最终的做法是：

```java
private String content;

private List<ContentPart> contentParts;
```

也就是说：

- 文本消息：继续走 `content`
- 图片消息：走 `contentParts`

这个设计的好处是两层。

第一层，向后兼容特别干净。

前面章节所有代码还可以继续写：

```java
Message.user("你好")
```

根本不用动。

第二层，`LlmRequest` 依然是强类型的。

我们没有把一个最常用的业务字段变成 `Object`，而是明确地说：

> 这是纯文本内容。  
> 这是多模态内容块。

这对学员理解代码会轻松很多。

---

### 第四步：定义 `ContentPart`

有了 `contentParts`，接下来就要定义它里面到底放什么。

我们新增 `ContentPart`：

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public static class ContentPart {

    private String type;

    private String text;

    @JsonProperty("image_url")
    private ImageUrl imageUrl;
}
```

并且补两个工厂方法：

```java
public static ContentPart text(String text) {
    return ContentPart.builder()
            .type("text")
            .text(text)
            .build();
}

public static ContentPart image(String url) {
    return ContentPart.builder()
            .type("image_url")
            .imageUrl(new ImageUrl(url))
            .build();
}
```

这里的关键点有两个。

第一个点，图片部分我们用的是 `image_url` 这一种 OpenAI 兼容格式。  
但这个 `url` 字段里既可以放远程图片 URL，也可以放 Data URL。

也就是说，这两种都成立：

```text
https://example.com/cat.png
```

和：

```text
data:image/png;base64,......
```

第二个点，我们没有在这一节里引入本地文件读取、上传服务、OSS 存储这些东西。

因为这些都不是 `LLM Client` 的核心职责。

当前这一层只关心一件事：

> 你最终给我的是一个可发送的图片 URL，我就负责把它放进 OpenAI 兼容请求格式里。

---

### 第五步：补一个便捷入口 `userWithImage(...)`

光有 `ContentPart` 还不够。

如果每次发图都要这样手写：

```java
Message.builder()
    .role("user")
    .contentParts(List.of(
        ContentPart.text("看一下这张图"),
        ContentPart.image("https://example.com/cat.png")
    ))
    .build();
```

那使用成本还是偏高。

所以我们补了一个很直接的便捷方法：

```java
public static Message userWithImage(String text, String imageUrl) {
    List<ContentPart> parts = new ArrayList<>();
    if (text != null && !text.isBlank()) {
        parts.add(ContentPart.text(text));
    }
    parts.add(ContentPart.image(imageUrl));

    return Message.builder()
            .role("user")
            .contentParts(parts)
            .build();
}
```

这样课程后面的示例就可以写成：

```java
Message.userWithImage(
    "看一下这张图里有什么",
    "https://example.com/cat.png"
)
```

这个 API 一看就知道在做什么。

同时，我们还加了两个小判断方法：

```java
public boolean hasContentParts()
public boolean hasImageContent()
```

后面 client 判断“这是不是图片请求”，靠的就是它们。

---

### 第六步：只在 client 内部把 `content` 变成多态

前面我专门强调过，不要把 `LlmRequest.Message.content` 直接改成 `Object`。

但 OpenAI 兼容协议的请求体里，`content` 确实又有两种形态：

- 文本消息：字符串
- 多模态消息：数组

这个多态最终还是要处理。

只是我们把它收敛到了 client 内部。

也就是 `OpenAiCompatibleLlmClient.ChatMessage` 这里：

```java
static class ChatMessage {
    private String role;
    private Object content;
}
```

然后在 `convertMessage(...)` 里做转换：

```java
if (message.hasContentParts()) {
    chatMessage.setContent(message.getContentParts());
} else {
    chatMessage.setContent(message.getContent());
}
```

这个设计非常重要。

因为它把协议层的复杂性锁在了 client 里面，而不是扩散到整个业务请求模型里。

你可以把它理解成一句话：

> `LlmRequest` 负责表达业务意图，  
> `ChatMessage` 负责适配 OpenAI 兼容协议。

这两个层次不要混。

---

### 第七步：真正关键的地方，不是图片格式，而是模型选择

到这里，很多人会以为多模态已经做完了。

其实还没有。

因为真正最容易写错的地方，不是 `image_url` JSON 长什么样，而是：

> 图片请求到底该用哪个模型？

这一步我们专门把逻辑补进了 `resolveModel(...)`。

新的规则是这样的：

1. 如果请求里没有图片，还是走原来的文本模型选择逻辑
2. 如果请求里有图片，而且请求自己显式传了 `model`
   那这个 `model` 必须在当前 Provider 的 `multimodal-models` 里
3. 如果请求里有图片，但请求没有显式传 `model`
   那就自动选择当前 Provider 配置里的第一个多模态模型
4. 如果当前 Provider 根本没有配置多模态模型
   直接本地报错，不发请求

比如：

- `providerId=qwen`
- `Message.userWithImage(...)`
- 没有自己传 `model`

那客户端就会自动选：

```text
qwen3-vl-plus
```

再比如：

- `providerId=deepseek`
- `Message.userWithImage(...)`

因为 `deepseek` 的 `multimodal-models` 是空的，所以客户端会直接抛：

> Provider deepseek does not have a multimodal model configured

这个本地 fail fast 非常关键。

因为它把错误从“远端 API 不支持”前移成了“本地配置就不成立”。

---

### 第八步：把测试写成“学员一看就会用”的样子

这一节的测试，我刻意没有再写成一堆本地 mock server。

原因很简单：

> 这是教学项目。  
> 测试除了验证功能，还应该直接告诉学员：这段代码到底怎么调用、跑起来会看到什么。

所以我把测试拆成了两类。

第一类，是可直接运行的演示测试：

`OpenAiCompatibleLlmClientMultimodalTest.java`

这个测试本身就是一个 `SpringBootTest`，直接注入已经由 Spring Boot 创建好的 `OpenAiCompatibleLlmClient`，然后发真实的多模态请求。

像这样：

```java
LlmResponse response = client.chat(LlmRequest.builder()
        .providerId("qwen")
        .temperature(0.0)
        .maxTokens(96)
        .messages(List.of(LlmRequest.Message.userWithImage(
                "Describe the image in one short sentence.",
                DEMO_IMAGE_DATA_URL
        )))
        .build());
```

这里有三个教学点。

第一，`providerId` 明确写成 `qwen`，让学员一眼就知道：

> 多模态请求不是神秘地“自动找模型”，而是先选 Provider，再由当前 Provider 的配置决定最终走哪个多模态模型。

第二，我们没有在请求里手填 `model`。

这正是为了演示这一节刚刚完成的能力：

> 只要 `qwen` 的 `multimodal-models` 配好了，client 就会自动选中 `qwen3-vl-plus`。

第三，测试里的图片不是公网 URL，而是一个很小的 Data URL。

这样做的目的不是炫技，而是让测试更稳定：

- 不依赖模型服务端再去拉第三方图片地址
- 学员本地跑的时候，影响因素更少
- 更接近“我已经拿到图片内容，直接发给模型”的真实使用方式

同一个测试类里，我还保留了 `stream()` 的演示版本。

也就是说，学员不只看得到同步 `chat()` 怎么用，也能直接看到流式输出怎么跑、最终会打印什么结果。

---

第二类，是能力保护测试：

`OpenAiCompatibleLlmClientMultimodalGuardTest.java`

这个测试也不再手工 new 一套 `LlmProperties`，也不再在测试里写假 API key。

它和前面的演示测试一样，直接用 `SpringBootTest` 注入好的 `client`，然后只做一件事：

```java
client.chat(LlmRequest.builder()
        .providerId("deepseek")
        .messages(List.of(LlmRequest.Message.userWithImage(
                "What is in this image?",
                "https://example.com/demo.png"
        )))
        .build());
```

为什么这里故意用 `deepseek`？

因为当前配置里，`deepseek` 没有声明任何 `multimodal-models`。

所以这条测试真正要验证的，不是“DeepSeek 会不会返回 400”，而是：

> 我们的 client 能不能在本地先拦下来，直接抛出  
> `Provider deepseek does not have a multimodal model configured`

只有这条固定消息被断言成功，才说明这次的 fail fast 是真的发生在 client 本地，而不是请求发出去以后才被远端拒绝。

---

验证命令：

```bash
./mvnw -Dtest=OpenAiCompatibleLlmClientMultimodalGuardTest test
./mvnw -Dtest=OpenAiCompatibleLlmClientMultimodalTest test
./mvnw test
```

如果你的本地还没有配置真实的 `qwen` API key，那么 `OpenAiCompatibleLlmClientMultimodalTest` 会被跳过。

这不是失败，而是为了避免在没有可用密钥的环境里把“教学 demo”跑成一堆无意义的红字。

---

### 这一节真正要记住什么

表面上看，这一节是在加图片输入。

但更底层一点，你真正应该记住的是三个设计原则：

1. **模型能力必须进配置**
   - 不是所有模型都支持图片
   - 所以能力边界必须能在配置里表达

2. **业务模型和协议模型要分层**
   - `LlmRequest.Message` 不直接变成协议层的 `Object content`
   - 多态序列化只留在 client 内部

3. **能力错误要尽量本地 fail fast**
   - DeepSeek 没有配置多模态模型，就不要把图发过去再等接口报错
   - 客户端自己先拦下来，错误更早也更清晰

如果你把这三件事吃透，后面你继续做：

- 音频输入
- 视频摘要
- 文档理解
- Agent 层的能力路由

都会顺很多。

---

### 本节小结

- 我们先在配置里新增了 `multimodal-models`
- 我们扩展了 `LlmProviderConfig`，让 Provider 能表达“哪些模型支持图片”
- 我们扩展了 `LlmRequest.Message`，新增 `contentParts` 和 `ContentPart`
- 我们补了 `Message.userWithImage(...)` 这种更好用的入口
- 我们把协议层的 `Object content` 收敛到了 client 内部，而不是扩散到业务模型
- 我们让 `OpenAiCompatibleLlmClient` 能自动选择多模态模型，并在错误配置时本地 fail fast
- 我们用测试证明了 chat、stream 和能力保护三条链路都成立

下一节，我们继续往前走，开始解决另一个同样非常实用的需求：

> 让模型不只是“说一段自然语言”，而是按我们指定的结构稳定输出，也就是结构化输出。
