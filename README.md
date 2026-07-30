# 帆帆和关关

双人成长工作台的 Task 1 基础工程。

## 品牌与技术标识

- 用户可见名称：帆帆和关关
- 副标题：双人成长工作台
- Expo slug：`fanfan-guanguan`
- URL scheme：`fanfan-guanguan`
- Android package：`com.fanfan.guanguan`
- iOS bundle identifier：`com.fanfan.guanguan`

旧名称只保留在历史需求文档中，新工程配置和用户可见界面不使用旧名称。

## Task 1 范围

本阶段只包含 Expo SDK 57 基础工程、Expo Router、React Native Web、TypeScript strict、左侧导航、三套主题资源架构、页面骨架、Jest、React Native Testing Library、Playwright、lint、typecheck 和 Web production build。

不包含真实 Supabase 账号、情侣绑定、业务数据库、考公题库或生产发布。

## 常用命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:web
pnpm build:web
```

## 主题资源

Task 1 已建立 `default`、`cat`、`dog` 三套主题资源包。每套包含六个导航 SVG、选中/未选中状态、浅色/深色 token、通用空状态、图表配色和 `license.md`。
