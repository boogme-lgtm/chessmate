import type { Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createTrpcRateLimits, type TrpcRateLimitOptions } from "./rateLimits";

export type TrpcApiOptions = { rateLimits?: TrpcRateLimitOptions };

/**
 * Mount the tRPC API at /api/trpc behind its rate limits. The limits and the
 * handler are registered in one call because their order is what makes the
 * limits work: tRPC's handler always ends the response, so a limiter mounted
 * after it never runs. Mount tRPC only through this function.
 */
export function registerTrpcApi(app: Express, options: TrpcApiOptions = {}): void {
  const limits = createTrpcRateLimits(options.rateLimits);
  app.use(
    "/api/trpc",
    limits.middleware,
    createExpressMiddleware({
      router: appRouter,
      createContext: async opts => {
        // A refused request reaches tRPC only to be answered in its format.
        limits.enforce(opts.res);
        return createContext(opts);
      },
    }),
  );
}
