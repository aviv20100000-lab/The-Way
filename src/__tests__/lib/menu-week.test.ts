import { dayKeyForWeekday, getWeekDayKeys, isMarkableDayKey, weekdayOfDayKey } from "@/lib/menu-week";

// 2026-07-27 is a Monday.
const MONDAY = "2026-07-27";

describe("menu-week", () => {
  it("builds a Sunday-start week around the given day", () => {
    expect(getWeekDayKeys(MONDAY)).toEqual([
      "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01",
    ]);
  });

  it("keeps the week stable when asked from the last day of it", () => {
    expect(getWeekDayKeys("2026-08-01")).toEqual(getWeekDayKeys(MONDAY));
  });

  it("maps weekday indexes to real dates and rejects bad ones", () => {
    expect(weekdayOfDayKey(MONDAY)).toBe(1);
    expect(dayKeyForWeekday(0, MONDAY)).toBe("2026-07-26");
    expect(dayKeyForWeekday(6, MONDAY)).toBe("2026-08-01");
    expect(dayKeyForWeekday(7, MONDAY)).toBeNull();
    expect(dayKeyForWeekday(-1, MONDAY)).toBeNull();
  });

  it("only allows marking days that already arrived, inside the current week", () => {
    expect(isMarkableDayKey("2026-07-26", MONDAY)).toBe(true);
    expect(isMarkableDayKey(MONDAY, MONDAY)).toBe(true);
    expect(isMarkableDayKey("2026-07-28", MONDAY)).toBe(false); // tomorrow
    expect(isMarkableDayKey("2026-07-20", MONDAY)).toBe(false); // last week
  });

  it("crosses a month boundary correctly", () => {
    expect(getWeekDayKeys("2026-08-31")[0]).toBe("2026-08-30");
  });
});
