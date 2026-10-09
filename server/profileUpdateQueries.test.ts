import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { updateStudentChessProfiles, updateUserProfile } from "./db";
const fixture = vi.hoisted(() => ({ where: vi.fn(), set: vi.fn(), update: vi.fn() }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => fixture }));
const dialect = new MySqlDialect();
beforeEach(() => {
  vi.clearAllMocks();
  fixture.update.mockReturnValue(fixture);
  fixture.set.mockReturnValue(fixture);
  fixture.where.mockResolvedValue(undefined);
});

// drizzle's .set() throws "No values to set" when every key is undefined, so
// these helpers must skip the UPDATE entirely instead of issuing an empty SET.
describe("profile update database boundaries", () => {
  it.each([{}, { chesscomUsername: undefined, lichessUsername: undefined, fideId: undefined }])(
    "issues no chess-profile UPDATE for %o", async data => {
      await updateStudentChessProfiles(1, data);
      expect(fixture.update).not.toHaveBeenCalled();
    });
  it("writes NULL to unlink and scopes the update to the student", async () => {
    await updateStudentChessProfiles(1, { chesscomUsername: null, lichessUsername: undefined });
    expect(fixture.set).toHaveBeenCalledWith({ chesscomUsername: null, lichessUsername: undefined });
    const query = dialect.sqlToQuery(fixture.where.mock.calls[0][0]);
    expect(query.sql).toContain("`student_profiles`.`userId` = ?");
    expect(query.params).toEqual([1]);
  });
  it.each([{}, { name: undefined, bio: undefined }])("issues no user-profile UPDATE for %o", async data => {
    await updateUserProfile(7, data);
    expect(fixture.update).not.toHaveBeenCalled();
  });
  it("writes NULL to clear a user-profile field", async () => {
    await updateUserProfile(7, { bio: null });
    expect(fixture.set).toHaveBeenCalledWith({ bio: null });
  });
});
