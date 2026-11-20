FROM node:20-alpine

WORKDIR /app

COPY package.json game.contract.json index.html LICENSE CREDITS.md README.md ./
COPY src/ ./src/
COPY vendor/ ./vendor/

ENV PORT=4173
ENV NO_OPEN=1

EXPOSE 4173

CMD ["node", "src/serve.js", "--no-open"]
