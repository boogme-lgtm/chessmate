import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from "express-rate-limit";
import { TRPCError } from "@trpc/server";

/**
 * The strict per-IP budgets. They are separate so one kind of traffic cannot
 * lock out the other on a shared network: a club or school signing up a class
 * must not stop its members from signing in.
 * - credential: checks a password, or sets one with an emailed token;
 * - email: sends email to an address the caller chooses.
 */
export type StrictRateLimitBudget = "credential" | "email";

/**
 * Procedures that check a credential or send email to an address the caller
 * chooses, with the budget each draws on. Every other tRPC call gets the
 * general budget. Any new procedure of these kinds MUST be added here, or it
 * becomes a brute-force / email-bomb vector at the general limit.
 * auth.verifyEmail is deliberately absent: its single-use token is 256 random
 * bits, and the one email it sends goes to the verified account itself, so a
 * strict budget would only lock out new members on a shared network.
 */
export const STRICT_RATE_LIMITED_PROCEDURES: ReadonlyMap<string, StrictRateLimitBudget> = new Map([
  ["auth.login", "credential"],
  ["auth.resetPassword", "credential"],
  ["user.changePassword", "credential"],
  ["user.deleteAccount", "credential"],
  ["auth.register", "email"],
  ["auth.requestPasswordReset", "email"],
  ["auth.resendVerification", "email"],
  ["waitlist.join", "email"],
  ["coachApplication.submit", "email"],
]);

const ALL_STRICT_BUDGETS: ReadonlySet<StrictRateLimitBudget> = new Set(STRICT_RATE_LIMITED_PROCEDURES.values());

/** Shown when a budget is exhausted; the window is one minute in production. */
export const RATE_LIMITED_MESSAGE = "Too many requests. Please wait a minute and try again.";
export const ONE_STRICT_CALL_MESSAGE = "Send one sign-in or account request at a time";

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

/**
 * The strict budgets a request draws on, once each however many of its calls
 * use them. An undecodable path draws on every budget, for the same reason.
 */
export function strictBudgetsFor(requestPath: string): ReadonlySet<StrictRateLimitBudget> {
  const paths = trpcProcedurePaths(requestPath);
  if (!paths) return ALL_STRICT_BUDGETS;
  const budgets = new Set<StrictRateLimitBudget>();
  for (const path of paths) {
    const budget = STRICT_RATE_LIMITED_PROCEDURES.get(path);
    if (budget) budgets.add(budget);
  }
  return budgets;
}

export type TrpcRateLimitOptions = {
  windowMs?: number;
  strictLimit?: number;
  generalLimit?: number;
};

type TrpcRejection = { code: "TOO_MANY_REQUESTS" | "BAD_REQUEST"; message: string };

/** Where the middleware records a refusal for the tRPC context to raise. */
const REJECTION = "trpcRateLimitRejection";

function rejection(res: Response): TrpcRejection | undefined {
  return res.locals[REJECTION] as TrpcRejection | undefined;
}

export type TrpcRateLimits = {
  /** Counts the request against its budgets and records any refusal. It never answers the request itself. */
  middleware: RequestHandler;
  /**
   * Throws the recorded refusal as a TRPCError. Call it first thing in the
   * tRPC createContext: tRPC then answers every call in the request with an
   * error the client can read (429 or 400, with this module's message) and
   * runs no procedure. A plain express body would reach the user as "Unable
   * to transform response from server".
   */
  enforce: (res: Response) => void;
};

/**
 * Rate limits for /api/trpc, keyed by client IP (req.ip honors the app's
 * one-hop "trust proxy" setting). A strict budget applies whenever ANY call in
 * the request — GET or POST, batched or not, however the path is encoded — is
 * a strictly limited procedure, and counts the request once. A request may
 * carry at most one such call: otherwise one batch could make many password
 * attempts or send many emails for a single unit of the budget. Every request
 * the strict budgets allow also counts against the general budget.
 *
 * Mount it through registerTrpcApi, which pairs the middleware with enforce.
 */
export function createTrpcRateLimits(options: TrpcRateLimitOptions = {}): TrpcRateLimits {
  const { windowMs = 60 * 1000, strictLimit = 10, generalLimit = 200 } = options;
  const limiter = (limit: number) => rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "127.0.0.1"),
    // Record the refusal for tRPC to answer, instead of a body its client cannot parse.
    handler: (_req: Request, res: Response, next: NextFunction) => {
      res.locals[REJECTION] = { code: "TOO_MANY_REQUESTS", message: RATE_LIMITED_MESSAGE } satisfies TrpcRejection;
      next();
    },
  });
  const strictLimiters: Record<StrictRateLimitBudget, RateLimitRequestHandler> = {
    credential: limiter(strictLimit),
    email: limiter(strictLimit),
  };
  const generalLimiter = limiter(generalLimit);

  const count = (handler: RateLimitRequestHandler, req: Request, res: Response) =>
    new Promise<void>((resolve, reject) => {
      void handler(req, res, (error?: unknown) => (error ? reject(error) : resolve()));
    });

  const middleware: RequestHandler = async (req, res, next) => {
    try {
      // A request refused by one budget is not charged to the next.
      for (const budget of Array.from(strictBudgetsFor(req.path))) {
        await count(strictLimiters[budget], req, res);
        if (rejection(res)) return next();
      }
      if (strictProcedureCalls(req.path) > 1) {
        res.locals[REJECTION] = { code: "BAD_REQUEST", message: ONE_STRICT_CALL_MESSAGE } satisfies TrpcRejection;
        return next();
      }
      await count(generalLimiter, req, res);
      next();
    } catch (error) {
      next(error);
    }
  };

  return {
    middleware,
    enforce: res => {
      const refused = rejection(res);
      if (refused) throw new TRPCError(refused);
    },
  };
}
