#!/usr/bin/env node
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const required = ['TERMS_API_BASE_URL', 'AUTH_MODE', 'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_SCOPE'];

export function runtimeConfigFromEnv(env) {
  const config = Object.fromEntries(required.map((key) => [key, env[key]?.trim()]));
  for (const key of required) {
    if (!config[key]) throw new Error(`${key} is required`);
  }
  if (!config.TERMS_API_BASE_URL.startsWith('/') || config.TERMS_API_BASE_URL.startsWith('//')) {
    throw new Error('TERMS_API_BASE_URL must be a same-origin path');
  }
  if (config.AUTH_MODE !== 'oidc') throw new Error('AUTH_MODE must be oidc');
  const issuer = new URL(config.OIDC_ISSUER);
  if (issuer.protocol !== 'https:' && issuer.hostname !== 'localhost') {
    throw new Error('OIDC_ISSUER must use HTTPS');
  }
  return Object.freeze({
    ...config,
    TERMS_API_BASE_URL: config.TERMS_API_BASE_URL.replace(/\/$/, ''),
    OIDC_ISSUER: issuer.toString().replace(/\/$/, ''),
  });
}

export async function writeRuntimeConfig(output, env = process.env) {
  const target = resolve(output);
  const temporary = `${target}.tmp-${process.pid}`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(runtimeConfigFromEnv(env))}\n`, {
    encoding: 'utf8',
    mode: 0o640,
  });
  await rename(temporary, target);
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const outputFlag = process.argv.indexOf('--output');
  const output = outputFlag >= 0 ? process.argv[outputFlag + 1] : process.env['RUNTIME_CONFIG_OUTPUT'];
  if (!output) throw new Error('Use --output <path> or RUNTIME_CONFIG_OUTPUT');
  await writeRuntimeConfig(output);
}
