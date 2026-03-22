---
title: "第5章：WebSocket 网关与 RPC 协议"
summary: "围绕 Gateway 的 WebSocket 接入、RPC 协议、EventBus、Session 状态机与并发控制，搭建 MiniClaw 的实时入口层。"
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

这一章不再继续扩展 LLM Client，而是往上搭一层真正的 Gateway。

从课程结构上看，第4章解决的是“如何稳定地调用模型”，第5章解决的是“如何把这些能力通过一个统一入口暴露出去”。

这一章的目标不是做一个简单的 Echo WebSocket Demo，也不是把 CLI、数据库、多轮对话持久化一口气全塞进来，而是先把 Gateway 这一层单独做对：

- 有统一的 WebSocket 入口
- 有统一的 RPC 协议
- 有统一的路由分发
- 有统一的事件出站模型
- 有明确的 Session 状态边界
- 有可靠的同 Session 并发控制

只有这一层站稳了，后面的 CLI 接入、会话持久化、上下文管理、Agent 执行链，才有一个可以继续演进的实时入口。

## 本章边界

为了让这一章聚焦，我们先把边界明确写死：

- 这一章只做 Gateway，不做 CLI
- `session` 先采用内存态管理，不落数据库
- 不做多轮对话上下文的可靠存储
- 不讲数据库表设计、消息持久化和历史恢复
- 最终验收方式是用 WebSocket 调试工具把 Gateway 跑通

这意味着第5章的重点不是“产品功能做完”，而是：

> 把一个支持流式 AI 输出的 WebSocket Gateway 架构先搭完整。

## 学习目标

完成本章后，你将能够：

- 理解为什么 Agent 系统需要一个统一的 WebSocket Gateway，而不是零散的接口集合
- 设计一套统一的 RPC over WebSocket 协议，承载 request、event、completed、error
- 用发布-订阅模式实现响应式 EventBus，解耦业务处理与消息出站
- 用状态机管理 Session 生命周期，明确哪些任务流转合法、哪些不合法
- 用 Reactor 模式通过 SessionLane 保证同一个 Session 下的任务串行执行
- 打通从用户请求到模型流式输出的完整实时数据流

## 前置知识

- **第4章**：LLM 客户端（LlmClient、LlmRequest、LlmResponse）
- Spring WebFlux 基础
- Reactor 响应式编程

## 本章要回答的问题

这一章会集中回答下面这些问题：

- 为什么 Agent 需要 WebSocket Gateway，而不是直接让前端分散调用后端能力？
- 如何基于发布-订阅模式实现响应式 EventBus？
- 如何设计状态机解决 Session 状态管理问题？
- 如何通过状态机控制任务流转的正确性？
- 如何用 Reactor 模式通过 SessionLane 实现并发控制？
- 如何构建从用户输入到 AI 回复的完整数据流？

下面这个问题不会放进第5章，而会留到后续章节：

- 如何设计策略可靠存储多轮对话上下文？

## 章节目录（规划版）

- [5.1 为什么 Agent 需要 WebSocket Gateway](/courses/miniclaw/chapter-05/why-websocket)
- [5.2 WebSocket 网关基础配置与连接模型](/courses/miniclaw/chapter-05/websocket-config)
- [5.3 连接模型与 SessionRegistry](/courses/miniclaw/chapter-05/connection-manager)
- [5.4 RPC 协议设计：Request / Event / Completed / Error](/courses/miniclaw/chapter-05/rpc-protocol)
- [5.5 RpcRouter：如何把所有能力统一路由到 Gateway](/courses/miniclaw/chapter-05/rpc-router)
- [5.6 如何基于发布-订阅模式实现响应式 EventBus](/courses/miniclaw/chapter-05/event-bus)
- [5.7 Session 状态机：状态管理与任务流转正确性](/courses/miniclaw/chapter-05/session-state-machine)
- [5.8 如何用 Reactor 模式通过 SessionLane 实现并发控制](/courses/miniclaw/chapter-05/session-lane)
- [5.9 如何构建从用户输入到 AI 回复的完整数据流](/courses/miniclaw/chapter-05/chat-send-flow)
- 5.10 用 WebSocket 调试工具跑通完整 Gateway（待更新）

## 核心架构

```
WebSocket 调试工具 / CLI（后续章节）
    ↕ WebSocket
GatewayWebSocketHandler
    ↕ 解析 RPC 请求
RpcRouter
    ↙                ↘
SessionHandler      ChatHandler
    ↕                  ↕
SessionRegistry       LlmClient（第4章）
SessionStateMachine   ↕
SessionLane           GatewayEventBus
    ↘                  ↙
       OutboundDispatcher
              ↕
          WebSocket 出站消息
```

## 设计要点

这一章有三个最容易写歪的地方，我们在索引页先把它们说明白：

1. **WebSocket 只是通道，RPC 才是 Gateway 的骨架**
   如果没有统一协议，后面 `chat.send`、`session.create`、`session.close` 很快就会长成多套消息格式。

2. **Session 不是一个普通 Map，而是有状态的业务对象**
   如果没有状态机，Gateway 根本没法判断“当前请求是否合法”。

3. **状态机还不够，还必须有 SessionLane**
   状态机解决的是“能不能做”，SessionLane 解决的是“两个请求同时进来怎么办”。

## 最终成果

- 一个只聚焦 Gateway 的 WebSocket 入口层
- 一套统一的 RPC over WebSocket 协议
- 一个响应式的进程内 EventBus
- 一套内存态 Session 管理与状态机约束
- 一个基于 SessionLane 的同会话串行执行模型
- 一条从 `chat.send` 到模型流式输出再回推客户端的完整数据流

## 本章结果

学完这一章，你拿到的不会只是一个“能连上 WebSocket 的服务器”，而会是一个真正能承接后续 Agent 系统的实时入口：

- 未来 CLI 只需要按协议接入，不需要重新发明通信层
- 未来数据库与上下文持久化可以挂在 Session 体系之下，而不是反过来侵入网关
- 未来工具调用、实时事件推送、执行中断与状态观察，都可以继续沿着这套 Gateway 结构自然扩展
