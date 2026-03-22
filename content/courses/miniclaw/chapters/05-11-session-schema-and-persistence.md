---
title: "第 5.11 节：重做真实会话表，并让 session.create 开始落库"
summary: "第五章从这一节开始进入真实业务开发。先停下继续扩 Gateway 细节，把早期为了演示 Flyway 临时建的 sessions 表重做成真实会话表，再把 session.create 接到数据库持久化层。"
slug: session-schema-and-persistence
date: 2026-03-22
tags:
  - course
  - miniclaw
  - gateway
  - session
  - flyway
  - jpa
order: 11
status: published
---

> **学习目标**：理解为什么演示时期的 `sessions` 表已经不适合继续承载真实业务，以及如何从真实会话模型出发重做表结构、JPA Entity、Repository 和持久化会话服务。  
> **预计时长**：20 分钟  
> **难度**：入门

---

### 到了 5.11，为什么不能再沿用那张“演示表”

前面 3.3 学 Flyway 时，我们故意从最简单的表开始：

```sql
CREATE TABLE sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)
```

后面又补了：

```sql
ALTER TABLE sessions
ADD COLUMN title VARCHAR(255),
ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
```

这套结构对“演示 Flyway 怎么工作”是够的，但对 5.11 以后的真实会话业务已经不够了。

问题不在于字段少，而在于建模出发点就不对：

1. `user_id` 当时只是为了演示“字段演进”，不是当前系统真实可用的用户模型
2. `status = ACTIVE` 也不是 Gateway 会话真正的运行时状态语义
3. 这张表没有 `updated_at`
4. 这张表没有 `closed_at`
5. 它也没有跟当前 `SessionState` 对齐

所以从 5.11 开始，必须明确一个原则：

> 不再把 `sessions` 当成 Flyway 教具表，  
> 而是把它当成真实业务会话表重新设计。

这也是第五章从“网关骨架”进入“真实业务开发”的分水岭。

---

### 当前真实会话，到底需要哪些持久化字段

先不要一口气把未来所有字段都塞进去。  
5.11 只围绕“真实会话最小闭环”来建模。

当前我们真正需要持久化的是：

1. `id`
   会话主键，也就是后续协议层使用的 `sessionId`

2. `owner_id`
   先保留，但允许为空
   因为当前课程还没有做完整用户体系，不能再强行要求 `NOT NULL`

3. `title`
   保留为空字段，后面前端可以继续补会话标题能力

4. `status`
   必须直接和当前 `SessionState` 对齐
   也就是 `IDLE / RUNNING / CLOSED`

5. `created_at`
   记录会话创建时间

6. `updated_at`
   记录最近一次写入时间

7. `closed_at`
   当会话进入关闭态时记录关闭时间

注意这里刻意没有加：

- `connection_id`
- 当前 request 指针
- 历史消息计数
- 上下文摘要

原因很简单，这一节的目标只是把“真实会话”先立住。  
连接是运行时概念，不应该直接持久化进会话表；消息、上下文和执行轨迹会在后续小节继续展开。

---

### Flyway：把演示表升级成真实会话表

这一节新增的迁移脚本是：

[`V3__refactor_sessions_for_real_gateway.sql`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/resources/db/migration/V3__refactor_sessions_for_real_gateway.sql)

当前做了这几件事：

```sql
ALTER TABLE sessions RENAME COLUMN user_id TO owner_id;
```

先承认事实：当前还没有真实用户体系，所以这个字段不能继续叫 `user_id`，也不能继续要求非空。

然后：

```sql
ALTER TABLE sessions
    ALTER COLUMN owner_id DROP NOT NULL,
    ALTER COLUMN status SET DEFAULT 'IDLE';
```

这一步把旧的“演示字段约束”改成真实业务约束。

接着：

```sql
UPDATE sessions
SET status = 'IDLE'
WHERE status = 'ACTIVE';
```

这是数据语义迁移，不只是改默认值。  
旧表里的 `ACTIVE` 在现在的 Gateway 语境里，更接近 `IDLE`，所以要一起改掉。

最后补上：

```sql
ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN closed_at TIMESTAMP NULL;
```

再把索引从 `idx_sessions_user_id` 切到：

- `idx_sessions_owner_id`
- `idx_sessions_status`

到这里，这张表才算开始具备真实会话的最小可扩展形态。

---

### `SessionEntity`：第一次把数据库会话模型正式写出来

有了真实表结构以后，这一节第一次补上了真正的 JPA Entity：

[`SessionEntity.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/session/persistence/SessionEntity.java)

当前结构是：

```java
@Entity
@Table(name = "sessions")
public class SessionEntity {

    @Id
    private String id;

    private String ownerId;
    private String title;

    @Enumerated(EnumType.STRING)
    private SessionState status;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant closedAt;
}
```

这里最关键的一点是：

> `status` 不再是随便一个数据库字符串，  
> 而是直接和 `SessionState` 共用同一个枚举语义。

这一步很重要，因为从这一节开始，内存态和持久态的会话状态不应该再是两套概念。

如果这里还用数据库自己的 `"ACTIVE"`、`"DONE"`、`"OPEN"` 之类自定义值，后面状态机和持久化迟早会再次分裂。

现在这样做的好处是：

- 状态机约束和数据库状态开始对齐
- handler 层不需要再做额外状态翻译
- 后面做消息落库和会话关闭时，状态迁移逻辑可以继续复用

---

### `SessionEntityRepository`：先把仓储边界立出来

这一节同时新增了：

[`SessionEntityRepository.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/session/persistence/SessionEntityRepository.java)

当前非常克制：

```java
public interface SessionEntityRepository extends JpaRepository<SessionEntity, String> {
}
```

这里故意没有急着加一堆查询方法，比如：

- `findByOwnerId`
- `findByStatus`
- `findTop20By...`

原因很简单，5.11 当前只需要三类能力：

1. 按 id 保存
2. 按 id 查询
3. 给后续扩展留边界

这也是比较标准的第一步做法。  
先把真实仓储边界立住，再随着业务需求往里加查询接口，而不是预先把 repository 长成一个“猜未来需求”的大合集。

---

### `PersistentSessionService`：把运行时会话和数据库会话接起来

真正的 5.11 核心，不是 Entity，也不是 SQL，而是：

[`PersistentSessionService.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/session/PersistentSessionService.java)

这层服务的职责非常明确：

1. `create(connectionId)`
   先调用现有 `InMemorySessionRegistry#create(...)`
   再把生成的 `GatewaySession` 落到数据库

2. `find(sessionId)`
   先查运行时内存 registry
   查不到再回落到数据库

3. `save(session)`
   把运行时 session 的最新状态写回数据库

这层设计有一个非常关键的取舍：

> 5.11 不是直接删除内存 registry，  
> 而是先在“运行时 registry + 持久化 repository”之间加一层桥。

这是合理的，因为当前系统里：

- `ConnectionRegistry`
- `SessionLane`
- `GatewayEventBus`

这些都还是明显的运行时结构。  
你现在直接把所有会话读取都硬切到数据库，不仅成本高，而且会让 WebSocket 生命周期和业务持久化耦得太紧。

所以 5.11 的正确过渡方案是：

- 内存 registry 继续承载运行时关系
- 数据库开始承载真实会话持久化
- `PersistentSessionService` 负责把两边接起来

这一步非常关键，也很适合教学。

---

### 业务入口变化：`session.create` 和 `chat.send` 现在都不再只看内存

这一节之后：

- [`DefaultSessionHandler.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/handler/DefaultSessionHandler.java)
- [`DefaultChatHandler.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/main/java/com/miniclaw/gateway/rpc/handler/DefaultChatHandler.java)

都已经从直接依赖 `InMemorySessionRegistry`，切到了依赖 `PersistentSessionService`。

这意味着两件事。

第一，`session.create` 现在不是“只创建了一个内存对象”。  
它已经变成：

```text
create runtime session
  -> persist session entity
  -> return completed
```

第二，`chat.send` 现在查会话时也不再是“只认运行时内存”。  
它已经具备：

```text
find from runtime registry
  -> fallback to database
```

同时，在会话状态从 `IDLE -> RUNNING -> IDLE` 切换时，也会同步调用：

```java
sessionService.save(session)
```

这说明 5.11 的真正变化不是“加了一张表”，而是：

> Gateway 会话已经开始同时存在于运行时和数据库两个层面。

---

### 这一节的测试，到底锁住了什么

5.11 当前新增并更新的核心测试有三组：

- [`PersistentSessionServiceTest.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/session/PersistentSessionServiceTest.java)
- [`DefaultSessionHandlerTest.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/rpc/handler/DefaultSessionHandlerTest.java)
- [`DefaultChatHandlerTest.java`](/Users/Administrator/Desktop/Jaguarliu/code/jaguar-ai/miniclaw/backend/src/test/java/com/miniclaw/gateway/rpc/handler/DefaultChatHandlerTest.java)

它们当前锁住的语义是：

1. `session.create` 创建后必须落库
2. `find(sessionId)` 查不到运行时对象时，必须能回落到数据库
3. 会话状态变化写回时，必须同步持久化
4. `DefaultSessionHandler` 现在已经不是纯内存创建
5. `DefaultChatHandler` 在状态切换时也会走持久化保存

注意，这一节我们还没有做的事情也要看清楚：

- 还没有设计消息表
- 还没有把 user message / assistant message 正式落库
- 还没有做会话列表查询接口

这些都不是遗漏，而是 5.11 有意收住的边界。

---

### 学完 5.11，你要真正记住什么

这一节最重要的不是 SQL 语法，而是这四个判断：

1. 演示 Flyway 的表，不等于真实业务表
2. 会话状态必须和当前 `SessionState` 对齐，不能长期维持两套状态语义
3. 运行时 registry 和数据库会话不是互斥关系，5.11 先用服务层把两边桥接起来
4. `session.create` 真正进入业务阶段的标志，不是“能返回 sessionId”，而是“返回前已经落库”

到了这里，第五章才真正从“网关结构”走进“业务会话”。

后面的 5.12 最自然就会继续往前推：

> 既然会话已经是持久化对象了，  
> 那用户消息和 assistant 输出应该怎么设计消息表并开始落库？

---

### 验证命令

本节新增代码的定向验证命令：

```bash
./mvnw.cmd "-Dtest=PersistentSessionServiceTest,DefaultSessionHandlerTest,DefaultChatHandlerTest" test
./mvnw.cmd test
```

这次实现里，这两组验证已经通过，说明 5.11 当前的最小目标已经成立：

- 会话表已经从演示结构升级为真实会话结构
- `session.create` 已经开始持久化
- `chat.send` 已经开始读取并更新持久化 session

---

### 本节小结

- 5.11 是第五章进入真实业务开发的起点
- 我们重做了 `sessions` 表的字段语义和索引
- 第一次补上了真正的 `SessionEntity` 和 `SessionEntityRepository`
- 用 `PersistentSessionService` 把运行时会话和数据库会话桥接起来
- `session.create` 和 `chat.send` 已经不再只是纯内存行为

下一节开始，我们就可以继续把“真实会话”往前推到消息落库和流式结果收口上。
