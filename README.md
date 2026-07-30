# 帆帆和关关

双人成长工作台。

## 品牌与技术标识

- 用户可见名称：帆帆和关关
- 副标题：双人成长工作台
- Expo slug：`fanfan-guanguan`
- URL scheme：`fanfan-guanguan`
- Android package：`com.fanfan.guanguan`
- iOS bundle identifier：`com.fanfan.guanguan`

旧名称只保留在历史需求文档中，新工程配置和用户可见界面不使用旧名称。

## 当前阶段

Task 1 已完成 Expo SDK 57 基础工程、Expo Router、React Native Web、TypeScript strict、六项左侧导航、三套主题资源、Jest、React Native Testing Library、Playwright、lint、typecheck 和 Web production build。

Task 2 新增 Supabase Auth 基础接入、`profiles`、`user_settings`、`couples`、`couple_members`、`couple_invites` migration、RLS、情侣邀请码 RPC、接受邀请 RPC、解除绑定 RPC、A/B/C 权限模型测试和并发绑定测试。

Task 2 不包含每日计划、健身、记账、日记、份子记录、考公题库、公共能力或生产发布。

## 环境变量

复制 `.env.example` 后填写：

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

客户端只允许使用 Supabase anon key。`service_role` key 不得进入 `.env` 的 `EXPO_PUBLIC_*` 变量，也不得进入客户端代码。

## 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:web
pnpm build:web
pnpm test:supabase
```

## 主题资源

`default`、`cat`、`dog` 三套主题资源位于 `src/assets/themes`。每套包含六个导航 SVG、选中/未选中状态、浅色/深色 token、通用空状态、图表配色和 `license.md`。
