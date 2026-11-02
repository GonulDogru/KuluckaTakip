const { URL } = require('node:url');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key || new URL(url).protocol !== 'https:') {
  throw new Error('Release requires an HTTPS Supabase URL and public key. Check .env.');
}
if (!key.startsWith('sb_publishable_')) {
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
  if (role !== 'anon') throw new Error('Use the public anon/publishable key; private server keys cannot be bundled.');
}
console.log('Release environment validated.');
