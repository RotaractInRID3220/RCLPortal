# One image, two services in Dokploy: the web app (default CMD) and the worker (CMD node scripts/worker.mjs).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# worker + migrations run from the full source and dependencies
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/server ./src/server
COPY --from=build /app/db ./db
COPY --from=build /app/node_modules ./node_modules
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/public/health || exit 1
CMD ["node", "server.js"]
