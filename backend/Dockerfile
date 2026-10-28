FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/app/uploads
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm start"]
