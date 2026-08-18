# MapPlatform monolith — Payload Admin + map UI + REST
# Build context: repo root

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --filter @mapplatform/api... --frozen-lockfile

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api ./apps/api
WORKDIR /app/apps/api
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_MAP_TILE_URL=https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
ARG NEXT_PUBLIC_MAP_ATTRIBUTION=© OpenStreetMap contributors © CARTO
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL
ENV NEXT_PUBLIC_MAP_ATTRIBUTION=$NEXT_PUBLIC_MAP_ATTRIBUTION
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates docker.io docker-compose-v2 \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=builder /app /app
WORKDIR /app/apps/api
EXPOSE 3001
HEALTHCHECK --interval=20s --timeout=5s --start-period=45s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/locations?limit=1').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "start"]
