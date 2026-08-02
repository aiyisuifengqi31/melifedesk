# Android APK 打包说明

项目已经接入 Expo/EAS 的 Android 打包配置，可以生成真正安装到手机上的 APK。

## 第一次打包

1. 登录 Expo/EAS 账号：

   ```powershell
   .\node_modules\.bin\eas.cmd login
   ```

2. 生成可直接安装的 APK：

   ```powershell
   pnpm build:android:apk
   ```

3. EAS 构建完成后会给出下载链接，下载 `.apk` 文件后发给手机安装。

## 小米手机安装

打开 APK 时，系统可能会提示允许“安装未知来源应用”。按提示给当前文件管理器或聊天软件授权后，再安装一次即可。

## 应用信息

- 应用名称：帆帆和关关
- Android 包名：`com.fanfan.guanguan`
- 分享安装包：使用 `apk` 构建配置
- 应用商店发布：使用 `production` 构建配置
