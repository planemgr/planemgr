FROM node:24-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages

RUN pnpm install --prod --frozen-lockfile
RUN pnpm build

FROM node:24-alpine
WORKDIR /app

COPY --from=builder /app/packages/dist ./packages/dist
COPY --from=builder /app/node_modules ./node_modules

# Set up depdendencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git openssh-client unzip \
  && rm -rf /var/lib/apt/lists/*

# Install OpenTofu
RUN arch="${TARGETARCH:-amd64}" \
  && curl -fsSL -o /tmp/tofu.zip \
  "https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}/tofu_${TOFU_VERSION}_linux_${arch}.zip" \
  && unzip /tmp/tofu.zip -d /usr/local/bin \
  && rm /tmp/tofu.zip

# Install Packer
RUN arch="${TARGETARCH:-amd64}" \
  && curl -fsSL -o /tmp/packer.zip \
  "https://releases.hashicorp.com/packer/${PACKER_VERSION}/packer_${PACKER_VERSION}_linux_${arch}.zip" \
  && unzip /tmp/packer.zip -d /usr/local/bin \
  && rm /tmp/packer.zip

EXPOSE 4000
CMD ["node", "services/api/dist/index.js"]
