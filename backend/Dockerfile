
# Stage 1: Build the application
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies for building
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and compile TypeScript
COPY . .
RUN npm run build


# Stage 2: Production runtime
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the compiled application
COPY --from=build /app/dist ./dist

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
