FROM node:20-alpine AS base
WORKDIR /app
COPY package.json turbo.json ./
COPY packages/ ./packages/
COPY frontend/package.json ./frontend/
RUN npm install

FROM base AS builder
COPY frontend/ ./frontend/
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd frontend && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
