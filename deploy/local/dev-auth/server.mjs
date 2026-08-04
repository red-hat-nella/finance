import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const jwksPath = process.env.JWKS_FILE ?? '/run/dev-auth/jwks.json';
const port = Number(process.env.PORT ?? 8080);

createServer((request, response) => {
  if (request.url === '/.well-known/jwks.json') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(readFileSync(jwksPath, 'utf8'));
    return;
  }
  if (request.url === '/health/live') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"status":"ok","service":"dev-auth"}');
    return;
  }
  response.writeHead(404).end();
}).listen(port, '0.0.0.0');
