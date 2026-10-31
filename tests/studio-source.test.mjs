import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceSession } from '../scripts/studio-source.mjs';
import { createStudioProvider, PROJECT } from '../lib/studio-provider.js';

test('first Studio deployment may bootstrap but authentication errors never fall back', async () => {
  const calls = [];
  const request = async (url, options) => { calls.push({ op: new URL(url).searchParams.get('op'), body: JSON.parse(options.body) }); return new Response(null, { status: calls.length === 1 ? 404 : 200 }); };
  const session = await sourceSession({ token: 'project-key', request });
  assert.equal(session.catalog, undefined);
  await session.finish({ files: [], gitSha: 'abc', deploymentId: 'dpl_new' });
  assert.equal(calls[1].op, 'source-finish'); assert.equal(calls[1].body.owner, null);
  await assert.rejects(() => sourceSession({ token: 'bad-key', request: async () => new Response(null, { status: 401 }) }), /401/);
  await assert.rejects(() => sourceSession({ token: 'project-key', request: async () => new Response(null, { status: 404, headers: { 'x-teyvat-studio': '1' } }) }), /404/);
});

test('code updates wait for a publication, keep its snapshot and release their source lease', async () => {
  let attempts = 0, waits = 0; const calls = [];
  const request = async (url, options) => {
    const op = new URL(url).searchParams.get('op'); calls.push({ op, body: JSON.parse(options.body) });
    if (op === 'source-begin' && attempts++ === 0) return new Response(null, { status: 409 });
    return Response.json({ catalog: { revision: 'published-revision', works: [], assets: {} } });
  };
  const session = await sourceSession({ token: 'key', request, wait: async () => { waits++; } });
  assert.equal(waits, 1); assert.equal(session.catalog.revision, 'published-revision');
  await session.abort(); await session.abort();
  assert.equal(calls.filter(c => c.op === 'source-abort').length, 1);
});

test('provider restricts internal credentials and deployment lookups to the existing project', async () => {
  const calls = [];
  const provider = createStudioProvider({ ADMIN_DEPLOY_TOKEN: 'project-key' }, async (url, options) => {
    calls.push({ url, options });
    const path = new URL(url).pathname;
    if (path.startsWith('/v9/projects')) return Response.json({ id: PROJECT });
    if (path === '/v6/deployments') return Response.json({ deployments: [] });
    return Response.json({ id: 'dpl_test', projectId: 'another-project', readyState: 'READY' });
  });
  assert.equal(await provider.authorize('supplied-key'), true);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer supplied-key');
  await provider.findJob('job'); assert.equal(new URL(calls[1].url).searchParams.get('projectId'), PROJECT);
  await assert.rejects(() => provider.status('dpl_test'), /프로젝트/);
});
