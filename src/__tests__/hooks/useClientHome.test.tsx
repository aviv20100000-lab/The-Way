import { act, renderHook, waitFor } from "@testing-library/react";
import { useClientHome } from "@/hooks/client/useClientHome";

jest.mock("@/lib/csrf-client", () => ({ getCsrfToken: jest.fn().mockResolvedValue("csrf") }));
jest.mock("@/lib/push-client", () => ({ subscribeCurrentDeviceToPush: jest.fn() }));

const homeResponse = {
  quotes: [],
  water: { total: 0, goal: 2000 },
  steps: 0,
  steps_goal: 10000,
  calories: { total: 0, goal: null },
  goal_status: { target_weight: false, calories: false, protein: false, water: false, steps: false },
};

describe("useClientHome addWater", () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn(() => ({ matches: false, addListener: jest.fn(), removeListener: jest.fn() })),
    });
  });

  it("rolls back the optimistic total when the API rejects the update", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      if (String(input) === "/api/home") {
        return Promise.resolve({ ok: true, json: async () => homeResponse } as Response);
      }
      return Promise.resolve({ ok: false, status: 500 } as Response);
    }) as jest.Mock;

    const { result } = renderHook(() => useClientHome());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.addWater(500);
    });

    expect(succeeded).toBe(false);
    expect(result.current.waterTotal).toBe(0);
    expect(result.current.waterAddError).toContain("לא הצלחנו לעדכן");
  });
});
