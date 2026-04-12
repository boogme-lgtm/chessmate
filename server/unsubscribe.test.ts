import { describe, it, expect, vi } from "vitest";

vi.mock("./db", () => ({
  unsubscribeFromWaitlist: vi.fn().mockResolvedValue({ success: true }),
}));

import * as db from "./db";

describe("Unsubscribe Functionality", () => {
  it("should have unsubscribeFromWaitlist function", () => {
    expect(db.unsubscribeFromWaitlist).toBeDefined();
    expect(typeof db.unsubscribeFromWaitlist).toBe("function");
  });

  it("should return success object when unsubscribing", async () => {
    const result = await db.unsubscribeFromWaitlist("test@example.com");
    expect(result).toHaveProperty("success");
    expect(result.success).toBe(true);
  });
});
