FROM node:24-alpine AS base

WORKDIR /app

FROM base AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY out/json  ./
# 先复制整体 package.json 并执行下载文件作为一层，这样只要依赖不更新下次打包都不会需要重新下载
RUN pnpm config set registry https://registry.npmmirror.com
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# 再把项目文件复制过去打包
COPY out/full  ./
COPY tsconfig.base.json ./
RUN pnpm build:pkgs
RUN pnpm build:apps
RUN mkdir -p apps/server/static
RUN cp -r apps/admin/dist/* apps/server/static/
# 最后只保留服务端，并清理一切不需要的依赖
RUN pnpm deploy --filter=server --prod --no-optional --legacy prune-server

FROM base AS server-runner
EXPOSE $ADMIN_API_PORT
EXPOSE $TUNNEL_SERVER_PORT
EXPOSE $PROXY_SERVER_PORT
COPY --from=builder /app/prune-server ./
CMD ["node", "dist/main"]