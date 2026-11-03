# Build manually only after package download / hosting cost approval.
FROM node:26.11.0-bookworm-slim
WORKDIR /app
RUN npm install --global pnpm@12.10.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV DATA_MODE=DEMO APP_ENV=demo PUBLICATION_STATE=demo NEXT_TELEMETRY_DISABLED=1
RUN pnpm db:seed && pnpm build && chown -R node:node /app
USER node
EXPOSE 10000
CMD ["sh", "-c", "exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port ${PORT:-10000}"]
