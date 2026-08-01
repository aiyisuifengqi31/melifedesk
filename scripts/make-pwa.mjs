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

const CACHE = 'lifedesk-pwa-v1';
const THEME = '#fff8ed';
const NAME = '帆帆和关关 · 双人成长工作台';
const SHORT = '成长工作台';

// 1) 拷贝应用图标 -> dist/icon-512.png（复用 Expo 应用图标）
const iconSrc = join(root, 'assets', 'icon.png');
const iconDest = join(dist, 'icon-512.png');
if (existsSync(iconSrc)) {
  copyFileSync(iconSrc, iconDest);
  console.log('[make-pwa] 已拷贝图标 -> icon-512.png');
} else {
  console.warn('[make-pwa] 未找到 assets/icon.png，跳过图标');
}

// 2) 写入 manifest.json
const manifest = {
  name: NAME,
  short_name: SHORT,
  description: '帆帆和关关的双人成长工作台：计划、运动、记账、考公、娱乐、恋爱日记。',
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

// 3) 写入 service worker（与子路径无关：运行时从自身 URL 推导 BASE）
const sw = `const CACHE = '${CACHE}';
const BASE = self.location.pathname.replace(/\\/sw\\.js$/, '') + '/';

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(function (c) {
    return c.add(BASE + 'index.html').catch(function () {});
  }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
      return caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 导航请求：网络优先，离线时回退到缓存的应用外壳
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match(BASE + 'index.html').then(function (r) { return r || caches.match(BASE); });
      })
    );
    return;
  }

  // 静态资源（内容哈希、不可变）：缓存优先
  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () {
          return cached || caches.match(BASE + 'index.html');
        });
      });
    })
  );
});
`;
writeFileSync(join(dist, 'sw.js'), sw);

// 4) 注入到 dist 下所有 .html（让深链接路由也能注册 SW、可安装）
function walk(dir, acc) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (entry.endsWith('.html')) acc.push(full);
  }
}
const htmlFiles = [];
walk(dist, htmlFiles);

const tags = [
  `<link rel="manifest" href="${withBase('/manifest.json')}" />`,
  `<link rel="apple-touch-icon" href="${withBase('/icon-512.png')}" />`,
  `<meta name="theme-color" content="${THEME}" />`,
  `<meta name="apple-mobile-web-app-capable" content="yes" />`,
  `<meta name="mobile-web-app-capable" content="yes" />`,
  `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`,
].join('');

const swScript = `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${withBase('/sw.js')}').catch(function(e){console.warn('SW register failed',e);});});}</script>`;

let injected = 0;
for (const file of htmlFiles) {
  let html = readFileSync(file, 'utf8');
  if (html.includes('serviceWorker.register')) continue; // 已注入，跳过
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${tags}${swScript}</head>`);
  } else if (html.includes('</html>')) {
    html = html.replace('</html>', `${tags}${swScript}</html>`);
  } else {
    html += tags + swScript;
  }
  writeFileSync(file, html);
  injected++;
}
console.log(`[make-pwa] 已注入 ${injected} 个 HTML（manifest / icon / SW 注册）`);
console.log('[make-pwa] base =', JSON.stringify(base || '/'));
