import { randomUUID } from 'node:crypto';

export async function sourceSession({ token, request = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const owner = randomUUID();
  async function call(op, body) {
    return request(`https://teyvat.kr/api/admin?op=${op}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  const until = Date.now() + 9 * 60 * 1000;
  let catalog, held = false, bootstrap = false;
  while (Date.now() < until) {
    const response = await call('source-begin', { owner });
    if (response.status === 404) { bootstrap = true; break; } // Before the Studio API exists.
    if (response.status === 409) { await wait(8000); continue; }
    if (!response.ok) throw new Error(`Studio source synchronization failed (${response.status}).`);
    catalog = (await response.json()).catalog; held = true; break;
  }
  if (!held && !bootstrap) throw new Error('Studio source synchronization timed out.');
  return {
    catalog,
    async finish({ files, gitSha, deploymentId }) {
      for (let attempt = 0; ; attempt++) {
        const response = await call('source-finish', { owner: held ? owner : null, files, gitSha, deploymentId });
        if (response.ok) { held = false; break; }
        if (attempt >= 4 || ![404, 409, 503].includes(response.status)) throw new Error(`Studio source registration failed (${response.status}).`);
        await wait(2000);
      }
    },
    async abort() { if (held) { await call('source-abort', { owner }).catch(() => {}); held = false; } },
  };
}
