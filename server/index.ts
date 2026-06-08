// LEGACY ENTRY POINT — kept for reference only.
// The active entry point is server/_core/index.ts (see package.json "dev" / "build" scripts).
// This file is NOT used by any npm script; it exists solely as a fallback for direct `node server/index.ts` invocations.
//
// Updated for Express 5 compatibility: bare "*" wildcard replaced with "/{*splat}".

import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing — serve index.html for all routes.
  // Express 5 requires "/{*splat}" instead of the Express 4 bare "*" wildcard.
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
