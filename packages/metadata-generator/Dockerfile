FROM public.ecr.aws/lambda/nodejs:22 AS builder

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY config/ ./config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/metadata-generator/package.json ./packages/metadata-generator/

RUN pnpm --filter metadata-generator install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY packages/metadata-generator/ ./packages/metadata-generator/

WORKDIR /app/packages/metadata-generator

RUN npx esbuild src/entrypoints/lambda.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --outfile=dist/lambda.mjs \
  --format=esm \
  --external:@napi-rs/canvas \
  --banner:js="import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);"

FROM public.ecr.aws/lambda/nodejs:22

# @napi-rs/canvas ships a native .node binary that esbuild cannot bundle, so it
# is excluded from the esbuild bundle above (--external) and installed directly
# into the task root instead. pnpm's node_modules is a symlink tree into a
# content-addressed store; COPY --from=builder would preserve those symlinks
# and they would break here, so npm install is used instead of copying pnpm's
# tree. lambda.mjs is ESM, so Node resolves this external import from
# /var/task/node_modules.
#
# This runs before the COPY steps below (mirroring the builder stage's
# install-before-source-copy order) so that lambda.mjs changing on nearly
# every commit doesn't bust this layer's cache and force a re-install.
# LAMBDA_TASK_ROOT is set by the base image, so it's available here already.
#
# --no-save: without a package.json in LAMBDA_TASK_ROOT, npm install would
# otherwise create one (plus a package-lock.json) there — stray files nobody
# wrote and nothing reads, shipped into the deployed image.
# --ignore-scripts: @napi-rs/canvas and its platform binary package
# (verified: @napi-rs/canvas-linux-x64-gnu) declare no install/preinstall/
# postinstall scripts, so this is free supply-chain hardening, not a
# functional no-op.
#
# Version must stay in lockstep with the "@napi-rs/canvas" version resolved
# in pnpm-lock.yaml (package.json only pins a "^1.0.8" range) — a mismatch
# means what's tested locally is not what runs in Lambda. This is enforced
# by packages/metadata-generator/src/dockerfile-pin.spec.ts.
RUN npm install --no-save --ignore-scripts --prefix ${LAMBDA_TASK_ROOT} @napi-rs/canvas@1.0.8

COPY --from=builder /app/packages/metadata-generator/dist/lambda.mjs ${LAMBDA_TASK_ROOT}/
COPY packages/metadata-generator/assets/ ${LAMBDA_TASK_ROOT}/assets/

CMD ["lambda.handler"]
