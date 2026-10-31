import { PROJECT, TEAM } from '../lib/studio-provider.js';

const token = process.env.VERCEL_TOKEN;
if (!token) throw new Error('VERCEL_TOKEN is required.');
const response = await fetch(`https://api.vercel.com/v10/projects/${PROJECT}/env?teamId=${TEAM}&upsert=true`, {
  method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'ADMIN_DEPLOY_TOKEN', value: token, type: 'sensitive', target: ['production'] }),
});
if (!response.ok) throw new Error(`Studio project credential configuration failed (${response.status}).`);
console.log('Studio deployment credential configured for the existing project.');
