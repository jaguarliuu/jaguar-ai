---
title: "第4章：从零手写 LLM 客户端"
summary: "从接口设计、HTTP 调用、流式输出到可靠性、多模型、多模态与客户端重构，完整搭建 MiniClaw 的 LLM 客户端层。"
slug: chapter-04
date: 2026-03-14
tags:
  - course
  - miniclaw
  - llm
order: 4
duration: "4 hours"
status: published
---

这一章进入 MiniClaw 的核心能力层。目标不是接一个现成 SDK 就结束，而是亲手把 LLM 调用链路拆开：接口、模型、协议、同步调用、流式输出、错误处理、多提供商适配、多模态支持，以及一次面向维护性的客户端重构。

## 学习目标

- 理解为什么课程选择手写客户端，而不是直接依赖框架
- 搭建统一的接口与数据模型，明确请求和响应边界
- 掌握同步调用与流式调用的实现差异
- 让客户端具备错误处理、重试、多模型适配和多模态扩展能力
- 理解为什么功能完成之后，还要专门做一次结构重构
- 为后续 Agent 执行链、工具调用和实时推送打下稳定基础

## 章节目录

- [4.1 为什么不用 Spring AI](/courses/miniclaw/chapter-04/llm-architecture)
- [4.2 接口与数据模型](/courses/miniclaw/chapter-04/llm-models)
- [4.3 HTTP 客户端基础](/courses/miniclaw/chapter-04/http-client)
- [4.4 同步调用实现](/courses/miniclaw/chapter-04/llm-sync)
- [4.5 SSE 协议原理](/courses/miniclaw/chapter-04/sse-protocol)
- [4.6 流式输出实现](/courses/miniclaw/chapter-04/llm-stream)
- [4.7 结构化异常](/courses/miniclaw/chapter-04/error-handling)
- [4.8 重试与指数退避](/courses/miniclaw/chapter-04/retry-backoff)
- [4.9 多模型适配](/courses/miniclaw/chapter-04/multi-provider)
- [4.10 多模态支持](/courses/miniclaw/chapter-04/multimodal)
- [4.11 客户端重构](/courses/miniclaw/chapter-04/client-refactor)

## 本章总结

第四章到这里，实际上已经把 MiniClaw 最核心的一层基础设施搭起来了。

这一章我们不是“调通一次模型调用”就结束，而是沿着一条完整的工程链路，把一个真正可扩展的 LLM Client 从零写了出来：

- 先定义统一接口和数据模型，稳住 `LlmClient`、`LlmRequest`、`LlmResponse` 这些核心边界
- 再补齐同步调用和流式调用，让客户端既能返回完整结果，也能处理 SSE 增量输出
- 接着加入结构化异常、重试和指数退避，把“能调用”推进到“调用失败时也能兜住”
- 然后扩展多 Provider 和多模态能力，让同一个客户端开始具备面向真实业务演进的空间
- 最后通过 4.11 的重构，把不断膨胀的 `OpenAiCompatibleLlmClient` 重新拆回可维护结构

如果只看表面，这一章写了很多功能；但更重要的是，你应该开始建立一个判断标准：

> 一个企业级的 LLM Client，不只是能发 HTTP 请求，而是要同时具备清晰边界、协议适配能力、可靠性保障，以及后续持续演进的结构基础。

## 章节结果

学完这一章，你现在手里已经有的，不再只是一个“能连上模型”的 demo，而是一个具备下面这些特征的客户端骨架：

- 对外接口稳定，后续继续演进时不需要频繁推翻调用层
- 能同时支持 chat 和 stream 两条核心调用链路
- 能把错误分类、重试策略和超时控制收敛到客户端内部
- 能根据 Provider 配置切换模型服务，并区分文本模型和多模态模型
- 在功能逐步补齐之后，仍然能通过重构把复杂度拉回可维护状态

这也是为什么第四章会以“客户端重构”收尾。

因为真正的工程化能力，不体现在你一口气堆了多少功能，而体现在：

> 当功能变多之后，你还能不能把系统整理回一个继续长、也继续能维护的结构。

接下来进入 Agent 层时，你会明显感受到第四章的重要性。
后面的工具调用、记忆、执行链编排、实时事件推送，都会直接站在这一章搭好的客户端基础之上继续往前走。
