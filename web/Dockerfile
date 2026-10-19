FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
RUN npm ci
COPY web ./web
WORKDIR /app/web
EXPOSE 5173
CMD ["npm","run","dev"]
