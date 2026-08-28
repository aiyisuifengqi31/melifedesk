# Love Story Diary Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Love Story feel like a shared couple-space feed: Love Story becomes a primary nav entry, Diary opens to archive cards, publishing moves behind a floating `+`, and author/comment persistence is added without breaking the existing couple sync.

**Architecture:** Keep `LovePanel` as the owning UI component but move the diary create/edit form into a modal sheet state. Extend the diary cloud repository with optional `author_id` and a small comments repository, using migration fallbacks so older databases still render safely. Keep shared Love data scoped through the existing couple diary path.

**Tech Stack:** React Native Web, Expo Router-style routes, Jest with `@testing-library/react-native`, Supabase SQL migrations.

---

### Task 1: Navigation Placement

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/navigation/items.ts`
- Test: `src/__tests__/navigation.test.tsx`

- [ ] Update tests so primary navigation includes Home, Daily Plan, Finance, Love Story, and More, while More contains Exam, Workout, and Entertainment.
- [ ] Change `PRIMARY_ROUTE_KEYS` to include `love` and remove `exam`.
- [ ] Change `MORE_ROUTE_KEYS` to include `exam`, `workout`, and `fun`.
- [ ] Rename the nav label for `love` from `恋爱\n日记` to `恋爱\n故事`.
- [ ] Run the navigation test file and verify the expected red/green path.

### Task 2: Diary Feed Entry Point

**Files:**
- Modify: `src/features/love/LovePanel.tsx`
- Test: `src/__tests__/task6-love-ui.test.tsx`

- [ ] Update tests so `写日记` and its fields are absent on first render.
- [ ] Add a test that pressing the floating publish button opens the write diary sheet.
- [ ] Add local state for `diaryComposerOpen`.
- [ ] Move the existing write diary form into a bottom-sheet/modal view.
- [ ] Open the composer from a fixed pink floating `+` button.
- [ ] Open the composer automatically when editing an existing diary.
- [ ] Reset composer state after successful save or cancel.

### Task 3: Diary Cards With Author Context

**Files:**
- Modify: `src/features/love/LovePanel.tsx`
- Test: `src/__tests__/task6-love-ui.test.tsx`

- [ ] Extend `DiaryEntry` with optional `authorId`, `authorName`, and `authorAvatar`.
- [ ] Set new diary `authorId` from the current logged-in user.
- [ ] Render diary cards as feed cards with author avatar, author label, date, title, preview, tags, image thumbnails, comment count, and menu.
- [ ] For legacy entries, show a safe fallback author label instead of assigning current user.
- [ ] Keep edit/delete permission behavior based on current ownership.

### Task 4: Persistent Comments

**Files:**
- Create: `supabase/migrations/202608280001_love_diary_author_comments.sql`
- Modify: `src/features/love/loveDiaryCloud.ts`
- Create: `src/features/love/loveDiaryComments.ts`
- Test: `src/__tests__/love-diary-cloud.test.ts`

- [ ] Add migration for nullable `diary_entries.author_id`.
- [ ] Add `diary_comments` with `diary_id`, `user_id`, `content`, timestamps, soft delete fields, and RLS using `can_read_diary_entry`.
- [ ] Include `author_id` in diary selects/upserts with a fallback when the column is missing.
- [ ] Add comment load/save/delete helpers.
- [ ] Add tests for author upsert/mapping and own-comment deletion RPC/table update behavior.

### Task 5: Photo Wall Shared Folder Presentation

**Files:**
- Modify: `src/features/love/LovePanel.tsx`
- Test: `src/__tests__/cloud-backed-storage.test.ts`

- [ ] Keep diary images flowing into the Photo Wall.
- [ ] Ensure un-foldered diary images appear under the built-in `日记本` group.
- [ ] Ensure foldered diary images use the chosen folder name.
- [ ] Keep Photo Wall folder creation visible and compact.

### Task 6: Verification and Finish

**Files:**
- Verify touched files only plus build.

- [ ] Run navigation, love UI, love cloud, and photo grouping tests.
- [ ] Run the project build.
- [ ] Review `git diff` for unintended database/business changes.
- [ ] Commit the implementation.
- [ ] If deployment is requested in the same turn, push `HEAD:main` and verify GitHub Pages.
