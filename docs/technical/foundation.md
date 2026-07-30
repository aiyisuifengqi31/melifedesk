# 技术基础与 Task 2 Auth/RLS

## 技术标识

- 项目目录：`fanfan-guanguan`
- Git 仓库名：`fanfan-guanguan`
- Expo name：帆帆和关关
- Expo slug：`fanfan-guanguan`
- URL scheme：`fanfan-guanguan`
- Android package：`com.fanfan.guanguan`
- iOS bundle identifier：`com.fanfan.guanguan`
- Web title：帆帆和关关

Android package、iOS bundle identifier、URL scheme 和目录名称只使用 ASCII 字符。正式发布后 Android package 和 iOS bundle identifier 不得随意修改。

## Task 1 基础工程

Task 1 建立 Expo SDK 57、React Native、React Native Web、Expo Router、TypeScript strict、pnpm、Jest、React Native Testing Library、Playwright、lint、typecheck、Web production build、基础 CI、登录态页面骨架、六项左侧导航和三套主题资源架构。

## Task 2 Auth/RLS 范围

Task 2 新增：

- Supabase Auth 客户端封装；
- `.env.example` 中的 public Supabase URL 和 anon key；
- 登录页注册、登录、退出、主题保存、情侣邀请码、接受邀请、解除绑定控件；
- `profiles`、`user_settings`、`couples`、`couple_members`、`couple_invites` migration；
- 所有客户端可访问表启用并强制 RLS；
- `create_couple_invite`、`accept_couple_invite`、`leave_active_couple` 安全 RPC；
- `couple_members_one_active_couple_per_user` 部分唯一索引，约束同一用户同一时间只能加入一个 active couple；
- A/B/C 用户权限模型测试和并发绑定测试。

## 安全约束

- 客户端不得包含 service role key；
- private 数据只允许 owner 读取；
- 情侣共享访问只通过 active couple membership 判断；
- 接受邀请和解除绑定必须通过事务性 RPC；
- 解除绑定时同步写入 `left_at`、`ended_at`，共享访问立即失效；
- `user_settings` 不包含 `app_name_override`，如需自定义首页标题仅使用 `workspace_title`。

## Supabase 验收

当前本机未提供 Supabase CLI、PostgreSQL 客户端或 Docker，因此 Task 2 的本地验收使用 `pnpm test:supabase` 对 migration/RLS/RPC 结构和权限模型进行可重复测试。连接真实 Supabase 项目时，应使用同一 migration 文件执行数据库迁移，不得手工创建表。
