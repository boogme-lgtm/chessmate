FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@10.4.1
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
COPY scripts/copy-stockfish.mjs ./scripts/copy-stockfish.mjs
RUN pnpm install --frozen-lockfile
COPY . .
# Public build-time settings only. Never pass private credentials as build args.
ARG VITE_APP_ID=boogme
ARG VITE_FRONTEND_URL
ARG VITE_OAUTH_PORTAL_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_ANALYTICS_ENDPOINT
ARG VITE_ANALYTICS_WEBSITE_ID
ENV MANUS_DEV_TOOLS_ENABLED=false
RUN pnpm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 BACKGROUND_JOBS_ENABLED=false MANUS_DEV_TOOLS_ENABLED=false
# The existing server bundle imports Vite packages at startup. Keep its current
# dependency set until that development/production split is repaired separately.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
