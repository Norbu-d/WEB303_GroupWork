FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w @food/api-gateway
CMD ["node","services/api-gateway/dist/index.js"]
