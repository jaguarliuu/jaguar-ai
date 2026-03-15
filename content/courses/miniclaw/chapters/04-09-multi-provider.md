---
title: "第4.9节：多模型适配 - 让一个客户端支持多个 LLM"
summary: "在保留旧配置兼容性的前提下，为 MiniClaw 接入多 Provider 配置、客户端路由与模型解析能力。"
slug: multi-provider
date: 2026-03-14
tags:
  - course
  - miniclaw
  - providers
order: 9
status: published
---

> **学习目标**：把当前单 Provider 的 LLM Client 升级成可配置、可切换、可扩展的多 Provider 客户端
> **预计时长**：25 分钟
> **难度**：进阶

### 这一节我们做什么

好，上一节我们把 LLM Client 的可靠性层补上了。

这一节我们往前走一步，解决另一个非常实际的问题：

> 现在的客户端只能连一个模型提供方。  
> 那如果我本地开发想连 Ollama，线上想连 DeepSeek，某些场景又想切 OpenAI，怎么办？

注意，这一节我们做的是 **Provider 适配**，不是 Provider fallback。

也就是说，这一节只解决：

- 怎么配置多个 Provider
- 怎么在运行时选择某个 Provider
- 怎么让不同 Provider 走同一个客户端实现

这节还不做：

- 健康检查
- 故障切换
- 按 Provider 做重试预算
- 负载均衡

先把“能干净地接多个 Provider”这件事做扎实。

---

### 第一步：先把配置文件改成“多 Provider 结构”

这一节我想先强调一个很容易被忽略，但实际开发里最关键的点：

> 这次不是先改 Java 代码，而是先改配置文件。  
> 因为你后面加的 `defaultModel`、`providers`、`providerId`，最终都要落到配置绑定和运行时路由上。

如果你代码改完了，但 `application.yml` 还是旧结构，那学员一启动项目，看到的还是单 Provider 行为。  
文档写得再完整，也会变成“代码是新的，配置还是旧的”，学习体验会直接断掉。

先看我们前面一直在用的单 Provider 配置：

```yaml
llm:
  endpoint: https://api.deepseek.com
  api-key: ${LLM_API_KEY}
  model: deepseek-chat
```

这个写法在前面几节完全够用，因为那时候客户端只服务一个模型提供方。

但这一节开始，我们要让同一个客户端同时管理多个 Provider，所以配置结构必须升级成下面这样：

```yaml
llm:
  default-model: deepseek:deepseek-chat
  providers:
    - id: deepseek
      endpoint: https://api.deepseek.com
      api-key: ${DEEPSEEK_API_KEY}
      models:
        - deepseek-chat
        - deepseek-coder
    - id: openai
      endpoint: https://api.openai.com
      api-key: ${OPENAI_API_KEY}
      models:
        - gpt-4o-mini
        - gpt-4.1
```

这里有两个字段你一定要先看懂。

第一个是 `default-model`。

它不再只是一个模型名，而是一个组合值：

```yaml
default-model: providerId:modelName
```

比如：

```yaml
default-model: deepseek:deepseek-chat
```

它表达的是两层意思：

- 默认走哪个 Provider
- 这个 Provider 下默认用哪个模型

第二个是 `providers`。

它是一个列表，列表里的每一项都表示一个可接入的模型提供方。  
每个 Provider 至少要回答四个问题：

- 你是谁：`id`
- 你地址在哪：`endpoint`
- 你怎么鉴权：`api-key`
- 你下面有哪些模型：`models`

所以这一步你在项目里实际要改的，不只是脑子里的配置概念，而是这几个文件：

- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/application-dev.yml`
- `backend/src/main/resources/application-prod.yml`

注意一下，这里我虽然把主线配置切到多 Provider 结构了，但代码里并没有彻底删除旧的 `endpoint + api-key + model` 兼容逻辑。  
原因很简单，课程要往前走，但前面章节已经写通的单 Provider 代码也不能被我们这一节直接推翻。

所以这一节的第一步，不是写类，不是改方法，而是先把配置模型立住。  
配置模型立住以后，后面的 Java 代码才有明确的承载对象。

---

### 先看当前问题到底在哪里

我们先不要急着写代码，先把当前版本的问题说透。

现在的 `OpenAiCompatibleLlmClient` 是单 Provider 结构：

- 只有一个 `endpoint`
- 只有一个 `apiKey`
- 只有一个默认 `model`
- 客户端内部只有一个 `WebClient`

这种结构在第 4 章前半段没问题，因为我们的重点是先把协议、同步调用、流式调用、可靠性这些基础链路打通。

但一旦走到真实项目，就会立刻撞上三个问题：

1. 开发、测试、生产环境经常不是同一个模型服务
2. 同一个系统内部，不同场景可能要选不同 Provider
3. 如果客户端天生只能连一个 Provider，后面做扩展会非常别扭

所以这一节的核心思路很简单：

> 不改 `OpenAI Compatible` 这一层协议实现。  
> 我们只是在它的外面，再加一层 “Provider 配置 + Client 路由”。

这样做的好处是，协议实现不散，复杂度也不会一下爆炸。

---

### 第二步：先定义 Provider 配置对象

好，正式开始写代码。

进入代码实现以后，我们第一件事不是改客户端，而是先把“一个 Provider 需要哪些信息”定义清楚。

我们新建 `LlmProviderConfig.java`：

```java
package com.miniclaw.config;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LlmProviderConfig {

    private String id;

    private String endpoint;

    private String apiKey;

    private List<String> models;
}
```

这里你可以先把它理解成：

> 描述一个模型提供方最小必要信息的数据结构。

为什么这里只有这四个字段？

- `id`：给 Provider 一个稳定标识，后面路由靠它
- `endpoint`：告诉客户端请求发到哪里
- `apiKey`：告诉客户端鉴权信息是什么
- `models`：告诉客户端，这个 Provider 下面有哪些模型可选

注意这个类现在先不追求“大而全”。

我们没有加：

- timeout
- weight
- tags
- rateLimit
- healthStatus

原因很简单，这一节不是做 Provider 调度系统，只是做 **多 Provider 接入能力**。

---

### 第三步：扩展 `LlmProperties`

有了单个 Provider 的配置对象之后，下一步自然就是把它挂进总配置里。

现在我们改 `LlmProperties`，新增两个字段：

```java
private String defaultModel;

private List<LlmProviderConfig> providers = new ArrayList<>();
```

然后再补三个辅助方法：

```java
public String getDefaultProviderId() {
    if (defaultModel == null || !defaultModel.contains(":")) {
        return null;
    }
    return defaultModel.split(":", 2)[0];
}

public String getDefaultModelName() {
    if (defaultModel == null || !defaultModel.contains(":")) {
        return model;
    }
    return defaultModel.split(":", 2)[1];
}

public LlmProviderConfig getProvider(String providerId) {
    if (providerId == null || providerId.isBlank() || providers == null) {
        return null;
    }

    return providers.stream()
            .filter(provider -> providerId.equals(provider.getId()))
            .findFirst()
            .orElse(null);
}
```

这里我要专门停一下。

为什么我们用了：

```yaml
default-model: deepseek:deepseek-chat
```

而不是拆成两个字段：

```yaml
default-provider: deepseek
default-model: deepseek-chat
```

这一版我故意用一个组合字符串，是为了让读者先接受一个很直接的事实：

> “默认 Provider” 和 “默认模型” 在当前版本里，本质上就是一组绑定关系。

你写成一行，读配置的人一眼就知道：

- 默认 Provider 是谁
- 默认模型又是谁

同时我们又保留了旧字段 `model`，所以当多 Provider 配置不存在时，旧逻辑仍然成立。

这就是这一节一个很关键的原则：

> 新能力要加进去，但不能把前面章节已经写通的单 Provider 直接打断。

---

### 第四步：给 `LlmRequest` 增加 `providerId`

接下来我们要解决一个运行时问题：

> 配置文件里虽然能声明多个 Provider，但一次具体请求，到底要走哪一个？

所以我们给 `LlmRequest` 加一个新字段：

```java
private String providerId;
```

这一步非常小，但意义很大。

因为从这一行开始，客户端的输入语义变了：

- 以前请求只关心“我要问什么”
- 现在请求还可以表达“我要走哪个 Provider”

注意，这里我没有把 `providerId` 塞到 `Message` 里，也没有塞到 `ToolCall` 里。

因为它不是对话内容的一部分，它是 **本次模型调用的路由信息**。

这就是为什么它应该挂在 `LlmRequest` 顶层。

到这里，整个数据模型层的准备就做完了。

接下来我们才进入客户端实现。

---

### 第五步：把单个 `WebClient` 改成一组 `WebClient`

现在看 `OpenAiCompatibleLlmClient`。

原来这个类只有一个字段：

```java
private final WebClient webClient;
```

这在单 Provider 时代没问题。

但一旦支持多个 Provider，这个字段就不够了。

因为多个 Provider 意味着：

- 不同 baseUrl
- 不同 apiKey
- 未来还可能有不同 header 习惯

所以这一步我们改成：

```java
private static final String LEGACY_CLIENT_KEY = "__legacy__";

private final Map<String, WebClient> clientCache;
```

然后在构造函数里初始化：

```java
this.clientCache = new ConcurrentHashMap<>();
initializeClients();
```

这里的思路要讲清楚。

我们不是“每次请求临时 new 一个 WebClient”，而是：

> 在客户端启动时，把当前配置里能用的 Provider 全部初始化好，缓存起来。

为什么这么做？

因为 `WebClient` 本来就是适合复用的客户端对象。

如果你每来一次请求都重新 new：

- 没必要
- 噪音很大
- 后面扩展也不方便

所以多 Provider 场景下，最自然的结构就是：

> `providerId -> WebClient`

这也是当前实现里 `clientCache` 的职责。

---

### 第六步：先写初始化逻辑，再保留旧模式

好，缓存结构有了，下一步就要把初始化逻辑补上。

我们新增 `initializeClients()`：

```java
private void initializeClients() {
    if (properties.getProviders() != null && !properties.getProviders().isEmpty()) {
        for (LlmProviderConfig provider : properties.getProviders()) {
            if (provider.getId() == null || provider.getId().isBlank()) {
                continue;
            }
            String endpoint = normalizeEndpoint(provider.getEndpoint());
            clientCache.put(provider.getId(), buildWebClient(endpoint, provider.getApiKey()));
            log.info("LLM provider initialized: id={}, endpoint={}", provider.getId(), endpoint);
        }
        return;
    }

    String endpoint = normalizeEndpoint(properties.getEndpoint());
    clientCache.put(LEGACY_CLIENT_KEY, buildWebClient(endpoint, properties.getApiKey()));
    log.info("LLM Client initialized: endpoint={}, model={}", endpoint, properties.getModel());
}
```

这段代码我建议你按两段来理解。

第一段：

- 如果 `providers` 存在
- 就遍历所有 Provider
- 每个 Provider 构造一个独立 `WebClient`
- 用 `providerId` 作为 key 放进缓存

第二段：

- 如果 `providers` 根本没配
- 就退回旧模式
- 把原来那套 `endpoint + apiKey + model` 逻辑继续保留下来

这里的 `LEGACY_CLIENT_KEY` 不是为了炫技，它只是一个很明确的信号：

> 当前客户端处于“老的单 Provider 兼容模式”。

这一步做完以后，多 Provider 和旧模式就能共存了。

---

### 第七步：把 `buildWebClient()` 改成“按 Provider 构造”

原来的 `buildWebClient()` 直接读 `properties`，现在就不够用了。

所以我们把它改成参数化：

```java
private WebClient buildWebClient(String endpoint, String apiKey) {
    WebClient.Builder builder = WebClient.builder()
            .baseUrl(endpoint)
            .defaultHeader("Content-Type", "application/json");

    if (apiKey != null && !apiKey.isBlank()) {
        builder.defaultHeader("Authorization", "Bearer " + apiKey);
    }

    return builder.build();
}
```

这一改动有两个关键点。

第一个点，`endpoint` 和 `apiKey` 不再来自全局单例配置，而是由每个 Provider 自己提供。

第二个点，空 `apiKey` 时我们不再强行写 `Authorization`。

这件事很重要。

因为像 Ollama 这种本地 OpenAI 兼容服务，本来就不需要鉴权。

如果你无脑写：

```java
Authorization: Bearer null
```

或者：

```java
Authorization: Bearer
```

虽然有些服务能忍，但这不是一个干净的客户端实现。

所以这里要明确成：

> 有 key 才加 Header。没有 key，就不要伪造 Header。

---

### 第八步：真正解决“请求该走哪个 Provider”

好，客户端们已经初始化好了。

现在真正进入这节课最核心的方法：

```java
private WebClient resolveClient(LlmRequest request) {
    if (clientCache.containsKey(LEGACY_CLIENT_KEY)) {
        return clientCache.get(LEGACY_CLIENT_KEY);
    }

    String providerId = properties.getDefaultProviderId();
    if (request.getProviderId() != null && !request.getProviderId().isBlank()) {
        providerId = request.getProviderId();
    }

    if (providerId == null || providerId.isBlank()) {
        throw new IllegalStateException("No default LLM provider configured");
    }

    WebClient client = clientCache.get(providerId);
    if (client == null) {
        throw new IllegalArgumentException("Unknown LLM provider: " + providerId);
    }

    return client;
}
```

这段代码不要一下看完，按顺序看：

第一层：

- 如果当前是旧模式
- 直接返回 legacy client

第二层：

- 先拿配置里的默认 Provider
- 如果请求自己指定了 `providerId`
- 就用请求里的值覆盖默认值

第三层：

- 如果最后还是拿不到 Provider
- 直接报错

第四层：

- 去缓存里取对应的 `WebClient`
- 取不到就 fail fast

这里我故意没有做“取不到就自动降级到别的 Provider”。

因为那已经不是本节的主题了。

这节要先建立一个好习惯：

> 路由错误要先明确报出来，不能默默帮你改路。

---

### 第九步：模型也要跟着 Provider 一起解析

只有客户端路由还不够，因为现在还有另一个问题：

> 请求走的是 OpenAI，但 model 还沿用默认的 `deepseek-chat`，那显然不对。

所以我们又补了一个 `resolveModel(request)`：

```java
private String resolveModel(LlmRequest request) {
    if (request.getModel() != null && !request.getModel().isBlank()) {
        return request.getModel();
    }

    if (request.getProviderId() != null && !request.getProviderId().isBlank()) {
        LlmProviderConfig provider = properties.getProvider(request.getProviderId());
        if (provider != null && provider.getModels() != null && !provider.getModels().isEmpty()) {
            return provider.getModels().get(0);
        }
    }

    return properties.getDefaultModelName();
}
```

这个方法的优先级一定要讲清楚：

1. 如果请求自己带了 `model`，优先用请求里的
2. 如果请求指定了 `providerId`，但没带 `model`，那就取该 Provider 的第一个模型
3. 如果请求什么都没指定，那就回到全局默认模型

你可以把它理解成一条很自然的覆盖链：

> 请求显式参数 > Provider 自己的模型列表 > 全局默认模型

这也是我们这一节第二个关键设计点：

> Provider 路由和模型选择不能分裂，它们必须至少有一个最基本的联动规则。

---

### 第十步：把它们接回请求链路

到这里，路由和模型解析都准备好了。

最后做的就是把它们真正接回 `chat()` / `stream()` / `buildApiRequest()`。

首先，`chat()` 和 `stream()` 不再直接用单一 `webClient`，而是改成：

```java
resolveClient(request).post()
```

然后 `buildApiRequest()` 里模型解析改成：

```java
String model = resolveModel(request);
```

也就是说，这节课到最后的落点其实就两个：

- 请求发给谁：`resolveClient(request)`
- 请求里写什么模型：`resolveModel(request)`

你只要把这两个入口设计清楚，多 Provider 客户端就立住了。

---

### 这次测试是怎么写的

这节我们没有靠“我觉得差不多了”收工，而是先写了失败测试，再补代码。

新增测试文件：

`OpenAiCompatibleLlmClientMultiProviderTest.java`

覆盖了两条主线。

第一条：

> 当配置了多个 Provider，且请求没有显式指定 Provider 时，客户端会根据 `default-model` 选择默认 Provider，并把默认模型发出去。

第二条：

> 当请求显式指定 `providerId`，但没有自己传 `model` 时，客户端会选中该 Provider 的首个模型。

这两个测试跑通以后，我们再回头跑整套 backend 测试，确认：

- 多 Provider 新能力可用
- 原来的可靠性测试没有被打坏
- 原来的流式测试没有被打坏

验证命令：

```bash
./mvnw -Dtest=OpenAiCompatibleLlmClientMultiProviderTest test
./mvnw test
./mvnw -DskipTests compile
```

这三个命令全部通过之后，这一节的代码才有资格进入文档。

---

### 这一节你真正要记住什么

这一节表面上是在做“多 Provider”。

但更底层一点，你真正应该记住的是三个设计原则：

1. **协议实现不要因为 Provider 变多就写散**
   - 我们没有为每个 Provider 写一份客户端
   - 仍然是一个 OpenAI Compatible 客户端 + 一层 Provider 路由

2. **新能力要和旧能力共存**
   - `providers` 配了，就走多 Provider 模式
   - `providers` 没配，就继续兼容旧的单 Provider 模式

3. **请求路由和模型选择必须同时设计**
   - 只切 client，不切 model，会错
   - 只切 model，不切 client，也会错

如果你把这三个原则吃透，后面你再做：

- 多模态
- 结构化输出
- Provider fallback
- Agent 层模型分工

都会顺很多。

---

### 本节小结

- 我们新增了 `LlmProviderConfig`
- 我们扩展了 `LlmProperties`，支持 `defaultModel` 和 `providers`
- 我们给 `LlmRequest` 增加了 `providerId`
- 我们把单个 `WebClient` 升级成了 `providerId -> WebClient` 的缓存结构
- 我们实现了 `resolveClient(request)` 和 `resolveModel(request)`
- 我们用测试证明了默认 Provider 选路和显式 Provider 选路都能工作

下一节，我们继续往前走，开始解决另一个非常常见的真实需求：

> 让这个客户端不只会收文本，还能收图片，也就是多模态输入。
