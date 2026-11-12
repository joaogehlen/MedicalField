# gateway — Nginx: serve as telas (cliente e portal) e roteia /api/* para os serviços.
# Construído a partir da raiz do repositório.

# 1) Compila o cliente e o portal (React + Bootstrap)
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/design/package.json packages/design/
COPY services/clinical-service/package.json services/clinical-service/
COPY apps/client/package.json apps/client/
COPY apps/portal/package.json apps/portal/
RUN npm ci --no-audit --no-fund
COPY packages packages
COPY apps apps
RUN npm run build -w @medicalfield/shared \
 && npm run build -w @medicalfield/client \
 && npm run build -w @medicalfield/portal

# 2) Nginx com os arquivos estáticos
FROM nginx:1.27-alpine
COPY infra/docker/gateway/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/apps/client/dist /usr/share/nginx/html/app
COPY --from=build /src/apps/portal/dist /usr/share/nginx/html/portal
EXPOSE 80
