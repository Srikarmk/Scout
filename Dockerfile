# The Claude Agent SDK ships its own CLI runtime and extracts a native binary at
# run time, so this deliberately does NOT use Next's standalone output: file
# tracing does not reliably carry the SDK's runtime assets. Shipping the whole
# node_modules is bigger but is the thing that actually boots.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOME=/app

# The SDK spawns a subprocess and needs CA certs for the API, plus a writable
# HOME to extract its runtime into.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts

# Reports and the shortlist live here; mount a volume so they outlive a deploy.
RUN mkdir -p /app/.scout

EXPOSE 3000
CMD ["npm", "run", "start"]
