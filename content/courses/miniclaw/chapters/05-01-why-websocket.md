---
title: "第5.1节：为什么用 WebSocket？"
summary: "说明 AI Agent 场景里为什么需要 WebSocket，而不是只依赖 HTTP。"
slug: why-websocket
date: 2026-03-14
tags:
  - course
  - miniclaw
  - websocket
order: 1
status: published
---

> **学习目标**：理解 WebSocket 的优势，知道什么时候用它
> **预计时长**：15 分钟

---

### 核心问题：实时通信为什么需要 WebSocket？

**真实场景**：

```
用户：在聊天框输入 "帮我写一段代码"
系统：[等待 5 秒]
系统：返回完整的代码（500 行）
用户：[等了 5 秒才知道发生了什么]
```

**问题**：
1. **等待时间长**：用户不知道系统在做什么
2. **体验差**：突然出现一大段代码
3. **无法取消**：开始处理后就不能停止

**理想体验**：

```
用户：输入 "帮我写一段代码"
系统：立即显示 "正在思考..."
系统：逐字显示 "我"、"来"、"帮"、"你"...
用户：看到实时的输出过程
用户：可以随时点击"停止"
```

---

### HTTP vs WebSocket 对比

**HTTP 的问题**：

| 特性 | HTTP | 影响 |
|------|------|------|
| 通信模式 | 半双工（客户端请求 → 服务端响应） | 服务端无法主动推送 |
| 连接 | 短连接（每次请求都新建） | 延迟高，开销大 |
| 实时性 | 差（轮询或长轮询） | 浪费资源 |

**WebSocket 的优势**：

| 特性 | WebSocket | 影响 |
|------|-----------|------|
| 通信模式 | 全双工（双向通信） | 服务端可主动推送 |
| 连接 | 长连接（一次连接，多次通信） | 低延迟，高效 |
| 实时性 | 好（真正的实时） | 用户体验佳 |

---

### 场景对比：流式输出

**场景**：LLM 返回 1000 字的响应

**HTTP 实现**：
```
用户发送请求
  ↓
服务端调用 LLM（5 秒）
  ↓
服务端返回完整响应
  ↓
用户看到完整内容（5 秒后）
```

**WebSocket 实现**：
```
用户发送请求
  ↓
服务端立即返回 runId
  ↓
服务端调用 LLM（流式）
  ↓
每收到一个 token 就推送
  ↓
用户看到逐字输出（实时）
```

**对比**：
- HTTP：等待 5 秒 → 突然看到 1000 字
- WebSocket：立即反馈 → 逐字显示 1000 字

---

### WebSocket 在 AI Agent 中的应用

**典型场景**：

1. **流式输出**：LLM 逐字返回
2. **状态推送**：Agent 开始/结束/出错
3. **工具调用**：显示正在调用什么工具
4. **多轮对话**：保持长连接，避免重复认证

**JaguarClaw 的实践**：

```
用户发送：{"type":"request","method":"agent.run","payload":{...}}
  ↓
服务端返回：{"type":"response","id":"xxx","payload":{"runId":"run-123"}}
  ↓
服务端推送：{"type":"event","event":"lifecycle.start","runId":"run-123"}
  ↓
服务端推送：{"type":"event","event":"assistant.delta","runId":"run-123","payload":{"delta":"你好"}}
  ↓
服务端推送：{"type":"event","event":"lifecycle.end","runId":"run-123"}
```

**关键**：
- Request/Response：请求-响应模型（同步）
- Event：服务端主动推送（异步）

---

### WebSocket 协议基础

**握手过程**：

```
客户端：GET /ws HTTP/1.1
        Upgrade: websocket
        Connection: Upgrade
        Sec-WebSocket-Key: xxx

服务端：HTTP/1.1 101 Switching Protocols
        Upgrade: websocket
        Connection: Upgrade
        Sec-WebSocket-Accept: xxx
```

**数据帧格式**：
```
+-----------------+
| FIN | RSV | OPC |
+-----------------+
| MASK | PAYLOAD  |
+-----------------+
|    PAYLOAD      |
+-----------------+
```

**好消息**：Spring WebFlux 封装了这些细节，我们只需要实现 `WebSocketHandler` 接口。

---

### 什么时候用 WebSocket？

**适合**：
- ✅ 实时聊天
- ✅ 流式输出（LLM）
- ✅ 协作编辑
- ✅ 游戏/实时数据
- ✅ 需要服务端推送

**不适合**：
- ❌ 简单的 CRUD 操作
- ❌ 不需要实时推送
- ❌ 低频请求

**AI Agent 场景**：✅ 非常适合（需要流式输出和状态推送）

---

### 本节小结

- WebSocket 解决了 HTTP 无法实时推送的问题
- 核心优势：全双工、长连接、实时性
- AI Agent 场景：流式输出、状态推送
- Spring WebFlux 提供了简洁的 WebSocket 支持

---

### 自检：你真的掌握了吗？

**问题 1**：WebSocket 与 HTTP 的核心区别是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**核心区别**：

1. **通信模式**：
   - HTTP：半双工（客户端请求 → 服务端响应）
   - WebSocket：全双工（双向通信）

2. **连接**：
   - HTTP：短连接（每次请求新建）
   - WebSocket：长连接（一次连接，多次通信）

3. **推送能力**：
   - HTTP：服务端无法主动推送
   - WebSocket：服务端可以主动推送

</details>

---

**问题 2**：AI Agent 场景为什么适合用 WebSocket？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**适合的原因**：

1. **流式输出**：LLM 返回内容需要逐字显示
2. **状态推送**：Agent 的生命周期事件需要实时通知
3. **长对话**：多轮对话保持连接，避免重复认证
4. **用户体验**：实时反馈比等待完整响应更好

**对比 HTTP**：
- HTTP：等待 → 完整响应
- WebSocket：立即反馈 → 逐字显示

</details>

---

**问题 3**：Request/Response/Event 三元模型的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**三元模型**：

1. **Request（请求）**：
   - 客户端主动发起
   - 如：`{"type":"request","method":"agent.run",...}`

2. **Response（响应）**：
   - 服务端响应请求
   - 如：`{"type":"response","id":"xxx","payload":{...}}`

3. **Event（事件）**：
   - 服务端主动推送
   - 如：`{"type":"event","event":"assistant.delta",...}`

**为什么需要三种**：
- Request/Response：处理同步请求
- Event：处理异步推送（流式输出）

</details>
