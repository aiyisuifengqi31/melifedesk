# Love Story Diary Feed Design

## Goal

Turn the current Love Diary tab into a shared couple story feed that is easier to browse on mobile: the main Love entry moves into primary navigation, the Diary tab opens to existing diary archives instead of a permanent write form, and new diary posts are created from a floating publish button. The change must preserve the existing couple binding, shared diary sync, gifts, anniversaries, photo wall, and current save/edit/delete behavior.

## Navigation

- Primary left navigation becomes: Home, Daily Plan, Finance, Love Story, More.
- Love Story uses the existing love/couple themed icon resources and routes to the current Love page.
- Exam moves under More.
- More contains Exam, Workout, and Entertainment.
- Existing route keys and business pages remain intact; only the placement and label of navigation items changes.

## Love Diary Default Screen

- The Diary tab no longer shows the write-diary form by default.
- The default view shows:
  - compact bound/sync status;
  - diary archive title and count;
  - search and compact filters;
  - diary cards;
  - existing Love sub-tabs: Diary, Gifts, Anniversary, Photo Wall.
- The current write form fields are moved into a modal/bottom sheet opened by the floating publish button.
- Search, date, type, folder, and sort filters keep their current behavior and stay compact on mobile.

## Floating Publish Button

- A pink Love-themed floating `+` button appears near the lower-right corner inside the content area.
- It uses safe-area spacing and does not cover the bottom Love sub-tabs.
- Pressing it opens the write-diary bottom sheet.
- The button is only an entry point; it does not create data by itself and does not change routes.

## Write Diary Bottom Sheet

- The bottom sheet reuses the current diary creation/editing state and save flow.
- It supports:
  - title;
  - date;
  - content;
  - type;
  - mood;
  - folder;
  - image upload;
  - multiple image previews;
  - remove image;
  - loading state;
  - save success/failure messaging.
- Closing the sheet without saving does not alter existing data.
- Editing an existing diary may reuse the same sheet if that fits the current component structure.

## Author Identity

- New diary records must store the real current logged-in user as the author.
- Preferred persistent field: `author_id`.
- If profile data is available, author name and avatar are displayed by looking up the profile from `author_id`; users do not manually choose an author.
- Existing legacy diary records are handled safely:
  - if a record already has creator, owner, or user information, display that as the author source;
  - if no trustworthy author field exists, display `历史记录` or `作者未知`;
  - never randomly assign the current logged-in user as author for old data.

## Diary Cards

- Diary cards become feed-style cards:
  - author avatar;
  - author display name;
  - date/time;
  - title;
  - content preview;
  - mood/type/folder tags;
  - attached image thumbnails;
  - like/comment/menu row.
- The menu keeps existing edit/delete entry points and must not weaken current permissions.
- Cards should stay compact enough for mobile browsing while keeping all text readable.

## Comments

- Add persistent comments for diary entries.
- Proposed table: `diary_comments`.
- Required fields:
  - `id`;
  - `diary_id`;
  - `user_id`;
  - `content`;
  - `created_at`;
  - `updated_at`.
- Both users in the bound couple can read and add comments on shared couple diaries.
- Users can delete only their own comments.
- Comments are not local-only state. They must survive refresh and be visible to the partner after sync.
- If the current Supabase schema or RLS cannot safely support comments, stop implementation at the migration/API boundary and report the exact blocker instead of forcing unsafe client-only behavior.

## Photo Wall Sharing Boundary

- Photo wall remains part of the shared Love Story area.
- The photo wall should use couple-scoped shared data, consistent with the shared Love modules.
- Users can create folders in the photo wall for classification.
- Photos added through diary posts should be able to appear in a Diary folder in the photo wall.
- The implementation should reuse existing diary image data where possible and avoid duplicating files unnecessarily.

## Data Flow

- Shared Love data continues to be scoped by the current couple identity.
- Diary records are still shared through the existing couple diary sync path.
- New author/comment fields extend that path without changing the existing couple binding model.
- Personal/private data outside Love Story is not part of this change.

## Error Handling

- If the user is not bound, the page keeps the existing unbound state and does not show shared actions that require a couple.
- If author profile lookup fails, the diary still renders using a safe fallback name.
- If comments fail to load, the diary feed remains usable and shows a lightweight failure state near comments.
- If saving a diary/comment fails, preserve the user's typed content and show the existing error feedback pattern.

## Testing

- Navigation tests should verify Love Story is primary and Exam is under More.
- Diary UI tests should verify the default Diary tab does not show the write form until the floating `+` is pressed.
- Diary save tests should verify new records include the current user as author.
- Comment tests should verify partner-visible shared comments and own-comment deletion rules at the client/API boundary.
- Legacy tests should verify old diary records without author data render with a fallback author instead of being assigned to the current user.

## Out Of Scope

- No redesign of Gifts, Anniversaries, or Photo Wall beyond preserving compatibility and shared Love Story placement.
- No rewrite of couple binding.
- No rewrite of Supabase auth, RLS, or shared diary ownership model beyond the minimal author/comment additions.
- No changes to workout, finance, exam, entertainment, or home business logic.
