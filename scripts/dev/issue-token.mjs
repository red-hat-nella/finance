import { readFile } from 'node:fs/promises';
import { importPKCS8, SignJWT } from 'jose';

const role = process.argv[2] ?? 'credit_analyst';
const privateKeyPath = process.env.DEV_AUTH_PRIVATE_KEY_FILE ?? 'deploy/local/.secrets/dev-auth-private.pem';
const issuer = process.env.AUTH_ISSUER_HOST ?? 'http://dev-auth.local';
const audience = process.env.AUTH_AUDIENCE ?? 'alternative-credit-scoring';
const actor = role === 'credit_analyst' ? 'analyst-042' : 'supervisor-007';
const key = await importPKCS8(await readFile(privateKeyPath, 'utf8'), 'RS256');

const token = await new SignJWT({ org_id: 'co-demo-credit', roles: [role], name: actor })
  .setProtectedHeader({ alg: 'RS256', kid: 'dev-rsa-1', typ: 'JWT' })
  .setIssuer(issuer)
  .setAudience(audience)
  .setSubject(actor)
  .setIssuedAt()
  .setExpirationTime('8h')
  .sign(key);

process.stdout.write(token);
