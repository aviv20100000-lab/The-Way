import { act, fireEvent, render, screen } from "@testing-library/react";
import { QuickMealLogger } from "@/components/QuickMealLogger";

describe("QuickMealLogger search states", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => jest.useRealTimers());

  it("shows loading and then an empty state", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] }) as jest.Mock;
    render(<QuickMealLogger />);

    fireEvent.change(screen.getByLabelText("חיפוש מזון"), { target: { value: "אורז" } });
    expect(screen.queryByText("מחפש...")).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("לא נמצאו תוצאות")).not.toBeNull();
  });

  it("shows a connection error instead of swallowing it", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as jest.Mock;
    render(<QuickMealLogger />);
    fireEvent.change(screen.getByLabelText("חיפוש מזון"), { target: { value: "אורז" } });

    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("שגיאת חיבור, נסה שוב")).not.toBeNull();
  });
});
