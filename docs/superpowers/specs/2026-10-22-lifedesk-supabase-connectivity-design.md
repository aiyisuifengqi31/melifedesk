# LifeDesk 国内网络 Supabase 连接修复设计

## 背景与根因

2026-10-22 在用户当前网络上复现：LifeDesk 的 GitHub Pages 页面和 `supabase.com` 官网均可正常访问，但项目域名 `yzoxgsqucugeatcxcurd.supabase.co` 的 Auth 与 REST 请求都在 TLS 建连后被立即重置，HTTP 状态为 `000`。同一时间，GitHub Actions 从云端执行的 LifeDesk 数据库保活请求连续成功，证明项目仍处于运行状态，数据库并未暂停。

头像和情侣共享数据依赖 Supabase。页面能打开但项目域名不可达时，App 只能显示本地缓存；在新浏览器或本地缓存不足时，就表现为头像缺失、共享内容无法读取或写入。

## 目标

- 在用户当前网络下恢复登录、头像、情侣绑定及共享数据读写。
- 保留现有 Supabase 项目、账号、数据库、RLS 策略和历史数据。
- 使用免费方案，不升级 Supabase 付费计划。
- 保留现有浏览器登录会话，避免仅因切换网络入口而强制退出。
- 中转服务不记录密码、访问令牌或业务数据，不持有高权限密钥。

## 方案选择

采用 Deno Deploy 免费服务作为只属于 LifeDesk 的 HTTPS 中转层。Deno 的 `deno.net` 默认域名已在用户当前网络实测可达；免费套餐额度为每月 100 万请求和 20 GiB 流量，足以覆盖两人使用的 LifeDesk。

未采用以下方案：

- 更换网络或长期使用代理软件：不需要改代码，但无法保证每次打开 App 都可用。
- Supabase 自定义域名：官方要求付费计划和付费附加项，不符合免费约束。
- 公共 CORS/反向代理：访问令牌会经过不受用户控制的第三方，且稳定性不可控，不接受。

## 架构

```text
LifeDesk 网页 / Android App
        │ HTTPS
        ▼
LifeDesk 专用 Deno 中转（*.deno.net）
        │ HTTPS，仅固定上游
        ▼
yzoxgsqucugeatcxcurd.supabase.co
        │
        ├─ Auth 登录与会话
        ├─ REST / RPC 数据库访问
        └─ Storage 文件访问
```

### 中转服务

- 上游地址写死为当前 LifeDesk Supabase 项目，客户端不能指定其他目标，避免形成开放代理。
- 只允许 `/auth/v1/`、`/rest/v1/`、`/storage/v1/`、`/functions/v1/` 与 `/realtime/v1/` 路径；其它路径返回 `404`。
- 仅转发正常 API 方法和必要请求头、请求体、查询参数与响应；移除 `host` 和转发来源类头部。
- 提供不访问 Supabase 的 `/health`，用于部署验收和故障定位。
- 处理浏览器 CORS 预检，仅允许 LifeDesk GitHub Pages、开发地址和无 `Origin` 的原生 App 请求。
- 数据响应使用 `Cache-Control: no-store`；代码不输出请求头、访问令牌、密码或响应正文。
- 不使用 `service_role`、`sb_secret_`、数据库密码或任何服务端 Supabase 密钥。上游仍由现有 publishable key、用户登录令牌和 RLS 鉴权。

### App 接入方式

- 保留 `EXPO_PUBLIC_SUPABASE_URL` 为原始 Supabase 项目 URL，以维持 Supabase 项目标识和现有浏览器会话存储键。
- 新增 `EXPO_PUBLIC_SUPABASE_PROXY_URL`。配置后，通过 Supabase 客户端的自定义 `fetch` 仅改写实际网络请求的 origin，路径、查询参数、方法、请求头和请求体保持不变。
- 未配置中转 URL 时继续直连 Supabase，方便本地开发和回退。
- 不对失败的写请求做自动重试，避免网络中断后产生重复写入。
- 中转请求失败时沿用现有本地优先降级；登录等必须联网的操作显示可理解的中文错误。

## 数据流

1. App 仍以原 Supabase URL 创建客户端并读取原有持久化会话。
2. 自定义 `fetch` 将发往原项目域名的请求改写到 LifeDesk Deno 地址。
3. Deno 校验路径和来源后，把请求转发到固定 Supabase 项目。
4. Supabase 使用原 publishable key、用户 JWT 与现有 RLS 执行请求。
5. 响应原样返回 App；头像和共享模块继续使用现有代码与数据结构。

## 部署与运维

- 中转代码与 App 代码同仓库保存，便于审计和版本回滚。
- 首次部署需要用户用 GitHub 登录 Deno Deploy 并授权一次仓库；不要求向 Codex 提供密码。
- Deno 部署成功后，把实际 `https://<app>.<org>.deno.net` 地址写入生产构建环境并重新发布 GitHub Pages。
- 现有 Supabase 数据库保活任务继续直连上游，独立验证数据库本身处于运行状态。
- 后续监测同时检查 Deno `/health` 与经中转的 Supabase 只读请求，区分“中转故障”和“数据库故障”。

## 测试与验收

### 自动测试

- 中转层拒绝非白名单路径，不能被用作开放代理。
- CORS 仅接受约定来源，预检请求正确返回。
- 请求转发保留路径、查询参数、方法、授权头与正文，但不泄露到日志。
- App 只改写目标项目的请求，保留原始 Supabase URL 与既有会话存储键。
- 未配置中转时仍保持当前直连行为。
- 安全扫描拒绝高权限密钥、任意上游参数和敏感日志。

### 真实环境验收

- 用户当前网络访问 Deno `/health` 返回 `200`。
- 通过中转访问 Supabase Auth 健康接口与 `user_kv` 只读接口成功。
- GitHub Pages 重新部署成功，线上页面返回 `200`。
- 使用现有登录会话打开 App，头像可恢复；若会话已自然过期，可正常重新登录。
- 两个账号可读取当前情侣关系，并完成一次共享内容读取和一次可撤销的测试写入。

## 非目标

- 不迁移数据库，不复制或导出用户数据。
- 不恢复无关的旧 Supabase 项目。
- 不引入公共第三方代理，不关闭 RLS，不把数据改成公开访问。
- 不承诺第三方免费政策永久不变；若 Deno 或 Supabase 政策变化，再迁移到新的用户自有入口。
