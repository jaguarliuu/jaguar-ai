---
title: "第4.11节：客户端重构 - 把胖 Client 拆回可维护结构"
summary: "从第一性原理出发，重构 500+ 行的 OpenAiCompatibleLlmClient，把它拆成清晰、稳定、可继续扩展的协作组件。"
slug: client-refactor
date: 2026-03-15
tags:
  - course
  - miniclaw
  - refactor
order: 11
status: published
---

> **学习目标**：理解为什么功能做完以后还要专门重构一次客户端，并亲手把一个职责混杂的胖类拆成可维护的协作结构
> **预计时长**：35 分钟
> **难度**：进阶

---

### 为什么这一节不继续加新功能？

很多教程都会把内容写成一条直线：

- 先实现同步调用
- 再实现流式输出
- 再实现异常处理
- 再实现重试
- 再实现多 Provider
- 再实现多模态
- 然后继续一路往下堆功能

这种写法有一个问题：

> 它很像 demo 开发，不太像企业里的真实工程过程。

真实项目里，尤其是基础设施代码，经常会走这样一条路径：

1. 先把主能力做出来，让系统能跑
2. 再观察复杂度开始堆在哪里
3. 在功能继续扩张之前，先做一次结构收口

这也是为什么第四章最后一节，我不继续讲结构化输出，而是专门停下来做一次 `OpenAiCompatibleLlmClient` 重构。

因为到 4.10 为止，这个类已经不只是“长”了，而是开始出现一个更本质的问题：

> 变化原因太多，全部挤在一个类里。

如果这时候还不收，后面你再加：

- 结构化输出
- Tool Calling
- Provider fallback
- Agent 层模型路由

这些能力最后只会继续压回同一个 God Object。

所以这一节的目标不是“让代码更好看”，而是：

> 在系统还没彻底长歪之前，把客户端重新拉回可维护结构。

---

### 先从第一性原理看：Client 的核心职责到底是什么？

我们先不要急着讨论“拆几个类”“用什么模式”。

第一性原理的问法应该是：

> 一个 LLM Client 对外真正承诺了什么？

对当前 MiniClaw 而言，这个承诺其实很简单：

- 你给我一个 `LlmRequest`
- 我负责把它发到正确的模型服务
- 同步场景返回 `LlmResponse`
- 流式场景返回 `Flux<LlmChunk>`
- 出错时统一抛 `LlmException`

也就是说，对外真正稳定的边界，只有这两个方法：

```java
LlmResponse chat(LlmRequest request);

Flux<LlmChunk> stream(LlmRequest request);
```

这两个方法就是我们的稳定外壳。

那么重构时最重要的一条约束也就出来了：

> `LlmClient` 接口不动，`OpenAiCompatibleLlmClient` 这个对外门面不消失，  
> 但它内部不该再承担所有细节。

这就是这一节的重构边界。

不是推翻，不是重写，也不是“重新发明一个框架”。

而是：

> 保留稳定接口，拆掉混杂职责。

---

### 先识别坏味道：问题不是 500 行，而是 8 类职责混在一起

在重构之前，我先看了一遍 4.10 结束时的 `OpenAiCompatibleLlmClient`。

它大约有 529 行。

但我并没有把“529 行”当成唯一问题。

因为有些类很长，但职责依旧单一；有些类不算特别长，但混进了完全不同的变化原因，那同样很危险。

这个类真正的问题，是它同时承担了至少这几类职责：

1. Provider 配置解析与 `WebClient` 缓存
2. 默认模型选择与多模态模型选择
3. 请求对象到 OpenAI 兼容协议对象的映射
4. tool calling 字段的协议适配
5. HTTP 调用本身
6. SSE 流式解析
7. 普通响应 JSON 解析
8. 超时、重试、错误映射

你会发现，这 8 类职责根本不是一个变化维度。

举几个很现实的例子：

- 如果以后 provider 配置结构变了，应该改哪？
- 如果以后多模态模型选择规则变了，应该改哪？
- 如果以后响应里加了新的字段，比如结构化输出元数据，应该改哪？
- 如果以后重试策略要接入 Provider fallback，应该改哪？

如果所有答案都是：

> 去改 `OpenAiCompatibleLlmClient`

那就说明这个类已经成为复杂度汇合点了。

所以这次重构的目标，不是“把 529 行缩成 100 行”这么肤浅。

真正的目标是：

> 让不同类型的变化，回到不同的落点。

---

### 第一步：先抽 `LlmProviderRegistry`

先看最明显的一类职责。

在旧实现里，`OpenAiCompatibleLlmClient` 自己做了这些事：

- 读取 `LlmProperties`
- 遍历 `providers`
- 规范化 endpoint
- 创建 `WebClient`
- 缓存不同 provider 对应的 client
- 根据 `providerId` 或默认模型决定该用哪个 client

这些逻辑本身都没错。

但问题是，它们和“HTTP 请求怎么发”“SSE 怎么解析”不是一件事。

所以第一步，我先抽出了：

- `LlmProviderRegistry`
- `ResolvedLlmContext`

这里 `LlmProviderRegistry` 只做一件事：

> 根据当前配置和当前请求，解析出“本次调用到底该走哪个 provider / 哪个 WebClient”。

而 `ResolvedLlmContext` 是一个很小的上下文对象，负责把这次调用真正需要的运行时信息收在一起：

- `providerId`
- `LlmProviderConfig`
- `WebClient`
- 是否 legacy 模式

它的价值并不在于“多定义了一个类”，而在于它阻止了另一种坏味道：

> 零散参数满天飞。

如果没有这个上下文，后面 `mapper`、`execution support`、`client facade` 之间就会来回传：

- `providerId`
- `provider`
- `webClient`
- `legacyMode`

这种代码不是不能写，而是很快就会变得啰嗦又脆弱。

所以 `Registry + Context` 是这次重构的第一刀，也是最关键的一刀：

> 先把“本次调用的执行上下文”明确下来。

---

### 第二步：抽 `LlmRequestMapper`

Provider 解析拿出去以后，第二类最明显的职责，就是请求映射。

旧版本里，`OpenAiCompatibleLlmClient` 同时负责：

- 判断走哪个模型
- 判断是不是多模态请求
- 校验指定模型是不是多模态模型
- 给 `temperature` / `maxTokens` 补默认值
- 把 `LlmRequest.Message` 转成协议层的 `ChatMessage`
- 把 tool calling 字段适配成 OpenAI 兼容格式

这些逻辑的共同点是：

> 它们都属于“请求映射”，而不是“调用执行”。

所以第二步，我抽出了 `LlmRequestMapper`，以及协议对象 `OpenAiChatCompletionRequest`。

这样做之后，分层会非常清楚：

- `LlmRequest`：业务层请求模型
- `OpenAiChatCompletionRequest`：OpenAI 兼容协议请求模型
- `LlmRequestMapper`：负责从前者映射到后者

这一步的意义非常大。

因为一旦把“请求映射”独立出来，后面你再扩展：

- 结构化输出字段
- `response_format`
- tool choice 更复杂的形式
- 多 Provider 特有请求参数

你都知道应该优先往 mapper 这层看，而不是回头把门面类继续写胖。

这里也顺便解决了一个课程里一直在强调的问题：

> 业务模型和协议模型不要混在一起。

前面 4.10 我们已经把多模态的 `Object content` 限制在 client 内部。

这次重构，本质上是把这个思路继续做彻底：

> 协议适配，统一收进 mapper。

---

### 第三步：抽 `LlmResponseParser`

旧版 `OpenAiCompatibleLlmClient` 里，响应处理也混在主调用链中：

- 普通 `chat` 响应解析
- `tool_calls` 解析
- usage 解析
- SSE delta 解析
- `[DONE]` 处理
- 非法 SSE JSON 忽略

这些逻辑本身没有状态，也不依赖 `WebClient`。

所以它们本质上就是另一种纯职责：

> 解析，不是执行。

于是第三步，我把它们抽成了 `LlmResponseParser`。

抽出来之后，有两个非常实际的好处。

第一个好处，是测试变简单了。

以前如果你想验证一段 SSE 解析逻辑，通常会被迫把 HTTP server、WebClient、流式调用链一起带进来。

但现在可以直接写：

```java
Optional<LlmChunk> chunk = parser.parseSseLine(
    "data: {\"choices\":[{\"delta\":{\"content\":\"hello\"},\"finish_reason\":null}]}"
);
```

这样测试会非常聚焦。

第二个好处，是后续扩展点变得清楚。

以后如果你再加：

- 结构化输出结果解析
- 更完整的 tool_calls 解析
- 多模态输出的特殊字段

这些都应该优先进入 parser，而不是继续塞回主 client。

这就是为什么企业里常说：

> 可测试的边界，通常也是更好的设计边界。

---

### 第四步：抽 `LlmExecutionSupport`

如果说 `Registry` 解决的是“找谁发”，`Mapper` 解决的是“怎么组请求”，`Parser` 解决的是“怎么读响应”，

那还剩下一类很容易把主流程写乱的代码：

- timeout
- retry
- HTTP error mapping
- 网络异常映射
- 最终统一成 `LlmException`

这些逻辑非常重要，但它们不属于业务流程本身。

如果门面类里同时写着：

- 发请求
- 配 timeout
- 配 retry
- 判断 HTTP 状态码
- 解析 error payload
- 映射成 `LlmException`

那主流程读起来就会越来越像“异常与底层工具的拼装器”。

所以第四步，我把这部分单独抽成了 `LlmExecutionSupport`。

这样以后如果你要改：

- 重试次数
- 退避策略
- 401/429/5xx 的处理语义
- timeout 规则

你直接就知道该去这一层。

而门面类不需要关心这些细枝末节，只需要说：

> 这是一次 chat 执行。  
> 这是一次 stream 执行。

这一步对“企业味”的提升特别大。

因为很多基础设施代码最后变乱，不是因为业务不清楚，而是因为：

> 执行细节、错误细节、业务流程细节全部写在一起了。

---

### 第五步：最后再瘦门面类

前面四步做完以后，`OpenAiCompatibleLlmClient` 的职责终于回到了它应该的位置：

> 它不是工具方法仓库，而是协作对象的协调者。

重构后的主流程大致是这样的：

```java
@Override
public LlmResponse chat(LlmRequest request) {
    ResolvedLlmContext context = providerRegistry.resolve(request);
    OpenAiChatCompletionRequest apiRequest = requestMapper.map(request, context, false);

    LlmResponse response = executionSupport.executeChat(context, apiRequest)
            .map(responseParser::parseChat)
            .onErrorMap(executionSupport::asLlmException)
            .block();

    if (response == null) {
        throw new LlmException(LlmErrorType.INVALID_RESPONSE, false, null, "LLM returned an empty response");
    }
    return response;
}
```

你会发现，这段代码终于开始像“业务流程”了：

1. 先解析执行上下文
2. 再映射请求
3. 再执行调用
4. 最后解析结果

而不是像旧版那样，一路夹杂着：

- endpoint 归一化
- provider 查找
- 多模态模型判断
- JSON 解析
- SSE 解析
- timeout
- retry
- 错误映射

这里还有一个结果很直观：

重构后，`OpenAiCompatibleLlmClient` 本体只剩大约 73 行。

但我还是要强调一句：

> 73 行不是目标，职责清晰才是目标。

如果只是为了追求行数少，把大量逻辑抽进一堆含糊不清的 util 类，那不叫重构，只叫搬家。

这次我们真正做成的，是：

> 门面类重新变成门面类。

---

### 测试怎么证明这次重构没有改坏行为？

重构最危险的地方，不是“类拆多了”，而是：

> 你一边整理结构，一边悄悄把行为改掉了。

所以这次我刻意把测试分成了两层。

第一层，是原来已经存在的外部行为测试，继续当重构护栏：

- `OpenAiCompatibleLlmClientMultiProviderTest`
- `OpenAiCompatibleLlmClientReliabilityTest`
- `OpenAiCompatibleLlmClientStreamTest`
- `OpenAiCompatibleLlmClientMultimodalGuardTest`
- `OpenAiCompatibleLlmClientMultimodalTest`

这些测试的意义，不是验证某个内部类，而是验证：

> 不管你内部怎么拆，对外的 `chat()` 和 `stream()` 行为都不能变。

第二层，是新加的组件测试：

- `LlmProviderRegistryTest`
- `LlmRequestMapperTest`
- `LlmResponseParserTest`

这些测试不是为了“刷覆盖率”，而是为了给新边界建立最小可信约束：

- provider 到底怎么解析
- 多模态模型到底怎么选
- SSE chunk 到底怎么读
- tool_calls 和 usage 到底怎么还原

也就是说，这次测试策略不是“全改成内部测试”，也不是“只靠集成测试赌一把”。

而是：

> 外部行为测试保稳定，内部组件测试保边界。

这就是企业里做基础设施重构时，很常见的一种组合。

---

### 这次重构真正要记住什么？

如果只看表面，这一节像是在做代码整理。

但更底层一点，你真正应该记住的是四条工程原则。

1. **稳定接口先于内部实现**
   - `LlmClient` 接口没变
   - 先保住外部边界，再整理内部结构

2. **按变化原因拆分，而不是按文件大小拆分**
   - Provider 解析是一类变化
   - 请求映射是一类变化
   - 响应解析是一类变化
   - 执行策略是一类变化

3. **门面类应该负责协调，不应该负责所有细节**
   - `OpenAiCompatibleLlmClient` 不是工具箱
   - 它应该只串联上下文、映射、执行、解析

4. **重构不是“代码更短”，而是“扩展点更清楚”**
   - 后面加结构化输出、Tool Calling、Provider fallback
   - 都应该能自然找到归属层，而不是继续堆回一个 God Object

如果你把这四件事吃透，后面你写 Agent 基础设施代码时，会少走很多弯路。

因为 Agent 系统和普通 CRUD 不一样，它的基础组件天然容易往“万能类”方向膨胀。

你越早建立这种结构意识，后面系统越稳。

---

### 验证命令

```bash
./mvnw -Dtest=LlmProviderRegistryTest,LlmRequestMapperTest,LlmResponseParserTest test
./mvnw -Dtest=OpenAiCompatibleLlmClientMultiProviderTest,OpenAiCompatibleLlmClientReliabilityTest,OpenAiCompatibleLlmClientStreamTest,OpenAiCompatibleLlmClientMultimodalGuardTest test
./mvnw test
```

在我的实现里，这些测试一起通过之后，才说明这次重构成立：

- 新边界能单独被验证
- 老行为没有被破坏

---

### 本节小结

- 我们没有继续堆新功能，而是停下来专门做了一次客户端重构
- 我们先从变化原因出发，识别出旧版 `OpenAiCompatibleLlmClient` 的职责混杂问题
- 我们抽出了 `LlmProviderRegistry` 和 `ResolvedLlmContext`
- 我们抽出了 `LlmRequestMapper`，把业务请求和协议请求重新分层
- 我们抽出了 `LlmResponseParser`，把 chat 解析和 SSE 解析从调用链里拿出去
- 我们抽出了 `LlmExecutionSupport`，把 timeout、retry 和错误映射统一收口
- 我们把 `OpenAiCompatibleLlmClient` 拉回了协调者角色
- 我们用“旧行为护栏 + 新组件测试”证明这次重构没有改坏系统

第四章到这里就结束了。

你现在拿到的，已经不只是一个“能调用模型”的客户端，而是一个：

> 能继续长、也能继续维护的 LLM 客户端骨架。
