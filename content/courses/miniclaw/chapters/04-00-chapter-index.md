---
title: "第4章：从零手写 LLM 客户端"
summary: "从接口设计、HTTP 调用、流式输出到可靠性、多模型、多模态与结构化输出，完整搭建 MiniClaw 的 LLM 客户端层。"
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

这一章进入 MiniClaw 的核心能力层。目标不是接一个现成 SDK 就结束，而是亲手把 LLM 调用链路拆开：接口、模型、协议、同步调用、流式输出、错误处理、多提供商适配、多模态支持，以及结构化输出。

## 学习目标

- 理解为什么课程选择手写客户端，而不是直接依赖框架
- 搭建统一的接口与数据模型，明确请求和响应边界
- 掌握同步调用与流式调用的实现差异
- 让客户端具备错误处理、重试、多模型适配和多模态扩展能力
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
- [4.11 结构化输出](/courses/miniclaw/chapter-04/structured-output)

## 章节结果

学完这一章，你会得到一个可扩展的 LLM 客户端骨架。后续无论接 OpenAI 兼容接口、国内模型服务，还是把客户端接入 WebSocket 网关与 Agent 工作流，都会更顺手。
