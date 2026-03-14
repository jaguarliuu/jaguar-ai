---
title: "第5章：WebSocket 网关与实时通信"
summary: "从 WebSocket 网关开始，搭建 MiniClaw 的实时通信与 RPC 基础设施。"
slug: chapter-05
date: 2026-03-14
tags:
  - course
  - miniclaw
  - websocket
order: 5
duration: "3 hours"
status: updating
---

## 章节概述

本章从零构建一个支持实时通信的 WebSocket 网关，解决 AI Agent 与用户的双向通信问题。

## 学习目标

完成本章后，你将能够：

- 理解 WebSocket 的优势和适用场景
- 实现自定义 RPC 协议（Request/Response/Event）
- 使用策略模式构建灵活的 RPC 路由器
- 实现发布-订阅模式的事件总线
- 管理会话状态和并发控制
- 构建完整的实时对话流程

## 前置知识

- **第4章**：LLM 客户端（LlmClient、LlmRequest、LlmResponse）
- Spring WebFlux 基础
- Reactor 响应式编程

## 章节目录

- [5.1 为什么用 WebSocket](/courses/miniclaw/chapter-05/why-websocket)
- [5.2 WebSocket 基础配置](/courses/miniclaw/chapter-05/websocket-config)
- [5.3 连接管理器](/courses/miniclaw/chapter-05/connection-manager)
- [5.4 RPC 协议设计](/courses/miniclaw/chapter-05/rpc-protocol)
- 5.5 RPC Router（待更新）
- 5.6 实现 EchoHandler（待更新）
- 5.7 EventBus（待更新）
- 5.8 Session 管理（待更新）
- 5.9 SessionLane 并发控制（待更新）
- 5.10 实现 ChatHandler（待更新）

## 核心架构

```
用户浏览器
    ↕ WebSocket
GatewayWebSocketHandler
    ↕ RPC 协议
RpcRouter
    ↕ 策略模式
Handler (Echo/Chat/etc)
    ↕ 调用
LlmClient (第4章)
    ↕ 推送
EventBus → WebSocket
```

## 最终成果

- WebSocket 服务器（支持连接管理）
- RPC 协议（Request/Response/Event 三元模型）
- RPC Router（策略模式分发）
- EventBus（发布-订阅）
- ChatHandler（完整的对话流程）
