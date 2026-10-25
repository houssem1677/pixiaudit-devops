
# Stage 1: Build the application
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and compile TypeScript
COPY . .
RUN npm run build


# Stage 2: Production runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Install Chromium and its runtime dependencies for Puppeteer PDF generation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Use the system-installed Chromium instead of downloading another browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the compiled application
COPY --from=build /app/dist ./dist

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
