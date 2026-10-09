import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthCallbackRoutes, registerOAuthStartRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { backgroundJobsEnabled, startBackgroundJobs } from "./backgroundJobs";
import { registerTrpcRateLimits } from "./rateLimits";
import { ENV } from "./env";
import { getDb } from "../db";
import { verifyStorageIsolation } from "../storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Validate job ownership before anything listens: an unrecognized flag must
  // fail the deploy with a clear message, not crash-loop a serving process.
  backgroundJobsEnabled();
  if (ENV.preview) {
    await getDb();
    await verifyStorageIsolation();
    console.log(`[Preview] Resource isolation verified for ${ENV.preview.instanceId}`);
  }
  const app = express();
  const server = createServer(app);

  // Trust exactly ONE proxy hop (the platform's reverse proxy) so req.ip reflects
  // the real client from X-Forwarded-For. Use 1, not `true`: `true` trusts the
  // entire chain and lets clients spoof X-Forwarded-For to evade the rate limiter.
  app.set("trust proxy", 1);

  // Public start routes choose only configured origins, before the Host-based
  // transport redirect. The callback keeps its existing middleware position.
  registerOAuthStartRoutes(app);

  // Force HTTPS redirect in production
  if (process.env.NODE_ENV === "production" && !ENV.preview?.allowLocalHttp) {
    app.use((req, res, next) => {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const isSecure = proto === 'https' || req.secure || req.headers['x-forwarded-ssl'] === 'on';
      
      if (!isSecure) {
        const host = req.headers.host || req.hostname;
        return res.redirect(301, `https://${host}${req.url}`);
      }
      next();
    });
  }
  
  // Stripe webhook MUST come before express.json() to get the raw body buffer
  // (signature verification fails on a parsed body). Register BOTH path spellings
  // so the handler runs regardless of which one the Stripe dashboard targets:
  //   - /api/stripe/webhook   (original)
  //   - /api/webhooks/stripe  (current dashboard config — S45-2)
  const { handleStripeWebhook } = await import("../webhooks");
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), handleStripeWebhook);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthCallbackRoutes(app);
  
  // Force logout endpoint for debugging
  app.get("/api/force-logout", (req, res) => {
    // Clear the session cookie
    res.setHeader("Set-Cookie", "app_session_id=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/");
    // Prevent caching
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    // Redirect to homepage with cache-busting parameter
    res.redirect("/?logout=" + Date.now());
  });
  // Rate limiting: credential and email-sending procedures get 10 requests per
  // minute per IP — including when batched with other calls — and every other
  // tRPC call 200/min. The procedure list lives in rateLimits.ts.
  registerTrpcRateLimits(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = ENV.preview ? preferredPort : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  await startBackgroundJobs();
}

startServer().catch(error => {
  console.error(error);
  // Startup has failed. Do not leave a preview process alive with partially
  // initialized clients or allow a supervisor to report it as healthy.
  process.exit(1);
});
