import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deploy, deploymentFiles } from '../scripts/deploy.mjs';

async function fixture(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'teyvat-deploy-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const sources = ['package.json', 'package-lock.json', 'vercel.json', 'llms.txt', 'scripts/build.mjs', 'content/works.json', 'src/data.js', 'api/contact.js', 'assets/photo.webp'];
  for (const path of [...sources, '.env.local', '.vercel/private.json', 'tests/private.json', '.github/workflows/deploy.yml', 'uploads/original.jpg']) {
    await mkdir(dirname(join(cwd, path)), { recursive: true });
    await writeFile(join(cwd, path), path.startsWith('assets/') ? Buffer.from([0, 255, 1, 128]) : 'fixture');
  }
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['add', '.'], { cwd });
  return { cwd, sources };
}

test('deployment manifest excludes even tracked private files and preserves binary bytes and hashes', async t => {
  const { cwd, sources } = await fixture(t);
  const files = await deploymentFiles(cwd);
  assert.deepEqual(files.map(f => f.file).sort(), sources.sort());
  const photo = files.find(f => f.file === 'assets/photo.webp');
  assert.deepEqual(photo.data, Buffer.from([0, 255, 1, 128]));
  assert.equal(photo.sha, createHash('sha1').update(photo.data).digest('hex'));
  await rm(join(cwd, 'assets/photo.webp'));
  await symlink(join(cwd, '.env.local'), join(cwd, 'assets/photo.webp'));
  await assert.rejects(() => deploymentFiles(cwd), /regular file/);
});

test('deployment uses only project APIs, keeps runtime secrets in Vercel and waits for READY', async t => {
  const { cwd } = await fixture(t), calls = [];
  let polls = 0;
  const request = async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    assert.equal(new URL(url).searchParams.get('teamId'), 'team_test');
    assert.equal(options.headers.Authorization, 'Bearer fake-token');
    if (path === '/v2/files') return new Response(null, { status: 200 });
    if (options.method === 'POST') return Response.json({ id: 'dpl_test', url: 'teyvat-test.vercel.app' });
    return Response.json({ readyState: ++polls === 1 ? 'BUILDING' : 'READY' });
  };
  assert.deepEqual(await deploy({ cwd, token: 'fake-token', teamId: 'team_test', projectId: 'prj_test', request, wait: async () => {}, log: () => {} }), { id: 'dpl_test', url: 'teyvat-test.vercel.app' });
  const body = JSON.parse(calls.find(c => c.path === '/v13/deployments').options.body);
  assert.equal(body.project, 'prj_test');
  assert.equal(body.target, 'production');
  assert.ok(!('env' in body));
  assert.ok(!('gitSource' in body));
  assert.equal(calls.filter(c => c.path === '/v13/deployments/dpl_test').length, 2);
});

test('upload failures never create a deployment and build failures fail the workflow', async t => {
  const { cwd } = await fixture(t);
  for (const stage of ['upload', 'build']) {
    let created = 0;
    const request = async (url, options) => {
      if (new URL(url).pathname === '/v2/files') return new Response(null, { status: stage === 'upload' ? 403 : 200 });
      if (options.method === 'POST') { created++; return Response.json({ id: 'dpl_test', url: 'teyvat-test.vercel.app' }); }
      return Response.json({ readyState: 'ERROR' });
    };
    await assert.rejects(() => deploy({ cwd, token: 'fake-token', teamId: 'team_test', projectId: 'prj_test', request, wait: async () => {}, log: () => {} }));
    assert.equal(created, stage === 'upload' ? 0 : 1);
  }
});
