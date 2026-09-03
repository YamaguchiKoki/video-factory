FROM public.ecr.aws/lambda/nodejs:22 AS builder

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY config/ ./config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/uploader/package.json ./packages/uploader/

RUN pnpm --filter uploader install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY packages/uploader/ ./packages/uploader/

WORKDIR /app/packages/uploader

RUN npx esbuild src/entrypoints/lambda.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --outfile=dist/lambda.mjs \
  --format=esm \
  --banner:js="import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);"

FROM public.ecr.aws/lambda/nodejs:22

COPY --from=builder /app/packages/uploader/dist/lambda.mjs ${LAMBDA_TASK_ROOT}/

CMD ["lambda.handler"]
