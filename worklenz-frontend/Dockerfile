FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Create placeholder env-config.js during build
# This will be overwritten at runtime with actual environment values
RUN echo "// Placeholder - will be replaced at runtime" > ./public/env-config.js && \
    echo "window.VITE_API_URL='';" >> ./public/env-config.js && \
    echo "window.VITE_SOCKET_URL='';" >> ./public/env-config.js && \
    echo "window.VITE_USE_DOCKER='false';" >> ./public/env-config.js

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

FROM node:22-alpine AS production

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/build /app/build
COPY --from=build /app/public/env-config.js /app/build/env-config.js

# Copy startup scripts from docker folder
COPY docker/env-config.sh /app/env-config.sh
COPY docker/start.sh /app/start.sh

# Make scripts executable
RUN chmod +x /app/env-config.sh /app/start.sh

EXPOSE 5000
CMD ["/app/start.sh"]
