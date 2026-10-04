# Multi-stage production build for Aggroso Field Service Dispatch System
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and workspace package definitions
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
WORKDIR /app/backend
RUN npm ci

WORKDIR /app/frontend
RUN npm ci

# Copy full source code
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend

# Generate Prisma client and build backend
WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

# Copy backend dependencies and build
COPY backend/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/backend/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/frontend/dist ./frontend-dist

# Expose server port
EXPOSE 5001

# Run database push against the Postgres schema and start the server
CMD ["sh", "-c", "npx prisma generate --schema=prisma/schema.postgresql.prisma && npx prisma db push --schema=prisma/schema.postgresql.prisma && node dist/server.js"]
