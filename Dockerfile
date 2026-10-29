FROM node:24.22.1-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY portfolio-fe/package.json ./portfolio-fe/package.json
RUN npm ci

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run typecheck && npm run build

FROM node:24.22.1-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN groupadd --system --gid 1001 portfolio && useradd --system --uid 1001 --gid portfolio portfolio
COPY --from=builder --chown=portfolio:portfolio /app/portfolio-fe/.next/standalone ./
COPY --from=builder --chown=portfolio:portfolio /app/portfolio-fe/.next/static ./portfolio-fe/.next/static
COPY --from=builder --chown=portfolio:portfolio /app/portfolio-fe/public ./portfolio-fe/public
USER portfolio
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "portfolio-fe/server.js"]
