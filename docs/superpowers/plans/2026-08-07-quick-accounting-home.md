# Quick Accounting Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make finance entry a fast homepage and global shortcut flow while repositioning the finance page as stats, statements, savings, gifts, and category management.

**Architecture:** Extract one shared `QuickAccountingSheet` in `src/features/finance/` that owns category selection, numeric amount entry, save, close, and undo. `AppShell` hosts the sheet so home, finance stats, and sidebar shortcuts all call the same entry point. `FinancePanel` removes the record tab and renders compact statements under stats.

**Tech Stack:** Expo Router, React Native Web, TypeScript, Jest, existing `financeStorage`, `financeService`, `FixedBottomTabs`, and `QUICK_CAPTURE_DATA_EVENT`.

---

### Task 1: Tests for the New Flow

**Files:**
- Modify: `src/__tests__/finance-interactions.test.tsx`
- Modify: `src/__tests__/floating-controls.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that assert:

```typescript
it("opens quick accounting from the homepage without navigating to finance", () => {
  render(<AppShell initialRoute="/home" />);
  fireEvent.press(screen.getByRole("button", { name: "快速记账：记一笔" }));
  expect(screen.getByText("选择分类")).toBeOnTheScreen();
  expect(screen.getByText("支出")).toBeOnTheScreen();
  expect(screen.getByText("收入")).toBeOnTheScreen();
  expect(screen.queryByText("快速记一笔")).toBeNull();
});

it("clicking today's expense opens quick accounting", () => {
  render(<AppShell initialRoute="/home" />);
  fireEvent.press(screen.getByRole("button", { name: "打开今日支出" }));
  expect(screen.getByText("选择分类")).toBeOnTheScreen();
});

it("records an expense from the shared quick accounting sheet and updates home today expense", () => {
  render(<AppShell initialRoute="/home" />);
  fireEvent.press(screen.getByRole("button", { name: "快速记账：记一笔" }));
  fireEvent.press(screen.getByRole("button", { name: "选择分类：买菜" }));
  fireEvent.press(screen.getByRole("button", { name: "输入金额 2" }));
  fireEvent.press(screen.getByRole("button", { name: "输入金额 6" }));
  fireEvent.press(screen.getByRole("button", { name: "完成记账" }));
  expect(screen.getByText("已记录 买菜 -¥26.00")).toBeOnTheScreen();
  expect(screen.getAllByText("¥26.00").length).toBeGreaterThan(0);
});

it("removes the record tab and defaults finance to stats", () => {
  render(<AppShell initialRoute="/finance" />);
  expect(screen.queryByTestId("secondary-tab-record")).toBeNull();
  expect(screen.getByTestId("secondary-tab-stats")).toBeOnTheScreen();
  expect(screen.getByText("近7天支出趋势")).toBeOnTheScreen();
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
$env:PATH='C:\Users\wangfan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
node .\node_modules\jest\bin\jest.js --runInBand --silent --runTestsByPath src\__tests__\finance-interactions.test.tsx src\__tests__\floating-controls.test.tsx
```

Expected: FAIL because the sheet and finance tab changes do not exist.

### Task 2: Shared QuickAccountingSheet

**Files:**
- Create: `src/features/finance/QuickAccountingSheet.tsx`
- Modify: `src/features/finance/financeStorage.ts`

- [ ] **Step 1: Implement the sheet**

Create a component with props:

```typescript
type QuickAccountingSheetProps = {
  initialType?: TransactionType;
  onClose: () => void;
  onSaved: (transaction: FinanceTransaction) => void;
  storage?: FinanceStorage;
  tokens: UiTokens;
  visible: boolean;
};
```

Behavior:
- If `visible` is false, return null.
- Step `category` shows `支出 / 收入`, recent chips from existing transactions, and 4-column category grid.
- Step `amount` shows selected category, date button, optional note, custom keypad, and disabled/enabled `完成`.
- Save creates `FinanceTransaction`, calls `saveFinanceTransactions`, dispatches `QUICK_CAPTURE_DATA_EVENT`, and calls `onSaved(transaction)`.
- Undo is handled by the host by deleting the created transaction from the same storage.

- [ ] **Step 2: Run tests and verify partial GREEN**

Run the same targeted Jest command. Expected: tests still fail until host wiring exists, but component compiles.

### Task 3: Host Sheet in AppShell

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/features/home/HomePanel.tsx`

- [ ] **Step 1: Add host state**

In `AppShell`, add:

```typescript
const [quickAccountingOpen, setQuickAccountingOpen] = useState(false);
const [quickAccountingToast, setQuickAccountingToast] = useState<FinanceTransaction | null>(null);
```

Pass `onOpenQuickAccounting={() => setQuickAccountingOpen(true)}` into `HomePanel`.

- [ ] **Step 2: Route sidebar finance shortcut to the sheet**

In `openShortcut`, when `kind === "finance"`, close menus and call `setQuickAccountingOpen(true)` without navigating to `/finance`.

- [ ] **Step 3: Render the sheet and toast**

Render `QuickAccountingSheet` at the shell root. On save, show `已记录 {category} -¥{amount}` and an `撤销` button. Undo removes the transaction and dispatches `QUICK_CAPTURE_DATA_EVENT`.

- [ ] **Step 4: Add homepage compact card**

In `HomePanel`, add props:

```typescript
onOpenQuickAccounting?: () => void;
```

Render `快速记账` after `今日概览`; pressing `＋ 记一笔` calls the prop. Change `今日支出` overview click to the same prop.

- [ ] **Step 5: Run targeted tests**

Expected: homepage quick accounting tests pass.

### Task 4: Reposition FinancePanel

**Files:**
- Modify: `src/features/finance/FinancePanel.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/__tests__/finance-interactions.test.tsx`
- Modify: `src/__tests__/floating-controls.test.tsx`

- [ ] **Step 1: Remove record tab from public tabs**

Change:

```typescript
export type FinanceTab = "stats" | "gifts" | "saving" | "category";
export const financeTabs = [
  { label: "统计", value: "stats" },
  { label: "份子", value: "gifts" },
  { label: "储蓄", value: "saving" },
  { label: "分类", value: "category" }
];
```

Initialize AppShell finance tab to `stats`.

- [ ] **Step 2: Remove large quick record form rendering**

Delete the `record` branch UI and keep save helpers only if still used by gifts or category logic. Add a compact title button `＋记账` in stats that opens `QuickAccountingSheet`.

- [ ] **Step 3: Add `本月流水` under category share**

Reuse the existing grouped statement rendering. Limit to 10 records by default. Add filter chips `全部 / 支出 / 收入 / 转账`. Add `查看更多流水` that opens an overlay with full filtered list.

- [ ] **Step 4: Run targeted tests**

Expected: finance tab and statement tests pass.

### Task 5: Verification and Deployment

**Files:**
- Verify only; no planned source edits.

- [ ] **Step 1: Typecheck**

Run:

```powershell
$env:PATH='C:\Users\wangfan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
node .\node_modules\typescript\bin\tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 2: Full Jest**

Run:

```powershell
node .\node_modules\jest\bin\jest.js --runInBand --silent
```

Expected: all suites pass.

- [ ] **Step 3: Web build**

Run:

```powershell
.\node_modules\.bin\expo.CMD export --platform web
node scripts\make-pwa.mjs
```

Expected: `Exported: dist` and PWA injection succeeds.

- [ ] **Step 4: Commit and push**

Run:

```powershell
git add src docs .gitignore
git commit -m "feat: add homepage quick accounting"
git push origin main
```

Expected: GitHub Pages deploy starts from `main`.
