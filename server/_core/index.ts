import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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
  const app = express();
  const server = createServer(app);
  
  // Force HTTPS redirect in production
  if (process.env.NODE_ENV === "production") {
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
  
  // Stripe webhook MUST come before express.json() to get raw body
  const { handleStripeWebhook } = await import("../webhooks");
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
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
  // Rate limiting on auth-sensitive tRPC endpoints.
  // Limits login/register/password-reset to 10 requests per minute per IP.
  // Other tRPC endpoints get a generous 200/min per IP.
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
    keyGenerator: (req) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? "127.0.0.1";
      return ipKeyGenerator(ip);
    },
  });
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ip = req.ip ?? req.socket.remoteAddress ?? "127.0.0.1";
      return ipKeyGenerator(ip);
    },
  });

  // Apply strict limiter to auth procedures
  app.use("/api/trpc/auth.login", authLimiter);
  app.use("/api/trpc/auth.register", authLimiter);
  app.use("/api/trpc/auth.requestPasswordReset", authLimiter);
  app.use("/api/trpc/auth.resetPassword", authLimiter);

  // General rate limit on all tRPC
  app.use("/api/trpc", generalLimiter);

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
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Start the 24-hour lesson reminder scheduler
  const { startReminderScheduler } = await import("../reminderScheduler");
  startReminderScheduler();
}

startServer().catch(console.error);
