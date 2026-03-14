---
title: "第5.2节：WebSocket 基础配置 - 从零搭建服务器"
summary: "完成 WebSocket 服务端基础配置，搭建最小可运行通信链路。"
slug: websocket-config
date: 2026-03-14
tags:
  - course
  - miniclaw
  - websocket
order: 2
status: published
---

> **学习目标**：在 Spring Boot 中启用 WebSocket，实现可连接的服务器
> **预计时长**：20 分钟

---

### 核心问题：如何启用 WebSocket？

**要实现的功能**：
- 客户端连接到 `ws://localhost:8080/ws`
- 服务端接收连接
- 发送消息、接收响应
- 优雅断开

---

### 第一步：添加依赖

**1.1 打开 pom.xml**

在 `backend/pom.xml` 的 `<dependencies>` 中添加：

```xml
<!-- WebSocket 支持 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

**为什么用 webflux？**
- 已经在第4章添加过（用于 LlmClient）
- 同时支持 WebSocket 和响应式 HTTP

**1.2 验证依赖**

```bash
cd ~/clawd/miniclaw-test/backend
./mvnw dependency:tree | grep webflux
```

应该看到 `spring-boot-starter-webflux`。

---

### 第二步：创建 WebSocket 配置

**2.1 创建包结构**

```bash
cd ~/clawd/miniclaw-test/backend/src/main/java/com/miniclaw
mkdir -p gateway/ws
```

**2.2 创建 WebSocketConfig**

创建 `gateway/ws/WebSocketConfig.java`：

```java
package com.miniclaw.gateway.ws;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.HandlerMapping;
import org.springframework.web.reactive.handler.SimpleUrlHandlerMapping;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.server.support.WebSocketHandlerAdapter;

import java.util.Map;

/**
 * WebSocket 配置
 */
@Configuration
public class WebSocketConfig {

    /**
     * 注册 WebSocket 路由
     */
    @Bean
    public HandlerMapping webSocketHandlerMapping(WebSocketHandler webSocketHandler) {
        Map<String, WebSocketHandler> map = Map.of(
                "/ws", webSocketHandler
        );

        SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
        mapping.setUrlMap(map);
        mapping.setOrder(-1);  // 优先级高于普通 HTTP 路由
        return mapping;
    }

    /**
     * WebSocket 处理器适配器
     */
    @Bean
    public WebSocketHandlerAdapter handlerAdapter() {
        return new WebSocketHandlerAdapter();
    }
}
```

**关键点**：
- `/ws` 是 WebSocket 端点
- `WebSocketHandler` 是处理连接的核心接口
- `WebSocketHandlerAdapter` 处理协议细节

---

### 第三步：创建 WebSocket 处理器

**3.1 创建 EchoWebSocketHandler**

创建 `gateway/ws/EchoWebSocketHandler.java`：

```java
package com.miniclaw.gateway.ws;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * WebSocket 处理器（Echo 示例）
 * 接收消息并原样返回
 */
@Slf4j
@Component
public class EchoWebSocketHandler implements WebSocketHandler {

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        log.info("WebSocket 连接建立: {}", session.getId());

        // 接收消息并原样返回
        Flux<WebSocketMessage> output = session.receive()
                .filter(message -> message.getType() == WebSocketMessage.Type.TEXT)
                .doOnNext(message -> {
                    String payload = message.getPayloadAsText();
                    log.debug("收到消息: {}", payload);
                })
                .map(message -> {
                    // Echo: 原样返回
                    String response = "Echo: " + message.getPayloadAsText();
                    return session.textMessage(response);
                })
                .doFinally(signalType -> {
                    log.info("WebSocket 连接关闭: {}, 原因: {}", session.getId(), signalType);
                });

        return session.send(output);
    }
}
```

**3.2 理解代码流程**

```
1. 客户端连接 → handle() 被调用
2. session.receive() → 接收消息流
3. filter() → 只处理文本消息
4. map() → 构造响应消息
5. session.send() → 发送响应
6. doFinally() → 连接关闭时执行
```

---

### 第四步：修改 WebSocketConfig

**4.1 注入 EchoWebSocketHandler**

```java
@Configuration
public class WebSocketConfig {

    private final EchoWebSocketHandler echoWebSocketHandler;

    public WebSocketConfig(EchoWebSocketHandler echoWebSocketHandler) {
        this.echoWebSocketHandler = echoWebSocketHandler;
    }

    @Bean
    public HandlerMapping webSocketHandlerMapping() {
        Map<String, WebSocketHandler> map = Map.of(
                "/ws", echoWebSocketHandler
        );

        SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
        mapping.setUrlMap(map);
        mapping.setOrder(-1);
        return mapping;
    }

    @Bean
    public WebSocketHandlerAdapter handlerAdapter() {
        return new WebSocketHandlerAdapter();
    }
}
```

---

### 第五步：验证编译

```bash
cd ~/clawd/miniclaw-test/backend
./mvnw clean compile
```

看到 `BUILD SUCCESS` 就对了。

---

### 第六步：测试连接

**6.1 启动服务器**

```bash
cd ~/clawd/miniclaw-test/backend
./mvnw spring-boot:run
```

**6.2 使用 wscat 测试**

安装 wscat（如果没有）：
```bash
npm install -g wscat
```

连接并测试：
```bash
wscat -c ws://localhost:8080/ws

# 输入消息
> 你好

# 应该看到响应
< Echo: 你好
```

**6.3 预期输出**

服务器日志：
```
WebSocket 连接建立: xxx-xxx-xxx
收到消息: 你好
WebSocket 连接关闭: xxx-xxx-xxx, 原因: ON_COMPLETE
```

客户端：
```
> 你好
< Echo: 你好
```

---

### 本节总结：我们解决了什么问题？

**核心问题**：如何在 Spring Boot 中启用 WebSocket？

**解决方案**：
1. **WebSocketConfig**：配置路由 `/ws`
2. **EchoWebSocketHandler**：处理连接和消息
3. **WebSocketHandlerAdapter**：处理协议细节

**关键设计**：
- `session.receive()`：接收消息流
- `session.send()`：发送消息流
- Reactor 响应式编程

**学完这节，你理解了**：
- WebSocket 的基本配置
- WebSocketHandler 接口
- 如何测试 WebSocket

---

### 验证点

**在继续之前，确保**：

- [ ] WebSocketConfig 已创建
- [ ] EchoWebSocketHandler 已创建
- [ ] 编译通过
- [ ] 可以用 wscat 连接
- [ ] 可以收发消息

---

### 动手实践

**任务**：搭建 WebSocket 服务器

**步骤**：
1. 添加依赖
2. 创建 WebSocketConfig
3. 创建 EchoWebSocketHandler
4. 启动服务器
5. 用 wscat 测试

**思考题**：
- 如果要支持多个 WebSocket 端点（如 `/ws` 和 `/admin`），怎么配置？
- 如何获取客户端的 IP 地址？

---

### 自检：你真的掌握了吗？

**问题 1**：`session.receive()` 和 `session.send()` 的作用是什么？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**session.receive()**：
- 接收客户端发送的消息流
- 返回 `Flux<WebSocketMessage>`
- 是一个响应式流（可以持续接收）

**session.send()**：
- 向客户端发送消息流
- 接收 `Flux<WebSocketMessage>`
- 也是响应式流

**典型用法**：
```java
Flux<WebSocketMessage> output = session.receive()
    .map(message -> session.textMessage("Echo: " + message.getPayloadAsText()));

return session.send(output);
```

</details>

---

**问题 2**：为什么要用 `filter(message -> message.getType() == WebSocketMessage.Type.TEXT)`？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**WebSocket 消息类型**：
- TEXT：文本消息（最常用）
- BINARY：二进制消息
- PING/PONG：心跳消息

**过滤的原因**：
1. 我们只关心文本消息
2. 忽略心跳和二进制消息
3. 避免处理不支持的消息类型

**如果不过滤**：
- 可能处理到心跳消息
- `getPayloadAsText()` 可能失败

</details>

---

**问题 3**：`doFinally(signalType -> {...})` 什么时候执行？

你的答案：
```


```

参考答案：
<details>
<summary>点击展开</summary>

**执行时机**：
- 流结束时（无论成功、失败、取消）
- 连接关闭时

**signalType 的值**：
- `ON_COMPLETE`：正常完成
- `ON_ERROR`：出错
- `ON_CANCEL`：客户端断开

**典型用法**：
```java
.doFinally(signalType -> {
    log.info("连接关闭: {}, 原因: {}", sessionId, signalType);
    // 清理资源
})
```

</details>
