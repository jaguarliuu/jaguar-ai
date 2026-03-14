---
title: "第5.4节：RPC 协议设计 - Request/Response/Event 三元模型"
summary: "设计 Request、Response、Event 三元 RPC 协议，约束实时消息格式。"
slug: rpc-protocol
date: 2026-03-14
tags:
  - course
  - miniclaw
  - rpc
order: 4
status: published
---

> **学习目标**：设计自定义 RPC 协议，实现请求-响应-事件的三元模型
> **预计时长**：25 分钟

---

### 核心问题：如何设计统一的消息格式？

**真实场景**：

```
用户：发送请求 "运行 Agent"
服务端：返回响应 "已接收，runId=xxx"
服务端：推送事件 "Agent 开始运行"
服务端：推送事件 "输出：你好"
服务端：推送事件 "Agent 运行结束"
```

**问题**：
1. 如何区分请求、响应、事件？
2. 如何关联请求和响应？
3. 如何表示成功和失败？

---

### 对比：有 vs 无统一协议

**无统一协议**：

```java
// ❌ 每种消息格式不同
String handleChat(String message);
String handleToolCall(String toolName, String params);
void pushEvent(String event);
```

**问题**：
- 客户端需要知道每种消息的格式
- 难以扩展新的消息类型
- 错误处理不统一

**有统一协议**：

```java
// ✅ 统一的消息格式
RpcResponse handle(RpcRequest request);
void push(RpcEvent event);
```

**好处**：
- 统一的消息格式
- 易于扩展
- 错误处理统一

---

### 三元模型设计

#### Request（请求）

**作用**：客户端 → 服务端，请求执行某个操作

**格式**：
```json
{
  "type": "request",
  "id": "req-123",
  "method": "agent.run",
  "payload": {
    "message": "你好"
  }
}
```

**字段说明**：
- `type`：消息类型，固定为 `"request"`
- `id`：请求 ID，用于关联响应
- `method`：方法名，如 `"agent.run"`、`"session.create"`
- `payload`：请求参数

#### Response（响应）

**作用**：服务端 → 客户端，响应请求

**成功格式**：
```json
{
  "type": "response",
  "id": "req-123",
  "payload": {
    "runId": "run-456"
  }
}
```

**失败格式**：
```json
{
  "type": "response",
  "id": "req-123",
  "error": {
    "code": "INVALID_PARAMS",
    "message": "缺少必要参数"
  }
}
```

**字段说明**：
- `type`：消息类型，固定为 `"response"`
- `id`：请求 ID，与请求对应
- `payload`：响应数据（成功时）
- `error`：错误信息（失败时）

#### Event（事件）

**作用**：服务端 → 客户端，主动推送

**格式**：
```json
{
  "type": "event",
  "event": "assistant.delta",
  "runId": "run-456",
  "payload": {
    "delta": "你好"
  }
}
```

**字段说明**：
- `type`：消息类型，固定为 `"event"`
- `event`：事件名称，如 `"assistant.delta"`、`"lifecycle.start"`
- `runId`：关联的运行 ID
- `payload`：事件数据

---

### 第一步：创建 RpcRequest

**1.1 创建包结构**

```bash
cd ~/clawd/miniclaw-test/backend/src/main/java/com/miniclaw/gateway
mkdir -p rpc/model
```

**1.2 创建 RpcRequest**

创建 `gateway/rpc/model/RpcRequest.java`：

```java
package com.miniclaw.gateway.rpc.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * RPC 请求消息
 * 格式: {"type":"request","id":"xxx","method":"xxx","payload":{...}}
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RpcRequest {

    /**
     * 消息类型，固定为 "request"
     */
    @Builder.Default
    private String type = "request";

    /**
     * 请求 ID，用于关联响应
     */
    private String id;

    /**
     * 方法名，如 "agent.run", "session.create"
     */
    private String method;

    /**
     * 请求参数
     */
    private Object payload;
}
```

**1.3 理解字段**

**为什么需要 `id`？**

**不推荐**：
```
客户端：发送请求
服务端：返回响应
→ 客户端不知道这个响应对应哪个请求
```

**推荐**：
```
客户端：发送 {"id": "req-1", "method": "A"}
客户端：发送 {"id": "req-2", "method": "B"}
服务端：返回 {"id": "req-2", "payload": {...}}
服务端：返回 {"id": "req-1", "payload": {...}}
→ 客户端根据 id 知道响应对应哪个请求
```

---

### 第二步：创建 RpcResponse

**2.1 创建 RpcResponse**

创建 `gateway/rpc/model/RpcResponse.java`：

```java
package com.miniclaw.gateway.rpc.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * RPC 响应消息
 * 格式: {"type":"response","id":"xxx","payload":{...}} 或 {"type":"response","id":"xxx","error":{...}}
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RpcResponse {

    /**
     * 消息类型，固定为 "response"
     */
    @Builder.Default
    private String type = "response";

    /**
     * 请求 ID，与请求对应
     */
    private String id;

    /**
     * 响应数据（成功时）
     */
    private Object payload;

    /**
     * 错误信息（失败时）
     */
    private RpcError error;

    /**
     * 创建成功响应
     */
    public static RpcResponse success(String id, Object payload) {
        return RpcResponse.builder()
                .id(id)
                .payload(payload)
                .build();
    }

    /**
     * 创建错误响应
     */
    public static RpcResponse error(String id, String code, String message) {
        return RpcResponse.builder()
                .id(id)
                .error(new RpcError(code, message))
                .build();
    }

    /**
     * 错误信息
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RpcError {
        private String code;
        private String message;
    }
}
```

**2.2 理解错误处理**

**为什么需要 `code` 和 `message`？**

```json
// ❌ 只有 message
{
  "error": {
    "message": "缺少参数"
  }
}
→ 客户端只能靠字符串匹配判断错误类型

// ✅ 有 code 和 message
{
  "error": {
    "code": "INVALID_PARAMS",
    "message": "缺少必要参数: message"
  }
}
→ 客户端可以根据 code 做逻辑判断
```

---

### 第三步：创建 RpcEvent

**3.1 创建 RpcEvent**

创建 `gateway/rpc/model/RpcEvent.java`：

```java
package com.miniclaw.gateway.rpc.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * RPC 事件消息（服务端主动推送）
 * 格式: {"type":"event","event":"xxx","runId":"xxx","payload":{...}}
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RpcEvent {

    /**
     * 消息类型，固定为 "event"
     */
    @Builder.Default
    private String type = "event";

    /**
     * 事件名称，如 "lifecycle.start", "assistant.delta"
     */
    private String event;

    /**
     * 关联的 runId
     */
    private String runId;

    /**
     * 事件数据
     */
    private Object payload;

    /**
     * 创建事件
     */
    public static RpcEvent of(String event, String runId, Object payload) {
        return RpcEvent.builder()
                .event(event)
                .runId(runId)
                .payload(payload)
                .build();
    }
}
```

**3.2 常见事件类型**

| 事件名称 | 说明 | payload 示例 |
|---------|------|-------------|
| `lifecycle.start` | Agent 开始运行 | `{"agent": "SimpleAgent"}` |
| `lifecycle.end` | Agent 运行结束 | `{"status": "success"}` |
| `assistant.delta` | LLM 增量输出 | `{"delta": "你好"}` |
| `tool.call` | 工具调用 | `{"tool": "calculator"}` |
| `tool.result` | 工具结果 | `{"result": "42"}` |

---

### 第四步：验证编译

```bash
cd ~/clawd/miniclaw-test/backend
./mvnw clean compile
```

---

### 第五步：创建序列化测试

**5.1 创建测试类**

创建 `gateway/rpc/model/RpcModelTest.java`：

```java
package com.miniclaw.gateway.rpc.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 测试 RPC 消息模型序列化
 */
class RpcModelTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void testRequestSerialization() throws Exception {
        // 准备
        RpcRequest request = RpcRequest.builder()
                .id("req-123")
                .method("agent.run")
                .payload(Map.of("message", "你好"))
                .build();

        // 序列化
        String json = mapper.writeValueAsString(request);
        System.out.println("Request JSON: " + json);

        // 验证
        assertTrue(json.contains("\"type\":\"request\""));
        assertTrue(json.contains("\"id\":\"req-123\""));
        assertTrue(json.contains("\"method\":\"agent.run\""));

        // 反序列化
        RpcRequest parsed = mapper.readValue(json, RpcRequest.class);
        assertEquals("req-123", parsed.getId());
        assertEquals("agent.run", parsed.getMethod());

        System.out.println("✅ Request 序列化测试通过");
    }

    @Test
    void testResponseSerialization() throws Exception {
        // 成功响应
        RpcResponse success = RpcResponse.success("req-123", Map.of("runId", "run-456"));
        String successJson = mapper.writeValueAsString(success);
        System.out.println("Success Response: " + successJson);

        assertTrue(successJson.contains("\"type\":\"response\""));
        assertTrue(successJson.contains("\"runId\":\"run-456\""));

        // 错误响应
        RpcResponse error = RpcResponse.error("req-123", "INVALID_PARAMS", "缺少参数");
        String errorJson = mapper.writeValueAsString(error);
        System.out.println("Error Response: " + errorJson);

        assertTrue(errorJson.contains("\"code\":\"INVALID_PARAMS\""));
        assertNull(error.getPayload());
        assertNotNull(error.getError());

        System.out.println("✅ Response 序列化测试通过");
    }

    @Test
    void testEventSerialization() throws Exception {
        // 准备
        RpcEvent event = RpcEvent.of("assistant.delta", "run-456", Map.of("delta", "你好"));

        // 序列化
        String json = mapper.writeValueAsString(event);
        System.out.println("Event JSON: " + json);

        // 验证
        assertTrue(json.contains("\"type\":\"event\""));
        assertTrue(json.contains("\"event\":\"assistant.delta\""));
        assertTrue(json.contains("\"runId\":\"run-456\""));

        // 反序列化
        RpcEvent parsed = mapper.readValue(json, RpcEvent.class);
        assertEquals("assistant.delta", parsed.getEvent());
        assertEquals("run-456", parsed.getRunId());

        System.out.println("✅ Event 序列化测试通过");
    }
}
```

**5.2 运行测试**

```bash
./mvnw test -Dtest=RpcModelTest
```

---

### 本节总结：我们解决了什么问题？

**核心问题**：如何设计统一的消息格式？

**解决方案**：
1. **RpcRequest**：客户端请求，带 `id` 和 `method`
2. **RpcResponse**：服务端响应，支持成功/失败
3. **RpcEvent**：服务端推送，带 `event` 和 `runId`

**关键设计**：
- `type` 字段区分三种消息
- `id` 关联请求和响应
- `error` 统一错误处理
- `@JsonInclude` 不序列化 null 字段

**学完这节，你理解了**：
- 三元模型的作用
- 如何设计统一的消息格式
- JSON 序列化的最佳实践

---

### 验证点

**在继续之前，确保**：

- [ ] RpcRequest 已创建
- [ ] RpcResponse 已创建
- [ ] RpcEvent 已创建
- [ ] 编译通过
- [ ] 序列化测试通过

---

### 动手实践

**任务**：实现 RPC 协议模型

**步骤**：
1. 创建 rpc/model 包
2. 创建 RpcRequest
3. 创建 RpcResponse
4. 创建 RpcEvent
5. 创建序列化测试
6. 运行测试验证

**思考题**：
- 为什么用 `Object` 类型存储 payload？
- 如何支持嵌套的 payload？

---

### 自检：你真的掌握了吗？

**问题 1**：`id` 字段的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**作用**：关联请求和响应

**为什么需要**：
1. **异步通信**：WebSocket 是异步的，响应可能乱序
2. **并发请求**：客户端可能同时发送多个请求
3. **超时处理**：根据 id 知道哪个请求超时了

**示例**：
```
请求 1: {"id": "req-1", "method": "A"}
请求 2: {"id": "req-2", "method": "B"}
响应 2: {"id": "req-2", ...}  // 先返回 B 的结果
响应 1: {"id": "req-1", ...}  // 后返回 A 的结果
```

</details>

---

**问题 2**：为什么用 `code` 和 `message` 表示错误？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**原因**：机器可读 + 人类可读

**code（机器可读）**：
- 客户端可以根据 code 做逻辑判断
- 如：`INVALID_PARAMS` → 显示输入框错误

**message（人类可读）**：
- 开发者调试
- 用户友好的错误提示

**对比**：
```json
// ❌ 只有 message
{"error": "参数错误"}  // 客户端只能靠字符串匹配

// ✅ code + message
{"error": {"code": "INVALID_PARAMS", "message": "缺少参数"}}
```

</details>

---

**问题 3**：`@JsonInclude(JsonInclude.Include.NON_NULL)` 的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**作用**：不序列化 null 字段

**对比**：
```json
// 不使用 @JsonInclude
{
  "type": "response",
  "id": "req-123",
  "payload": null,  // 多余的 null
  "error": null     // 多余的 null
}

// 使用 @JsonInclude
{
  "type": "response",
  "id": "req-123"
  // null 字段被省略
}
```

**好处**：
1. **减少传输量**：不传输无用的 null
2. **语义清晰**：不传表示 null
3. **兼容性好**：前端不需要判断 null

</details>
