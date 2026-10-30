import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIRECTORIES = ['api/', 'lib/', 'src/', 'assets/', 'content/', 'scripts/'];
const FILES = ['package.json', 'package-lock.json', 'vercel.json', 'llms.txt'];
const REQUIRED = [...FILES, 'scripts/build.mjs', 'content/works.json', 'src/data.js', 'api/contact.js'];

export async function deploymentFiles(cwd) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd }).toString().split('\0').filter(Boolean);
  const paths = tracked.filter(path => FILES.includes(path) || DIRECTORIES.some(dir => path.startsWith(dir)));
  for (const file of REQUIRED) if (!paths.includes(file)) throw new Error(`Missing deployment source: ${file}`);
  return Promise.all(paths.map(async file => {
    const path = resolve(cwd, file);
    if (!(await lstat(path)).isFile()) throw new Error(`Deployment source must be a regular file: ${file}`);
    const data = await readFile(path);
    return { file, data, size: data.length, sha: createHash('sha1').update(data).digest('hex') };
  }));
}

// Use project-scoped REST operations: the CLI also looks up users/teams,
// which project-scoped tokens cannot read (vercel/vercel#17506).
export async function deploy({ token, teamId, projectId, cwd = process.cwd(), request = fetch,
  log = console.log, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!token || !teamId || !projectId) throw new Error('VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID are required.');
  const api = async (path, options = {}) => {
    const response = await request(`https://api.vercel.com${path}?teamId=${encodeURIComponent(teamId)}`, {
      ...options, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
    });
    if (!response.ok) throw new Error(`Vercel API ${options.method || 'GET'} ${path} failed (${response.status}).`);
    return response;
  };
  const files = await deploymentFiles(cwd);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, files.length) }, async () => {
    while (next < files.length) {
      const { data, sha } = files[next++];
      for (let attempt = 0; ; attempt++) {
        try {
          await api('/v2/files', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream',
            'Content-Length': String(data.length), 'x-vercel-digest': sha }, body: data });
          break;
        } catch (error) {
          if (attempt >= 2 || !/\((?:429|5\d\d)\)/.test(error.message)) throw error;
          await wait(1000 * 2 ** attempt);
        }
      }
    }
  }));
  log(`Uploaded ${files.length} source files.`);
  const created = await (await api('/v13/deployments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'teyvat', project: projectId, target: 'production',
      files: files.map(({ file, sha, size }) => ({ file, sha, size })),
      meta: { deploymentSource: 'github-actions', ...(process.env.GITHUB_SHA ? { githubCommitSha: process.env.GITHUB_SHA } : {}) },
    }),
  })).json();
  if (!created.id || !created.url) throw new Error('Vercel did not return a deployment ID and URL.');
  log(`Deployment: https://${created.url}`);
  const deadline = Date.now() + 10 * 60 * 1000;
  let previous;
  while (Date.now() < deadline) {
    const state = await (await api(`/v13/deployments/${encodeURIComponent(created.id)}`)).json();
    if (state.readyState !== previous) { log(`Deployment status: ${state.readyState}`); previous = state.readyState; }
    if (state.readyState === 'READY') {
      if (state.aliasError) throw new Error('Deployment built but production domain assignment failed.');
      return { id: created.id, url: created.url };
    }
    if (['ERROR', 'CANCELED'].includes(state.readyState)) throw new Error(`Vercel deployment ended in ${state.readyState}. See the Vercel build log.`);
    await wait(5000);
  }
  throw new Error('Deployment status timed out. Check Vercel before retrying.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  deploy({ token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_ORG_ID, projectId: process.env.VERCEL_PROJECT_ID })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
