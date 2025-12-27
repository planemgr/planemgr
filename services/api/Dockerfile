FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY services/api ./services/api

RUN pnpm install --frozen-lockfile
RUN pnpm -C packages/domain build
RUN pnpm -C services/api build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY services/api ./services/api

RUN pnpm install --prod --frozen-lockfile
COPY --from=builder /app/services/api/dist ./services/api/dist

EXPOSE 4000
CMD ["node", "services/api/dist/index.js"]
