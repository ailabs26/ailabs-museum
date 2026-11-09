import type { FullConfig } from '@playwright/test';
import { createServer, preview } from 'vite';

async function isAvailable(url: string) {
  const getStatus = async (target: string) => {
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(1_000) });
      await response.arrayBuffer();
      return response.status;
    } catch {
      return 0;
    }
  };

  const target = new URL(url);
  let status = await getStatus(url);
  if (status === 404 && target.pathname === '/') {
    target.pathname = '/index.html';
    status = await getStatus(target.toString());
  }
  return status >= 200 && status < 404;
}

export default async function globalSetup(config: FullConfig) {
  const url = String(config.projects[0].use.baseURL);
  const { hostname, port } = new URL(url);
  const host = hostname;
  const portNumber = Number(port || 80);

  if (!process.env.CI && await isAvailable(url)) return;

  // Vite stays in this process so teardown does not depend on Windows taskkill.
  if (process.env.PLAYWRIGHT_PREVIEW === '1') {
    const server = await preview({ preview: { host, port: portNumber, strictPort: true } });
    return () => new Promise<void>((resolve, reject) => {
      server.httpServer.close((error) => error ? reject(error) : resolve());
    });
  }

  const server = await createServer({ server: { host, port: portNumber, strictPort: true } });
  try {
    await server.listen();
  } catch (error) {
    await server.close();
    throw error;
  }
  return () => server.close();
}
