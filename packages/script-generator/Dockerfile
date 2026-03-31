FROM public.ecr.aws/lambda/nodejs:22 AS builder

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY config/ ./config/
COPY packages/script-generator/package.json ./packages/script-generator/

RUN pnpm --filter script-generator install --frozen-lockfile

COPY packages/script-generator/ ./packages/script-generator/

WORKDIR /app/packages/script-generator

RUN npx esbuild src/entrypoints/lambda.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --outfile=dist/lambda.mjs \
  --format=esm \
  --banner:js="import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);"

FROM public.ecr.aws/lambda/nodejs:22

COPY --from=builder /app/packages/script-generator/dist/lambda.mjs ${LAMBDA_TASK_ROOT}/

CMD ["lambda.handler"]
