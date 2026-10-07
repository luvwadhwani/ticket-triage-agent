import type { BrowserContext } from '@playwright/test';
import { SignJWT, importPKCS8 } from 'jose';
import { TEST_PRIVATE_KEY } from '../fixtures/keys';

export const TEST_VIEWER = 'Test Viewer';

/** Signs a test-only pass with the fixture key, the way the hub would, and gives it to the browser. */
export async function addPass(context: BrowserContext, baseURL: string, projects = ['triage']) {
  const key = await importPKCS8(TEST_PRIVATE_KEY, 'Ed25519');
  const now = Math.floor(Date.now() / 1000);
  const pass = await new SignJWT({ name: TEST_VIEWER, projects })
    .setProtectedHeader({ alg: 'Ed25519' })
    .setSubject('00000000-0000-4000-8000-000000000001')
    .setIssuer('work.luvwadhwani.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  await context.addCookies([{ name: 'lw_pass', value: pass, url: baseURL }]);
}
