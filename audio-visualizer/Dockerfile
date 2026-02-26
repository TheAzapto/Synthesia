# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Serve ──────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default Nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8081

CMD ["nginx", "-g", "daemon off;"]
