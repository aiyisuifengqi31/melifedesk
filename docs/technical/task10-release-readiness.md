# Task 10 发布准备说明

本阶段只建立发布准备能力，不执行 production 发布。

## 环境边界

- dev/staging 可以用于 Web Preview、EAS preview build 和迁移验证。
- production migration、production deploy、正式域名绑定必须单独确认。
- 客户端只允许使用 `EXPO_PUBLIC_SUPABASE_URL` 和 `EXPO_PUBLIC_SUPABASE_ANON_KEY`。
- 禁止把 `SUPABASE_SERVICE_ROLE_KEY`、数据库密码、pooler 连接串写入客户端、dist 或 Git。

## 备份策略

- schema 备份：发布前导出 migration 状态和 schema 版本。
- data 备份：production 只允许服务端受控任务执行。
- Storage 备份：通过 Supabase Storage API 生成 manifest，不直接修改 storage schema。
- `backup_runs` 只记录备份计划和状态，不保存敏感正文。

## 回滚策略

- Web Preview 回滚到上一 preview version。
- Android/iOS 使用固定包名 `com.fanfan.guanguan`，不随意修改 bundle identifier。
- 数据库回滚优先使用向前修复 migration；涉及 production 需人工确认。

## 验收命令

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:web`
- `pnpm build:web`
- `pnpm test:supabase`

## 发布闸门

正式发布前必须确认：

- 最近一次 backup 通过；
- rollback 文档可执行；
- service role key 未进入客户端 bundle；
- production Supabase 项目明确确认；
- Web、Android、iOS 版本号和渠道匹配。
