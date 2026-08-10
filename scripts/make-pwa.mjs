// scripts/make-pwa.mjs
// 在 `expo export --platform web` 之后运行：生成 PWA 资源并注入到 dist 下所有 HTML。
// 与 CI 中的 PAGES_BASE_URL 环境变量配合，自动适配 /melifedesk 子路径。
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  readdirSync,
  statSync,
  mkdirSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('[make-pwa] dist/ 不存在，请先运行 expo export --platform web');
  process.exit(1);
}

// 子路径：来自 PAGES_BASE_URL（如 "/melifedesk"），默认根路径 ""
const base = (process.env.PAGES_BASE_URL || '').replace(/\/+$/, '');
const withBase = (p) => (base ? `${base}${p}` : p); // p 以 "/" 开头

// 每次构建用唯一 ID 作为 SW cache name，确保新版本部署后旧缓存一定被淘汰
const BUILD_ID = (process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 16);
const CACHE = `lifedesk-pwa-${BUILD_ID}`;
const THEME = '#fff8ed';
const NAME = '帆帆和关关 · 双人成长工作台';
const SHORT = '成长工作台';
const DESCRIPTION = '帆帆和关关的双人成长工作台：计划、运动、记账、考公、娱乐、恋爱日记。';
const ORIGIN = 'https://aiyisuifengqi31.github.io';
const PUBLIC_URL = `${ORIGIN}${withBase('/')}`;

// 1) 拷贝应用图标 -> dist/icon-512.png（复用 Expo 应用图标）
const iconSrc = join(root, 'assets', 'icon.png');
const iconDest = join(dist, 'icon-512.png');
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, iconDest);
  console.log('[make-pwa] 已拷贝图标 -> icon-512.png');
} else {
  console.warn('[make-pwa] 未找到 assets/icon.png，跳过图标');
}

// 2) 拷贝主题背景图 -> dist/backgrounds/（运行时按基路径引用）
const bgSrcDir = join(root, 'assets', 'backgrounds');
const bgDestDir = join(dist, 'backgrounds');
if (existsSync(bgSrcDir)) {
  if (!existsSync(bgDestDir)) {
    mkdirSync(bgDestDir, { recursive: true });
  }
  let copied = 0;
  for (const file of readdirSync(bgSrcDir)) {
    if (/\.(jpe?g|png|webp|gif)$/i.test(file)) {
      copyFileSync(join(bgSrcDir, file), join(bgDestDir, file));
      copied++;
    }
  }
  console.log(`[make-pwa] 已拷贝 ${copied} 张背景图 -> backgrounds/`);
} else {
  console.warn('[make-pwa] 未找到 assets/backgrounds，跳过背景图');
}

// 3) 拷贝 iOS 启动屏图片 -> dist/apple-startup/（用 splash.png 而非图标，避免把猫狗图标当启动页）
const startupSrcDir = join(root, 'assets', 'apple-startup');
const startupDestDir = join(dist, 'apple-startup');
const startupImages = [];
if (existsSync(startupSrcDir)) {
  if (!existsSync(startupDestDir)) {
    mkdirSync(startupDestDir, { recursive: true });
  }
  const startupDefinitions = [
    { w: 1290, h: 2796, media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
    { w: 1179, h: 2556, media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
    { w: 1284, h: 2778, media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)' },
    { w: 1170, h: 2532, media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
    { w: 1125, h: 2436, media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)' },
    { w: 1242, h: 2208, media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)' },
    { w: 750, h: 1334, media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
    { w: 1242, h: 2688, media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)' },
  ];
  for (const def of startupDefinitions) {
    const file = `apple-startup-${def.w}x${def.h}.png`;
    const srcPath = join(startupSrcDir, file);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, join(startupDestDir, file));
      startupImages.push({ ...def, file });
    } else {
      console.warn(`[make-pwa] 未找到启动图 ${file}，跳过`);
    }
  }
  console.log(`[make-pwa] 已拷贝 ${startupImages.length} 张 iOS 启动图 -> apple-startup/`);
} else {
  console.warn('[make-pwa] 未找到 assets/apple-startup，跳过 iOS 启动图');
}

// 4) 重命名 Expo 运行时目录 _expo -> expo-static（GitHub Pages 对下划线路径不稳定）
const expoRuntimeDir = join(dist, '_expo');
const publishedRuntimeDir = join(dist, 'expo-static');
if (existsSync(expoRuntimeDir)) {
  if (existsSync(publishedRuntimeDir)) {
    rmSync(publishedRuntimeDir, { recursive: true, force: true });
  }
  renameSync(expoRuntimeDir, publishedRuntimeDir);
  console.log('[make-pwa] 已重命名运行时目录 _expo -> expo-static');

  // 4b) 改写 JS 产物内部的异步分包 URL：`<base>/_expo/...` -> `<base>/expo-static/...`
  // HTML 里的同步 <script src> 由后面的注入步骤改写；但动态 import() 生成的
  // chunk 地址是编译进 JS 字符串里的，如果不改写会 404（例如懒加载路由 chunk）。
  const oldPrefix = withBase('/_expo/');
  const newPrefix = withBase('/expo-static/');
  let rewritten = 0;
  const rewriteJsDir = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        rewriteJsDir(p);
        continue;
      }
      if (!/\.(js|map)$/.test(name)) continue;
      const src = readFileSync(p, 'utf8');
      if (!src.includes(oldPrefix)) continue;
      writeFileSync(p, src.replaceAll(oldPrefix, newPrefix));
      rewritten += 1;
    }
  };
  rewriteJsDir(publishedRuntimeDir);
  console.log(`[make-pwa] 已改写 ${rewritten} 个 JS 产物内的分包路径 ${oldPrefix} -> ${newPrefix}`);
}

// 5) 写入 manifest.json
const manifest = {
  name: NAME,
  short_name: SHORT,
  description: DESCRIPTION,
  start_url: withBase('/'),
  scope: withBase('/'),
  display: 'standalone',
  background_color: THEME,
  theme_color: THEME,
  lang: 'zh-CN',
  orientation: 'portrait',
  icons: [
    { src: withBase('/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: withBase('/icon-512.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
  ],
};
writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 6) 写入 service worker
// - 版本化 CACHE：每次构建唯一，activate 时删除所有旧缓存
// - 导航请求使用 cache: 'no-store' 绕过 GitHub Pages 的 10 分钟 HTML 缓存
// - 静态资源（带内容哈希）缓存优先，离线时回退到应用外壳
const sw = `const CACHE = '${CACHE}';
const BASE = self.location.pathname.replace(/\\/sw\\.js$/, '') + '/';

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // 安装时主动拉取最新 HTML 并缓存，避免 GitHub Pages 的 10 分钟缓存导致回退旧版
      return fetch(BASE + 'index.html', { cache: 'no-store' })
        .then(function (res) {
          if (res && res.ok) cache.put(BASE + 'index.html', res.clone());
        })
        .catch(function () {});
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 导航请求：网络优先并绕过 HTTP 缓存，成功后更新缓存；离线回退到缓存外壳
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(function (res) {
          if (res && res.ok) {
            caches.open(CACHE).then(function (cache) {
              cache.put(BASE + 'index.html', res.clone());
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match(BASE + 'index.html');
        })
    );
    return;
  }

  // 静态资源（内容哈希、不可变）：缓存优先
  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req)
          .then(function (res) {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(function () {
            return caches.match(BASE + 'index.html');
          });
      });
    })
  );
});
`;
writeFileSync(join(dist, 'sw.js'), sw);

// 7) robots.txt（降低搜索引擎/浏览器"空白页"风险判断）
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');

// 8) 注入到 dist 下所有 .html（让深链接路由也能注册 SW、可安装）
function walk(dir, acc) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (entry.endsWith('.html')) acc.push(full);
  }
}
const htmlFiles = [];
walk(dist, htmlFiles);

const metaTags = [
  `<meta name="description" content="${DESCRIPTION}" />`,
  `<meta property="og:title" content="${NAME}" />`,
  `<meta property="og:description" content="${DESCRIPTION}" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:url" content="${PUBLIC_URL}" />`,
  `<meta property="og:image" content="${ORIGIN}${withBase('/icon-512.png')}" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
].join('');

const pwaTags = [
  `<link rel="manifest" href="${withBase('/manifest.json')}" />`,
  `<link rel="apple-touch-icon" href="${withBase('/icon-512.png')}" />`,
  ...startupImages.map(
    (img) => `<link rel="apple-touch-startup-image" media="${img.media}" href="${withBase(`/apple-startup/${img.file}`)}" />`
  ),
  `<meta name="theme-color" content="${THEME}" />`,
  `<meta name="apple-mobile-web-app-capable" content="yes" />`,
  `<meta name="mobile-web-app-capable" content="yes" />`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`,
].join('');

const swScript = `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${withBase('/sw.js')}',{updateViaCache:'none'}).then(function(reg){reg.update();}).catch(function(e){console.warn('SW register failed',e);});});}</script>`;

let injected = 0;
for (const file of htmlFiles) {
  let html = readFileSync(file, 'utf8');
  html = html.replaceAll(withBase('/_expo/'), withBase('/expo-static/'));
  if (html.includes('serviceWorker.register')) continue; // 已注入，跳过
  if (!html.includes('<meta name="description"')) {
    html = html.replace('</head>', `${metaTags}</head>`);
  }
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${pwaTags}${swScript}</head>`);
  } else if (html.includes('</html>')) {
    html = html.replace('</html>', `${pwaTags}${swScript}</html>`);
  } else {
    html += pwaTags + swScript;
  }
  writeFileSync(file, html);
  injected++;
}
console.log(`[make-pwa] 已注入 ${injected} 个 HTML（manifest / icon / SW 注册 / 启动图 / SEO）`);
console.log('[make-pwa] base =', JSON.stringify(base || '/'));
console.log('[make-pwa] sw cache =', CACHE);
