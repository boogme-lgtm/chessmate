import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PreviewConfig } from "./previewPolicy";

export const STORAGE_GUARD_KEY = "boogme_preview_guard.json";

/**
 * Where an object lives. Public objects get stable unsigned URLs; private ones
 * only short-lived signed URLs. Callers persist the logical key, so they pass
 * the same visibility to storageGet that they used for storagePut.
 */
export type StorageVisibility = "private" | "public";

function logicalKey(input: string): string {
  const key = input.replace(/^\/+/, "");
  if (!key || key.length > 1024 || /[\\\x00-\x1f\x7f]/.test(key)
    || key.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("Invalid preview storage key");
  }
  return key;
}

export class PreviewStorage {
  private readonly client: S3Client;
  private readonly downloadClient: S3Client;
  private ready: Promise<void> | undefined;

  constructor(private readonly config: PreviewConfig) {
    const storage = config.storage;
    const common = {
      region: storage.region,
      credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey },
      forcePathStyle: true,
      maxAttempts: 1,
    };
    this.client = new S3Client({ ...common, endpoint: storage.endpoint });
    // Presigning is local. The browser must receive the external storage origin,
    // not an internal Docker service name.
    this.downloadClient = new S3Client({ ...common, endpoint: storage.publicEndpoint });
  }

  verify(): Promise<void> {
    this.ready ??= this.verifyMarker().catch(error => {
      this.ready = undefined;
      throw error;
    });
    return this.ready;
  }

  private async verifyMarker(): Promise<void> {
    try {
      const result = await this.client.send(new GetObjectCommand({
        Bucket: this.config.storage.bucket, Key: STORAGE_GUARD_KEY,
      }));
      if (!result.Body || (result.ContentLength ?? 0) > 1024) throw new Error("Missing marker");
      const marker = JSON.parse(await result.Body.transformToString());
      if (marker.instanceId !== this.config.instanceId) throw new Error("Incorrect marker");
    } catch {
      throw new Error("Preview storage identity check failed; use the dedicated initialized preview bucket");
    }
  }

  async put(input: string, data: Buffer | Uint8Array | string, contentType: string, visibility: StorageVisibility) {
    const key = logicalKey(input);
    await this.verify();
    const objectKey = `${visibility}/${key}`;
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.config.storage.bucket, Key: objectKey, Body: data, ContentType: contentType,
      }));
    } catch { throw new Error("Preview storage upload failed"); }
    return { key, url: await this.downloadUrl(visibility, key) };
  }

  /** Read from the prefix the object was written under (private unless stated). */
  async get(input: string, visibility: StorageVisibility = "private") {
    const key = logicalKey(input);
    await this.verify();
    return { key, url: await this.downloadUrl(visibility, key) };
  }

  private async downloadUrl(visibility: StorageVisibility, key: string): Promise<string> {
    const objectKey = `${visibility}/${key}`;
    if (visibility === "public") {
      const encoded = objectKey.split("/").map(encodeURIComponent).join("/");
      return `${this.config.storage.publicEndpoint}/${this.config.storage.bucket}/${encoded}`;
    }
    return getSignedUrl(this.downloadClient, new GetObjectCommand({
      Bucket: this.config.storage.bucket, Key: objectKey,
    }), { expiresIn: 300 });
  }
}
