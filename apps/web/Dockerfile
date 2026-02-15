FROM node:24-slim AS base

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

WORKDIR /app

# Build stage
FROM base AS builder

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm build --filter=@brick-quest/web

# Production stage
FROM node:24-slim AS runner

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV PORT=7031
ENV HOSTNAME=0.0.0.0

EXPOSE 7031

CMD ["node", "server.js"]
