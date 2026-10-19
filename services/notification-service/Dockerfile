FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build:contracts && npm run build -w @food/runtime && npm run build -w @food/notification-service
CMD ["node","services/notification-service/dist/index.js"]
