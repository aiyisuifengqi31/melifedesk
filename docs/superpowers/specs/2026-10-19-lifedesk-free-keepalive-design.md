# LifeDesk 免费长期保活设计

## 目标

让当前线上 LifeDesk 实际使用的 Supabase 项目持续产生免费套餐认可的数据库查询，同时停止旧项目失败任务造成的 GitHub 邮件轰炸。

## 已确认事实

- 线上 `https://aiyisuifengqi31.github.io/melifedesk/` 的公开构建包连接项目 `yzoxgsqucugeatcxcurd`。
- 现有 GitHub Actions 错误连接旧项目 `ycijporsgfgegmqzxdke`。
- 旧任务在 2026-10-14 前成功访问 Auth 设置，但自 2026-10-15 起因旧项目暂停、域名无法解析而持续失败。
- Auth 设置请求没有形成 Supabase 用来判断活跃度的用户数据库查询，因此旧方案不能可靠防止自动暂停。
- 当前 LifeDesk 项目已存在 `public.user_kv` 表，适合作为无副作用的只读保活目标。

## 决策

保留当前 LifeDesk 项目 `yzoxgsqucugeatcxcurd`，让旧项目 `ycijporsgfgegmqzxdke` 保持暂停。现有工作流改为只读查询当前项目的 `user_kv` 表，不恢复、不删除旧项目，也不修改任何业务数据。

## 工作流设计

- 工作流名称改为 `Keep LifeDesk Supabase active`。
- 保留手动触发、合并后触发和每日三次定时触发。
- 使用当前 App 已公开使用的低权限 Supabase publishable key；不得使用 `sb_secret_`、`service_role` 或数据库密码。
- 请求为 `GET /rest/v1/user_kv?select=key&limit=1`，仅携带 `apikey` 请求头。
- `user_kv` 的 RLS 可以返回空数组；只要 HTTP 成功且响应是 JSON 数组，就说明数据库查询已经执行。
- 保留连接超时、总超时和有限重试，避免任务挂起。

## 邮件行为

旧项目不再被工作流访问。新任务查询真实 LifeDesk 数据库并成功后，GitHub 不再发送“工作流失败”邮件。历史失败记录保留，便于审计。

## GitHub 定时任务自身保活

GitHub 可能在公开仓库连续 60 天没有仓库活动后自动停用定时工作流。增加一个每月运行一次的仓库心跳任务，仅更新 `.github/scheduled-workflow-heartbeat.txt` 的 UTC 时间并提交到 `main`。它不连接 Supabase、不访问业务数据，也不修改 App 文件；用途只是让免费定时任务长期保持启用。

该任务仅授予 `contents: write` 权限，并在新工作流合并后立即运行一次以验证写权限。之后每月 1 日运行。由 `GITHUB_TOKEN` 推送的心跳提交不会再次触发其他 GitHub Actions，避免循环执行。

## 测试与验收

- 合约测试必须拒绝旧项目 ID、Auth 设置端点、写请求和高权限密钥。
- 合约测试必须确认当前项目 ID、`user_kv` 只读查询、每日三次计划和只读 GitHub 权限。
- YAML 必须可解析，安全扫描不得发现 secret/service-role/JWT/写请求。
- 合并后首次 GitHub Actions 运行必须为 `success`；否则继续诊断，不宣称完成。
- 仓库心跳工作流的首次真实运行也必须为 `success`，并确认心跳提交已进入 `main`。

## 非目标

- 不恢复或删除旧 Supabase 项目。
- 不升级 Supabase 付费计划。
- 不迁移或修改 LifeDesk 业务数据。
