type Environment = Record<string, string | undefined>;

export type PreviewConfig = Readonly<{
  instanceId: string;
  databaseName: string;
  allowLocalHttp: boolean;
  mailOrigin: string;
  storage: Readonly<{
    endpoint: string;
    publicEndpoint: string;
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  }>;
}>;

function requireSetting(env: Environment, name: string): string {
  const value = env[name];
  if (!value || value !== value.trim()) throw new Error(`Preview requires a valid ${name}`);
  return value;
}

const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

function origin(env: Environment, name: string): URL {
  let url: URL;
  try { url = new URL(requireSetting(env, name)); }
  catch { throw new Error(`Preview requires a valid ${name}`); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`Preview requires an HTTP(S) origin in ${name}`);
  }
  return url;
}

/** Validate before SDK clients, database connections or background work initialize. */
export function loadPreviewConfig(env: Environment): PreviewConfig | undefined {
  const mode = env.APP_ENV ?? (env.NODE_ENV === "production" ? "production" : "development");
  if (!["preview", "production", "development"].includes(mode)) {
    throw new Error("APP_ENV must be preview, production or development");
  }
  if (mode !== "preview") return undefined;

  const instanceId = requireSetting(env, "PREVIEW_INSTANCE_ID");
  if (!/^[a-z][a-z0-9]{1,23}$/.test(instanceId)) {
    throw new Error("PREVIEW_INSTANCE_ID must be 2-24 lowercase letters/digits, starting with a letter");
  }
  const databaseName = `boogme_preview_${instanceId}`;
  let database: URL;
  try { database = new URL(requireSetting(env, "DATABASE_URL")); }
  catch { throw new Error("Preview requires a valid DATABASE_URL"); }
  let databaseUser: string;
  try { databaseUser = decodeURIComponent(database.username).toLowerCase(); }
  catch { throw new Error("Preview requires a valid DATABASE_URL user"); }
  if (database.protocol !== "mysql:" || database.pathname !== `/${databaseName}`
    || !databaseUser || ["root", "admin"].includes(databaseUser)
    || !database.password || database.hash || database.search) {
    throw new Error("Preview DATABASE_URL must use the instance's dedicated MySQL database and a non-admin user, without URL options");
  }

  const frontend = origin(env, "VITE_FRONTEND_URL");
  const allowLocalHttp = frontend.protocol === "http:" && loopback.has(frontend.hostname);
  if (["boogme.com", "www.boogme.com"].includes(frontend.hostname)
    || (frontend.protocol !== "https:" && !allowLocalHttp)) {
    throw new Error("Preview VITE_FRONTEND_URL must be a separate HTTPS origin or local loopback");
  }
  if (env.VITE_APP_ID !== `boogme-preview-${instanceId}`) {
    throw new Error("Preview requires its own VITE_APP_ID: boogme-preview-<instance>");
  }
  const jwt = requireSetting(env, "JWT_SECRET");
  if (jwt.length < 32 || /replace|example|placeholder/i.test(jwt)) {
    throw new Error("Preview requires a newly generated JWT_SECRET of at least 32 characters");
  }
  for (const flag of ["BACKGROUND_JOBS_ENABLED", "AUTO_RELEASE_PAYOUTS_ENABLED"]) {
    if (env[flag] !== undefined && env[flag] !== "false") {
      throw new Error(`${flag} must be false in preview`);
    }
  }
  // First preview phase has no shared external provider credentials. A later
  // change can introduce a separately owned Stripe sandbox and OAuth identity.
  for (const name of [
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_CONNECT_WEBHOOK_SECRET",
    "VITE_STRIPE_PUBLISHABLE_KEY", "RESEND_API_KEY", "BUILT_IN_FORGE_API_KEY",
    "BUILT_IN_FORGE_API_URL", "VITE_FRONTEND_FORGE_API_KEY", "VITE_FRONTEND_FORGE_API_URL",
    "OAUTH_SERVER_URL", "VITE_OAUTH_PORTAL_URL", "OWNER_OPEN_ID",
  ]) {
    if (env[name]) throw new Error(`Remove ${name} from the isolated preview environment`);
  }

  const mail = origin(env, "PREVIEW_MAIL_URL");
  if (!loopback.has(mail.hostname) && mail.hostname !== "mailpit") {
    throw new Error("PREVIEW_MAIL_URL must address the local capture inbox (mailpit or loopback)");
  }
  const endpoint = origin(env, "PREVIEW_S3_ENDPOINT");
  const publicEndpoint = origin(env, "PREVIEW_S3_PUBLIC_ENDPOINT");
  if (publicEndpoint.protocol === "http:" && !loopback.has(publicEndpoint.hostname)) {
    throw new Error("PREVIEW_S3_PUBLIC_ENDPOINT must use HTTPS or local loopback");
  }
  const bucket = requireSetting(env, "PREVIEW_S3_BUCKET");
  if (bucket !== `boogme-preview-${instanceId}`) {
    throw new Error("PREVIEW_S3_BUCKET must be boogme-preview-<instance>");
  }
  return Object.freeze({
    instanceId, databaseName, allowLocalHttp, mailOrigin: mail.origin,
    storage: Object.freeze({
      endpoint: endpoint.origin, publicEndpoint: publicEndpoint.origin, bucket,
      region: requireSetting(env, "PREVIEW_S3_REGION"),
      accessKeyId: requireSetting(env, "PREVIEW_S3_ACCESS_KEY_ID"),
      secretAccessKey: requireSetting(env, "PREVIEW_S3_SECRET_ACCESS_KEY"),
    }),
  });
}
