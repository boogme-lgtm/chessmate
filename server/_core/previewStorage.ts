import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PreviewConfig } from "./previewPolicy";

export const STORAGE_GUARD_KEY = "boogme_preview_guard.json";

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

  async put(input: string, data: Buffer | Uint8Array | string, contentType: string, visibility: "private" | "public") {
    const key = logicalKey(input);
    await this.verify();
    const objectKey = `${visibility}/${key}`;
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.config.storage.bucket, Key: objectKey, Body: data, ContentType: contentType,
      }));
    } catch { throw new Error("Preview storage upload failed"); }
    if (visibility === "public") {
      const encoded = objectKey.split("/").map(encodeURIComponent).join("/");
      return { key, url: `${this.config.storage.publicEndpoint}/${this.config.storage.bucket}/${encoded}` };
    }
    return this.get(key);
  }

  async get(input: string) {
    const key = logicalKey(input);
    await this.verify();
    const url = await getSignedUrl(this.downloadClient, new GetObjectCommand({
      Bucket: this.config.storage.bucket, Key: `private/${key}`,
    }), { expiresIn: 300 });
    return { key, url };
  }
}
