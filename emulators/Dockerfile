FROM eclipse-temurin:21-jre AS java

FROM node:24-slim

COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="$JAVA_HOME/bin:$PATH"

RUN npm install -g firebase-tools

WORKDIR /app

# Copy firebase configuration
COPY firebase.json .firebaserc firestore.rules storage.rules ./

# Bind all emulators (including internal services) to 0.0.0.0
RUN node -e " \
  const fs = require('fs'); \
  const cfg = JSON.parse(fs.readFileSync('firebase.json', 'utf8')); \
  for (const [k, v] of Object.entries(cfg.emulators)) { \
    if (typeof v === 'object' && v.port) v.host = '0.0.0.0'; \
  } \
  cfg.emulators.hub = { host: '0.0.0.0', port: 4400 }; \
  cfg.emulators.logging = { host: '0.0.0.0', port: 4500 }; \
  fs.writeFileSync('firebase.json', JSON.stringify(cfg, null, 2)); \
"

# Set up shared package (functions dependency)
COPY packages/shared/package.json packages/shared/
COPY packages/shared/dist/ packages/shared/dist/

# Copy functions .env for emulator runtime
COPY packages/functions/.env packages/functions/.env

# Install functions runtime dependencies
COPY packages/functions/package.json packages/functions/
RUN cd packages/functions && \
    npm pkg set dependencies.@brick-quest/shared="file:../shared" && \
    npm install --omit=dev

EXPOSE 7020 7021 7022 7023 7024 4400 4500 9150

CMD ["firebase", "emulators:start", "--project", "brick-quest"]
