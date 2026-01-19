#!/usr/bin/env sh
set -e

corepack pnpm -C packages/domain build
corepack pnpm -C services/api migrate
exec corepack pnpm -C services/api dev
