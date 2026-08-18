import { buildMonthRows } from "@/shared/ui/DatePickerPopup";

describe("DatePickerPopup calendar rows", () => {
  it("keeps August 18, 2026 under Tuesday in a Monday-first calendar", () => {
    const rows = buildMonthRows(2026, 7);
    const august18Row = rows.find((row) => row.some((day) => day.date === "2026-08-18"));

    expect(august18Row?.map((day) => day.date)).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23"
    ]);
  });
});
