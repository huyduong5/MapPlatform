# Next.js Map UI — production image
# Build context: repo root

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --filter @mapplatform/web... --frozen-lockfile

FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
ARG NEXT_PUBLIC_MAP_TILE_URL=https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png
ARG NEXT_PUBLIC_MAP_ATTRIBUTION=© OpenStreetMap contributors © CARTO
ARG NEXT_PUBLIC_MAP_DEFAULT_LAT=21.0285
ARG NEXT_PUBLIC_MAP_DEFAULT_LNG=105.8542
ARG NEXT_PUBLIC_MAP_DEFAULT_ZOOM=12
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL
ENV NEXT_PUBLIC_MAP_ATTRIBUTION=$NEXT_PUBLIC_MAP_ATTRIBUTION
ENV NEXT_PUBLIC_MAP_DEFAULT_LAT=$NEXT_PUBLIC_MAP_DEFAULT_LAT
ENV NEXT_PUBLIC_MAP_DEFAULT_LNG=$NEXT_PUBLIC_MAP_DEFAULT_LNG
ENV NEXT_PUBLIC_MAP_DEFAULT_ZOOM=$NEXT_PUBLIC_MAP_DEFAULT_ZOOM
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=builder /app /app
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "start"]
