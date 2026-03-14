---
title: "第5.3节：连接管理器 - 管理多个 WebSocket 连接"
summary: "实现连接管理器，统一维护多用户 WebSocket 连接状态。"
slug: connection-manager
date: 2026-03-14
tags:
  - course
  - miniclaw
  - connections
order: 3
status: published
---

> **学习目标**：实现连接管理器，跟踪所有活跃的 WebSocket 连接
> **预计时长**：20 分钟

---

### 核心问题：为什么需要连接管理器？

**真实场景**：

```
用户 A：在浏览器标签页 1 连接
用户 A：在浏览器标签页 2 连接
用户 B：在手机连接
→ 服务器有 3 个连接
→ 需要知道哪个连接属于谁
→ 需要向特定用户推送消息
```

**问题**：
1. 如何跟踪所有活跃连接？
2. 如何标识每个连接？
3. 如何向特定连接推送消息？

---

### 对比：有 vs 无连接管理器

**无连接管理器**：

```java
@Override
public Mono<Void> handle(WebSocketSession session) {
    // 连接建立，但不知道是谁
    // 无法主动推送消息
    // 连接断开后无法清理
}
```

**有连接管理器**：

```java
@Override
public Mono<Void> handle(WebSocketSession session) {
    String connectionId = generateConnectionId();
    
    // 注册连接
    connectionManager.register(connectionId, session);
    
    // 后续可以主动推送
    connectionManager.send(connectionId, "Hello");
    
    // 连接断开后清理
    connectionManager.remove(connectionId);
}
```

---

### 第一步：设计 ConnectionManager 接口

**1.1 需要哪些方法？**

```java
public interface ConnectionManager {
    // 注册连接
    void register(String connectionId, WebSocketSession session);
    
    // 移除连接
    void remove(String connectionId);
    
    // 获取连接
    WebSocketSession get(String connectionId);
    
    // 检查连接是否存在
    boolean exists(String connectionId);
    
    // 获取连接数量
    int size();
}
```

**1.2 为什么需要这些方法？**

| 方法 | 用途 |
|------|------|
| `register()` | 连接建立时注册 |
| `remove()` | 连接断开时清理 |
| `get()` | 获取连接以推送消息 |
| `exists()` | 检查连接是否还活着 |
| `size()` | 监控连接数 |

---

### 第二步：实现 ConnectionManager

**2.1 创建 ConnectionManager**

创建 `gateway/ws/ConnectionManager.java`：

```java
package com.miniclaw.gateway.ws;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketSession;

import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket 连接管理器
 * 管理所有活跃的 WebSocket 连接
 */
@Slf4j
@Component
public class ConnectionManager {

    /**
     * 连接缓存（线程安全）
     */
    private final ConcurrentHashMap<String, WebSocketSession> connections = new ConcurrentHashMap<>();

    /**
     * 注册连接
     */
    public void register(String connectionId, WebSocketSession session) {
        WebSocketSession old = connections.put(connectionId, session);
        if (old != null) {
            log.warn("连接已存在，覆盖旧连接: connectionId={}", connectionId);
        }
        log.info("连接注册: connectionId={}, 当前连接数={}", connectionId, connections.size());
    }

    /**
     * 移除连接
     */
    public void remove(String connectionId) {
        WebSocketSession session = connections.remove(connectionId);
        if (session != null) {
            log.info("连接移除: connectionId={}, 当前连接数={}", connectionId, connections.size());
        } else {
            log.warn("连接不存在: connectionId={}", connectionId);
        }
    }

    /**
     * 获取连接
     */
    public WebSocketSession get(String connectionId) {
        return connections.get(connectionId);
    }

    /**
     * 检查连接是否存在
     */
    public boolean exists(String connectionId) {
        return connections.containsKey(connectionId);
    }

    /**
     * 获取连接数量
     */
    public int size() {
        return connections.size();
    }
}
```

**2.2 为什么用 ConcurrentHashMap？**

**问题**：多个连接可能并发注册/移除

**不推荐**：
```java
// ❌ 非线程安全
private Map<String, WebSocketSession> connections = new HashMap<>();
```

**推荐**：
```java
// ✅ 线程安全
private ConcurrentHashMap<String, WebSocketSession> connections = new ConcurrentHashMap<>();
```

**好处**：
- 线程安全
- 高性能（分段锁）
- 适合高并发

---

### 第三步：修改 EchoWebSocketHandler 使用 ConnectionManager

**3.1 注入 ConnectionManager**

```java
@Slf4j
@Component
public class EchoWebSocketHandler implements WebSocketHandler {

    private final ConnectionManager connectionManager;

    public EchoWebSocketHandler(ConnectionManager connectionManager) {
        this.connectionManager = connectionManager;
    }

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        String connectionId = generateConnectionId();
        
        // 注册连接
        connectionManager.register(connectionId, session);
        
        log.info("WebSocket 连接建立: id={}, 当前连接数={}", 
                connectionId, connectionManager.size());

        // 处理消息
        Flux<WebSocketMessage> output = session.receive()
                .filter(message -> message.getType() == WebSocketMessage.Type.TEXT)
                .doOnNext(message -> {
                    String payload = message.getPayloadAsText();
                    log.debug("收到消息: connectionId={}, payload={}", connectionId, payload);
                })
                .map(message -> {
                    String response = "Echo: " + message.getPayloadAsText();
                    return session.textMessage(response);
                })
                .doFinally(signalType -> {
                    // 移除连接
                    connectionManager.remove(connectionId);
                    log.info("WebSocket 连接关闭: id={}, 原因={}, 当前连接数={}", 
                            connectionId, signalType, connectionManager.size());
                });

        return session.send(output);
    }

    /**
     * 生成连接 ID
     */
    private String generateConnectionId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
```

**3.2 需要添加导入**

```java
import java.util.UUID;
```

---

### 第四步：验证编译

```bash
cd ~/clawd/miniclaw-test/backend
./mvnw clean compile
```

---

### 第五步：创建测试

**5.1 创建单元测试**

```java
package com.miniclaw.gateway.ws;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.socket.WebSocketSession;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * 测试 ConnectionManager
 */
class ConnectionManagerTest {

    private ConnectionManager connectionManager;

    @BeforeEach
    void setUp() {
        connectionManager = new ConnectionManager();
    }

    @Test
    void testRegister() {
        // 准备
        String connectionId = "conn-123";
        WebSocketSession session = mock(WebSocketSession.class);

        // 执行
        connectionManager.register(connectionId, session);

        // 验证
        assertTrue(connectionManager.exists(connectionId));
        assertEquals(session, connectionManager.get(connectionId));
        assertEquals(1, connectionManager.size());

        System.out.println("✅ 注册测试通过");
    }

    @Test
    void testRemove() {
        // 准备
        String connectionId = "conn-123";
        WebSocketSession session = mock(WebSocketSession.class);
        connectionManager.register(connectionId, session);

        // 执行
        connectionManager.remove(connectionId);

        // 验证
        assertFalse(connectionManager.exists(connectionId));
        assertNull(connectionManager.get(connectionId));
        assertEquals(0, connectionManager.size());

        System.out.println("✅ 移除测试通过");
    }

    @Test
    void testMultipleConnections() {
        // 注册多个连接
        for (int i = 0; i < 5; i++) {
            String connectionId = "conn-" + i;
            WebSocketSession session = mock(WebSocketSession.class);
            connectionManager.register(connectionId, session);
        }

        // 验证
        assertEquals(5, connectionManager.size());

        // 移除所有连接
        for (int i = 0; i < 5; i++) {
            connectionManager.remove("conn-" + i);
        }

        assertEquals(0, connectionManager.size());

        System.out.println("✅ 多连接测试通过");
    }
}
```

**5.2 运行测试**

```bash
./mvnw test -Dtest=ConnectionManagerTest
```

---

### 本节总结：我们解决了什么问题？

**核心问题**：如何管理多个 WebSocket 连接？

**解决方案**：
1. **ConnectionManager**：统一管理所有连接
2. **ConcurrentHashMap**：线程安全的存储
3. **连接 ID**：唯一标识每个连接

**关键设计**：
- `register()`：连接建立时调用
- `remove()`：连接断开时调用
- `get()`：获取连接以推送消息

**学完这节，你理解了**：
- 为什么需要连接管理器
- 如何实现线程安全的管理
- 如何跟踪连接状态

---

### 验证点

**在继续之前，确保**：

- [ ] ConnectionManager 已创建
- [ ] EchoWebSocketHandler 已使用 ConnectionManager
- [ ] 编译通过
- [ ] 单元测试通过

---

### 动手实践

**任务**：实现连接管理器

**步骤**：
1. 创建 ConnectionManager 类
2. 使用 ConcurrentHashMap 存储
3. 修改 EchoWebSocketHandler
4. 创建单元测试
5. 运行测试验证

**思考题**：
- 如何实现向所有连接广播消息？
- 如何检测僵尸连接（已断开但未清理）？

---

### 自检：你真的掌握了吗？

**问题 1**：为什么用 ConcurrentHashMap 而不是 HashMap？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**原因**：线程安全

**问题场景**：
```
线程 A：注册连接 1
线程 B：注册连接 2
线程 C：移除连接 1
→ 如果不是线程安全，可能导致数据不一致
```

**HashMap 的问题**：
- 非线程安全
- 并发写入可能导致死循环
- 数据丢失

**ConcurrentHashMap 的优势**：
- 线程安全
- 分段锁（高性能）
- 适合高并发

</details>

---

**问题 2**：`doFinally()` 中调用 `remove()` 的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**作用**：连接断开时清理资源

**为什么需要**：
1. **防止内存泄漏**：不清理的话，connections 会越来越大
2. **准确统计**：`size()` 返回正确的连接数
3. **避免推送失败**：向已断开的连接推送会失败

**流程**：
```
连接建立 → register()
连接使用中 → ...
连接断开 → doFinally() → remove()
```

</details>

---

**问题 3**：连接 ID 的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**作用**：唯一标识每个连接

**为什么需要**：
1. **推送消息**：知道向哪个连接推送
2. **关联用户**：知道这个连接属于谁
3. **清理资源**：断开时知道移除哪个

**生成方式**：
```java
UUID.randomUUID().toString().substring(0, 8)
// 如：a1b2c3d4
```

**后续扩展**：
- 可以关联 userId
- 可以关联 sessionId
- 可以记录连接时间

</details>
