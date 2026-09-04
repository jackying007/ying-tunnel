FROM node:18-alpine AS base

WORKDIR /app

FROM base AS builder

RUN corepack enable && corepack prepare pnpm@8 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/lib/package.json packages/lib/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/server/package.json apps/server/package.json

## 先复制整体 package.json 并执行下载文件作为一层，这样只要依赖不更新下次打包都不会需要重新下载

RUN pnpm config set registry https://registry.npmmirror.com

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# 再把项目文件复制过去打包

COPY ./packages/lib ./packages/lib
COPY ./apps/admin ./apps/admin
COPY ./apps/server ./apps/server

RUN pnpm -r build

RUN cp -r /app/apps/admin/dist/* /app/apps/server/static/

RUN pnpm deploy --filter=server --prod /prod/server

FROM base AS server-runner

EXPOSE $ADMIN_API_PORT
EXPOSE $TUNNEL_SERVER_PORT
EXPOSE $PROXY_SERVER_PORT

COPY --from=builder /prod/server ./

CMD ["node", "dist/main"]