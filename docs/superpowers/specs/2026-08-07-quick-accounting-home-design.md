# Quick Accounting Home Design

## Goal

Move daily expense entry out of the finance page and make it a fast homepage action. The finance page becomes a place for statistics, statement review, savings, gift money, and category management.

## Scope

- Keep the current background image, green theme, translucent white cards, and mobile-first layout.
- Add a compact `快速记账` card to the homepage after `今日概览`.
- Clicking `＋ 记一笔` opens a reusable `QuickAccountingSheet`.
- Clicking `今日概览`里的`今日支出` also opens the same sheet.
- The left-bottom quick menu `支出` uses the same sheet.
- Remove the large quick-record form from the finance page.
- Finance bottom tabs become `统计 / 份子 / 储蓄 / 分类`; `统计` is the default.
- Old `/finance?tab=record` intent falls back to `stats`.
- Add `本月流水` under monthly category share, showing only recent records by default.

## QuickAccountingSheet

The sheet is a bottom sheet aligned to the right-side main content area, not the left sidebar. It has two steps:

1. Category step:
   - Default type is `支出`.
   - Users can switch between `支出` and `收入`.
   - Categories render in a 4-column grid.
   - Recent/common categories appear above the grid when available.
   - Category visuals use the existing green theme and simple icon circles.

2. Amount step:
   - Shows selected category and default date `今天`.
   - Amount is required and supports up to two decimals.
   - Note is optional and compact.
   - A custom numeric keypad is shown inside the sheet.
   - `完成` is disabled while amount is empty or zero.

On save, the sheet persists a real `FinanceTransaction`, closes, refreshes home overview and finance stats, and shows a lightweight success toast with an undo action.

## Finance Page

The finance page no longer owns the primary entry form. It defaults to `统计` and includes:

- `收支概览`
- `近7天支出趋势`
- `本月分类占比`
- `本月流水`, with filters `全部 / 支出 / 收入 / 转账`

The `本月流水` list is grouped by date, newest first, compact, and initially limited to the most recent 8 to 10 records. `查看更多流水` opens a full statement overlay in this change set.

## Data Flow

All entry points call one shared save path:

`HomePanel / Sidebar shortcut / Finance stats button -> QuickAccountingSheet -> saveFinanceTransactions -> QUICK_CAPTURE_DATA_EVENT -> dependent panels refresh`

No static finance data is introduced. The existing local/cloud-backed finance storage remains the source of truth.

## Testing

Add focused tests for:

- Homepage renders compact `快速记账` after `今日概览`.
- Pressing `＋ 记一笔` opens category selection without navigating.
- Pressing `今日支出` opens the same sheet.
- Selecting a category advances to amount input.
- Saving creates a real transaction and updates today expense immediately.
- Finance tabs no longer include `记录` and default to `统计`.
- Finance stats includes `本月流水` grouped by date.

## Constraints

- Do not change background assets or the overall green theme.
- Do not leave duplicate finance entry logic in home, sidebar, and finance page.
- Do not let the bottom sheet cover the sidebar.
- Do not let keyboard/input behavior move the fixed sidebar.
