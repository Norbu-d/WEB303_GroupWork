FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build:contracts && npm run build -w @food/runtime && npm run build -w @food/menu-service
CMD ["node","services/menu-service/dist/index.js"]
