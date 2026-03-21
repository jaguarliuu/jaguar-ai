---
title: "第1章：AI Agent 现象、范式与系统全景"
summary: "先不急着写代码，先看清 AI Agent 为什么在 2026 年集体爆发、OpenClaw 为什么能迅速破圈，以及 MiniClaw 这门课到底要带你搭建什么。"
slug: chapter-01
date: 2026-03-21
tags:
  - course
  - miniclaw
  - agent
order: 1
duration: "2.5 hours"
status: updating
---

## 章节概述

很多人第一次接触 Agent，都容易掉进两个极端。

第一个极端是把它当成“会调用工具的聊天机器人”，于是只盯着模型、Prompt 和工具调用。

第二个极端是把它当成“无所不能的自动员工”，于是直接跳到商业神话、工作替代和全自动公司。

这两种理解都不够准确。

这一章的目标，是先把 Agent 放回一个更完整的观察框架里：

- 它为什么会在这个时间点爆发
- 它到底解决了什么新问题
- 它和过去的聊天机器人、Copilot、自动化脚本有什么本质区别
- 一个真正可落地的 Agent 系统，底层到底由哪些层组成

所以第 1 章不是“实现章”，而是“认知章”。
它要先帮你建立判断力，再进入后面的工程实现。

## 本章边界

这一章只做三件事：

- 解释现象
- 建立概念
- 画出 MiniClaw 的整体地图

这一章暂时不做：

- Java 项目初始化
- Spring Boot 代码实现
- LLM Client 编码
- WebSocket Gateway 编码
- 数据库或持久化落地

也就是说，这一章的任务不是把代码跑起来，而是把“为什么值得做”“为什么这么设计”“后面会做到哪里”讲明白。

## 学习目标

学完这一章，你应该能回答下面这些问题：

- 为什么 OpenClaw 这样的项目能在极短时间内获得大规模关注
- 为什么 Agent 不是“对话工具 + 工具调用”的简单叠加
- 为什么 Agent 的真正价值，不在模型本身，而在入口、上下文、执行和反馈闭环
- 为什么多 Agent 协作很多时候比“一个超级 Agent”更现实
- 为什么这门课要手写 MiniClaw，而不是直接堆框架
- MiniClaw 五层架构各自负责什么
- 这门课的学习路径，为什么是从“使用者”走向“创造者”

## 本章目录

- [1.1 OpenClaw 现象深度解析：为什么能在极短时间内获得 10 万+ Star？](/courses/miniclaw/chapter-01/openclaw-phenomenon)
- [1.2 Moltbook 震撼实验：120 万 AI Agent 的“社交网络”揭示了什么？](/courses/miniclaw/chapter-01/moltbook-social-network)
- 1.3 从“对话工具”到“数字员工”：Agent 的三次范式转变（待更新）
- 1.4 Agent 能做什么？真实案例：自主买车、代码迁移、40 小时深度调研（待更新）
- 1.5 Multi-Agent 协作：为什么“一群 Agent”比“一个超级 Agent”更强？（待更新）
- 1.6 AI Agent 简史：从 ELIZA 到 OpenClaw 的 50 年演进（待更新）
- 1.7 Agent 生态全景：OpenAI、Anthropic、Google、国产厂商的布局（待更新）
- 1.8 手写框架 vs LangChain / Spring AI：为什么要“重造轮子”？（待更新）
- 1.9 MiniClaw 五层架构全景图：一张图看懂 Agent 系统设计（待更新）
- 1.10 MiniClaw 全局规划：从 MVP 到企业级的演进路线（待更新）
- 1.11 课程学习路线图：从“使用者”到“创造者”的三阶段（待更新）

## 本章结果

学完这一章，你不会立刻得到一套能运行的 Agent 代码。

但你会得到比“跑通一个 Demo”更重要的东西：

- 一个判断 Agent 热点的分析框架
- 一套拆解 Agent 产品与系统设计的方法
- 一个对 MiniClaw 全课程的整体地图

这会让你在后面进入编码章节时，不是机械照着写，而是知道每一层为什么存在。
