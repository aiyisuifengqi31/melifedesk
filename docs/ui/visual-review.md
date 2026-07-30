# UI Visual Review

## Current Preview Addresses

- Local development preview: http://localhost:8081
- Local static preview: http://127.0.0.1:8090
- Online preview: pending Expo or Netlify login authorization.

## Local Preview Commands

```bash
pnpm start --web
```

Open http://localhost:8081.

```bash
pnpm build:web
pnpm serve:web
```

Open http://127.0.0.1:8090.

For one-command static preview:

```bash
pnpm preview:web
```

## Online Preview Deployment

Preferred preview platform: EAS Hosting preview.

```bash
pnpm build:web
pnpm dlx eas-cli login
pnpm dlx eas-cli deploy --environment preview --export-dir dist
```

Rules:

- Do not run `eas deploy --prod`.
- Do not bind a production domain.
- Use the remote Supabase dev project only.
- Configure only public client variables in the preview environment:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Do not configure `SUPABASE_SERVICE_ROLE_KEY`.
- Do not configure `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- Do not upload database passwords, pooler strings, or direct database URLs.

Backup preview platform: Netlify preview deploy.

```bash
pnpm build:web
pnpm --package=netlify-cli dlx netlify login
pnpm --package=netlify-cli dlx netlify deploy --dir=dist
```

Only run `netlify deploy --prod` during a future production release task.

## Pages To Check After Each UI Change

- Login: `/login`
- Daily plan: `/plan`
- Workout: `/workout`
- Finance: `/finance`
- Love diary: `/love`
- Gifts: `/gifts`
- Exam placeholder: `/exam`
- Settings/auth controls: `/login`
- Theme switching: sidebar theme controls
- Dark mode: sidebar mode control

Each page must pass:

- Page opens.
- Left sidebar exists.
- Current navigation item is highlighted.
- No horizontal overflow.
- Mobile narrow layout is usable.
- Desktop wide layout is usable.
- No `LifeDesk` text appears.
- No debug `testLabel` text appears.
- No obvious blank gaps or misalignment.
- Browser console has no obvious runtime errors.

## Viewport Checklist

Mobile:

- 360 x 740
- 390 x 844
- 430 x 932

Desktop web:

- 1024 x 768
- 1280 x 800
- 1440 x 900

## Feedback Record Format

页面：
问题：
截图：
期望效果：
优先级：
是否影响功能：
