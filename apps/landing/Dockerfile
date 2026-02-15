FROM node:24-slim AS base

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

WORKDIR /app

# Build stage
FROM base AS builder

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/landing ./apps/landing

RUN pnpm install --frozen-lockfile
RUN pnpm build --filter=@brick-quest/landing

# Production stage
FROM node:24-slim AS runner

RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

WORKDIR /app

COPY --from=builder /app/apps/landing/.next/standalone ./
COPY --from=builder /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder /app/apps/landing/public ./apps/landing/public

WORKDIR /app/apps/landing

ENV NODE_ENV=production
ENV PORT=7030
ENV HOSTNAME=0.0.0.0

EXPOSE 7030

CMD ["node", "server.js"]
