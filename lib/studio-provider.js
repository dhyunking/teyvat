import { createHash } from 'node:crypto';
import { StudioError } from './studio-error.js';

export const PROJECT = 'prj_48ShQimQqTZFmUu3iaDCY4i5mOwO';
export const TEAM = 'team_oynSdGxWvPwGvsk1XOiTA6RB';
export function createStudioProvider(env = process.env, fetcher = fetch) {
  async function api(path, options = {}, token = env.ADMIN_DEPLOY_TOKEN) {
    if (!token) throw new StudioError(503, '게시 연결을 준비하고 있습니다.');
    const url = new URL(path, 'https://api.vercel.com'); url.searchParams.set('teamId', TEAM);
    const response = await fetcher(url.href, {
      ...options, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
    });
    if (!response.ok) {
      const error = new StudioError(503, `게시 서비스 응답을 확인하지 못했습니다 (${response.status}). 잠시 후 다시 확인해 주세요.`);
      error.definitive = response.status >= 400 && response.status < 500 && response.status !== 408;
      throw error;
    }
    return response;
  }
  return {
    async authorize(token) {
      try { return (await (await api(`/v9/projects/${PROJECT}`, {}, token)).json()).id === PROJECT; } catch { return false; }
    },
    async upload(bytes) {
      const sha = createHash('sha1').update(bytes).digest('hex');
      await api('/v2/files', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length), 'x-vercel-digest': sha }, body: bytes });
      return sha;
    },
    async create(files, meta) {
      const result = await (await api('/v13/deployments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'teyvat', project: PROJECT, target: 'production', files, meta }) })).json();
      if (!result.id || !result.url) throw new StudioError(503, '게시 요청 결과를 확인하지 못했습니다.');
      return { id: result.id, url: result.url };
    },
    async status(id) {
      const result = await (await api('/v13/deployments/' + encodeURIComponent(id))).json();
      if (result.projectId !== PROJECT && result.project?.id !== PROJECT) throw new StudioError(403, '게시 프로젝트를 확인할 수 없습니다.');
      return { id: result.id, status: result.readyState, aliasError: Boolean(result.aliasError), meta: result.meta || {} };
    },
    async findJob(jobId) {
      const result = await (await api(`/v6/deployments?projectId=${PROJECT}&limit=20`)).json();
      const found = result.deployments?.find(d => d.meta?.cmsJobId === jobId && (d.projectId === PROJECT || d.name === 'teyvat'));
      return found ? { id: found.uid, url: found.url } : null;
    },
    async currentSha() {
      const project = await (await api(`/v9/projects/${PROJECT}`)).json();
      return project.targets?.production?.meta?.githubCommitSha || null;
    },
  };
}
