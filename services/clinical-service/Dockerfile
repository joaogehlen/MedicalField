# clinical-service — TypeScript · NestJS (núcleo clínico e sincronização)
# Construído a partir da raiz do repositório: usa packages/shared (tipos e regras clínicas).

# 1) Compila o pacote compartilhado e o serviço
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/design/package.json packages/design/
COPY services/clinical-service/package.json services/clinical-service/
COPY apps/client/package.json apps/client/
COPY apps/portal/package.json apps/portal/
RUN npm ci --no-audit --no-fund
COPY packages/shared packages/shared
COPY services/clinical-service services/clinical-service
RUN npm run build -w @medicalfield/shared \
 && npm run build -w @medicalfield/clinical-service \
 && npm prune --omit=dev --no-audit --no-fund

# 2) Imagem final: só o necessário para rodar
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=build /src/node_modules ./node_modules
# node_modules/@medicalfield/shared é um link para packages/shared (workspace do npm)
COPY --from=build /src/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /src/packages/shared/dist ./packages/shared/dist
COPY --from=build /src/services/clinical-service/dist ./dist
COPY --from=build /src/services/clinical-service/migrations ./migrations
COPY --from=build /src/services/clinical-service/seeds ./seeds
COPY --from=build /src/services/clinical-service/package.json ./package.json
EXPOSE 3001
USER node
CMD ["node", "dist/main.js"]
