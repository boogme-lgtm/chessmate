import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getMessageClasses, getMessageSummaries, updateLessonTitle } from "./db";
const fixture = vi.hoisted(() => ({ execute: vi.fn(), where: vi.fn(), set: vi.fn(), update: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => fixture }));
const dialect = new MySqlDialect();
beforeEach(() => {
  vi.clearAllMocks();
  fixture.execute.mockResolvedValue([[]]);
  fixture.update.mockReturnValue(fixture);
  fixture.set.mockReturnValue(fixture);
  fixture.where.mockResolvedValue(undefined);
});

describe("messaging database boundaries", () => {
  it("binds participant identity and IDs for metadata without any read mutation", async () => {
    await getMessageSummaries(42, [10, 20]);
    const query = dialect.sqlToQuery(fixture.execute.mock.calls[0][0]);
    expect(query.sql).toContain("(l.studentId = ? OR l.coachId = ?)");
    expect(query.params).toEqual([42, 42, 10, 20]);
    expect(query.sql).toContain("ORDER BY last.createdAt DESC, last.id DESC LIMIT 1");
    expect(query.sql).toContain("LEFT(latest.content, 200)");
    expect(query.sql).not.toMatch(/UPDATE|INSERT|DELETE/);
  });
  it("does not query empty ID batches", async () => {
    expect(await getMessageSummaries(42, [])).toEqual([]);
    expect(fixture.execute).not.toHaveBeenCalled();
  });
  it.each(["student", "coach"] as const)("scopes %s history and keeps cancelled classes", async role => {
    await getMessageClasses(42, role);
    const query = dialect.sqlToQuery(fixture.execute.mock.calls[0][0]);
    expect(query.sql).toContain(`WHERE l.${role}Id = ?`);
    expect(query.params).toEqual([42, 42]);
    expect(query.sql).not.toMatch(/WHERE[^;]*status\s*(?:=|IN|NOT)/);
  });
  it("uses deterministic history pagination and excludes records after the cursor", async () => {
    const scheduledAt = new Date("2026-10-01T12:00:00Z");
    fixture.execute.mockResolvedValue([Array.from({length: 101}, (_, i) => ({ id: 200-i, scheduledAt, unread: 0 }))]);
    const page = await getMessageClasses(42, "student", { scheduledAt, id: 300 });
    expect(page.items).toHaveLength(100);
    expect(page.nextCursor).toEqual({ scheduledAt, id: 101 });
    const query = dialect.sqlToQuery(fixture.execute.mock.calls[0][0]);
    expect(query.sql).toContain("l.scheduledAt < ? OR (l.scheduledAt = ? AND l.id < ?)");
    expect(query.sql).toContain("ORDER BY l.scheduledAt DESC, l.id DESC LIMIT 101");
    expect(query.params).toEqual([42,42,scheduledAt,scheduledAt,300]);
  });
  it("scopes title writes to both lesson and coach", async () => {
    await updateLessonTitle(10, 42, "Endgames");
    expect(fixture.set).toHaveBeenCalledWith({ topic: "Endgames" });
    const query = dialect.sqlToQuery(fixture.where.mock.calls[0][0]);
    expect(query.sql).toContain("`lessons`.`id` = ?");
    expect(query.sql).toContain("`lessons`.`coachId` = ?");
    expect(query.params).toEqual([10,42]);
  });
});
