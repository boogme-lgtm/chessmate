/** Synthetic values only. No provider endpoint or credential is usable. */
export function previewEnvironment(): Record<string, string> {
  return {
    APP_ENV: "preview", NODE_ENV: "production", PREVIEW_INSTANCE_ID: "qa1",
    DATABASE_URL: "mysql://preview_app:unit_password@127.0.0.1:9/boogme_preview_qa1",
    VITE_APP_ID: "boogme-preview-qa1", VITE_FRONTEND_URL: "http://localhost:3000",
    JWT_SECRET: "unit-preview-jwt-0123456789abcdef-0123456789",
    PREVIEW_MAIL_URL: "http://127.0.0.1:8025",
    PREVIEW_S3_ENDPOINT: "http://storage:9000",
    PREVIEW_S3_PUBLIC_ENDPOINT: "http://localhost:9000",
    PREVIEW_S3_BUCKET: "boogme-preview-qa1", PREVIEW_S3_REGION: "us-east-1",
    PREVIEW_S3_ACCESS_KEY_ID: "preview_unit_key", PREVIEW_S3_SECRET_ACCESS_KEY: "preview_unit_secret",
  };
}
