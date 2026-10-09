import { afterEach, describe, expect, it, vi } from "vitest";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { previewEnvironment } from "../test/preview-fixture";
import { loadPreviewConfig } from "./_core/previewPolicy";
import { PreviewStorage, STORAGE_GUARD_KEY } from "./_core/previewStorage";

const config = loadPreviewConfig(previewEnvironment())!;
afterEach(() => vi.restoreAllMocks());

function mockStorage(instanceId = config.instanceId) {
  const send = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: any) => {
    if (command instanceof GetObjectCommand) return {
      Body: { transformToString: async () => JSON.stringify({ instanceId }) },
    };
    if (command instanceof PutObjectCommand) return {};
    throw new Error("Unexpected storage operation");
  });
  return { send, storage: new PreviewStorage(config) };
}

describe("dedicated preview object storage", () => {
  it("verifies identity before writing private files and creates short-lived download URLs", async () => {
    const { send, storage } = mockStorage();
    const result = await storage.put("coach-content/12/file.pgn", "1. e4", "text/plain", "private");
    expect(send.mock.calls[0][0].input).toMatchObject({ Bucket: config.storage.bucket, Key: STORAGE_GUARD_KEY });
    expect(send.mock.calls[1][0].input).toMatchObject({ Bucket: config.storage.bucket, Key: "private/coach-content/12/file.pgn" });
    const url = new URL(result.url);
    expect(url.origin).toBe("http://localhost:9000");
    expect(url.pathname).toBe("/boogme-preview-qa1/private/coach-content/12/file.pgn");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(result.key).toBe("coach-content/12/file.pgn");
  });
  it("uses stable public URLs only for explicitly public uploads", async () => {
    const { send, storage } = mockStorage();
    const result = await storage.put("coach-photos/photo one.jpg", "image", "image/jpeg", "public");
    expect(send.mock.calls[1][0].input).toMatchObject({ Key: "public/coach-photos/photo one.jpg" });
    expect(result.url).toBe("http://localhost:9000/boogme-preview-qa1/public/coach-photos/photo%20one.jpg");
  });
  it("does not write or sign downloads for the wrong bucket marker", async () => {
    const { send, storage } = mockStorage("different");
    await expect(storage.put("file", "data", "text/plain", "public")).rejects.toThrow("identity check failed");
    await expect(storage.get("file")).rejects.toThrow("identity check failed");
    expect(send.mock.calls.every(([command]) => command instanceof GetObjectCommand)).toBe(true);
  });
  it.each(["../file", "private/../public/file", "a//b", "a\\b", "a/./b", ""])("rejects invalid key %s", async key => {
    const { send, storage } = mockStorage();
    await expect(storage.put(key, "data", "text/plain", "private")).rejects.toThrow("Invalid preview storage key");
    await expect(storage.get(key, "public")).rejects.toThrow("Invalid preview storage key");
    expect(send).not.toHaveBeenCalled();
  });

  // Sprint 3: put() stored public objects under public/ but get() always
  // signed private/, so reading back a public key returned a dead URL.
  it("reads a public object back from the prefix it was written under", async () => {
    const { send, storage } = mockStorage();
    const written = await storage.put("coach-photos/photo one.jpg", "image", "image/jpeg", "public");
    const read = await storage.get(written.key, "public");
    expect(read).toEqual(written);
    expect(new URL(read.url).pathname).toBe("/boogme-preview-qa1/public/coach-photos/photo%20one.jpg");
    // Only the identity marker and the upload reached storage; no signing for public reads.
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("keeps private reads signed, short-lived and under private/ by default", async () => {
    const { storage } = mockStorage();
    for (const read of [await storage.get("coach-content/12/file.pgn"), await storage.get("coach-content/12/file.pgn", "private")]) {
      const url = new URL(read.url);
      expect(url.pathname).toBe("/boogme-preview-qa1/private/coach-content/12/file.pgn");
      expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
      expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    }
  });

  it("never hands out a public URL for an unverified bucket", async () => {
    const { storage } = mockStorage("different");
    await expect(storage.get("coach-photos/x.jpg", "public")).rejects.toThrow("identity check failed");
  });
});

describe("storage helpers in preview", () => {
  afterEach(() => { vi.doUnmock("./_core/env"); vi.resetModules(); });

  it("round-trip each visibility through storagePut and storageGet", async () => {
    vi.resetModules();
    vi.doMock("./_core/env", () => ({ ENV: { preview: config } }));
    mockStorage();
    const { storageGet, storagePut } = await import("./storage");
    const avatar = await storagePut("coach-photos/7.jpg", "image", "image/jpeg", "public");
    expect((await storageGet(avatar.key, "public")).url).toBe(avatar.url);
    const content = await storagePut("coach-content/7/lesson.pgn", "1. e4");
    expect(new URL((await storageGet(content.key)).url).pathname).toBe("/boogme-preview-qa1/private/coach-content/7/lesson.pgn");
  });
});
