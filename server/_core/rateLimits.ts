import type { Express, NextFunction, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Procedures that check a credential, consume an emailed token, or send email
 * to an address the caller chooses. They share a strict per-IP budget; every
 * other tRPC call gets the general one. Any new procedure of these kinds MUST
 * be added here, or it becomes a brute-force / email-bomb vector at the
 * general limit.
 */
export const STRICT_RATE_LIMITED_PROCEDURES: ReadonlySet<string> = new Set([
  "auth.login",
  "auth.register",
  "auth.requestPasswordReset",
  "auth.resetPassword",
  "auth.resendVerification",
  "auth.verifyEmail",
  "user.changePassword",
  "user.deleteAccount",
  "waitlist.join",
  "coachApplication.submit",
]);

/**
 * The procedure paths tRPC will resolve for a request path under /api/trpc,
 * parsed exactly as its express adapter and resolveResponse do: the segment
 * after the LAST "/", URL-decoded, then split on "," for batches. Returns null
 * when the segment cannot be decoded (tRPC rejects such a request too).
 */
export function trpcProcedurePaths(requestPath: string): string[] | null {
  const segment = requestPath.slice(requestPath.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(segment).split(",");
  } catch {
    return null;
  }
}

/**
 * How many strictly limited procedure calls a request makes. Batches count
 * every call, and an undecodable path counts as one, so ambiguity is limited
 * rather than let through.
 */
export function strictProcedureCalls(requestPath: string): number {
  const paths = trpcProcedurePaths(requestPath);
  if (!paths) return 1;
  return paths.filter(path => STRICT_RATE_LIMITED_PROCEDURES.has(path)).length;
}

export type TrpcRateLimitOptions = {
  windowMs?: number;
  strictLimit?: number;
  generalLimit?: number;
};

/**
 * Rate limits for /api/trpc, keyed by client IP (req.ip honors the app's
 * one-hop "trust proxy" setting). The strict limiter applies whenever ANY call
 * in the request — GET or POST, batched or not, however the path is encoded —
 * is a strictly limited procedure, and counts the request once. A request may
 * carry at most one such call: otherwise one batch could make many password
 * attempts or send many emails for a single unit of the budget.
 */
export function registerTrpcRateLimits(app: Express, options: TrpcRateLimitOptions = {}): void {
  const { windowMs = 60 * 1000, strictLimit = 10, generalLimit = 200 } = options;
  const keyGenerator = (req: Request) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "127.0.0.1";
    return ipKeyGenerator(ip);
  };
  const strictLimiter = rateLimit({
    windowMs,
    limit: strictLimit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
    keyGenerator,
  });
  const generalLimiter = rateLimit({
    windowMs,
    limit: generalLimit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
  });

  app.use("/api/trpc", (req: Request, res: Response, next: NextFunction) => {
    const calls = strictProcedureCalls(req.path);
    if (calls === 0) return next();
    return strictLimiter(req, res, (error?: unknown) => {
      if (error) return next(error);
      if (calls > 1) {
        res.status(400).json({ error: "Send one sign-in or account request at a time" });
        return;
      }
      next();
    });
  });
  app.use("/api/trpc", generalLimiter);
}
