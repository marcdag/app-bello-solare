// Servidor de teste que imita o Supabase (login + API + arquivos) sobre um PostgREST local.
// Só para testar as telas sem criar um projeto. Qualquer senha entra para e-mails existentes em auth.users.
// Uso: PGRST_URL=http://localhost:3901 JWT_SECRET=... USERS_JSON='{"email":"uuid"}' node supabase_falso.mjs
import http from 'node:http';
import crypto from 'node:crypto';

const PORTA = Number(process.env.PORTA ?? 54321);
const USERS = JSON.parse(process.env.USERS_JSON);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const assinar = (sub, email) => {
  const c = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 })}`;
  return `${c}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(c).digest('base64url')}`;
};
const ler = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); });
const usuario = (id, email) => ({ id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
const json = (res, st, o) => { res.writeHead(st, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }); res.end(JSON.stringify(o)); };

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, {});
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/auth/v1/token') {
    const corpo = JSON.parse((await ler(req)) || '{}');
    const id = USERS[corpo.email];
    if (!id) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
    const t = assinar(id, corpo.email);
    return json(res, 200, { access_token: t, token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'r-' + id, user: usuario(id, corpo.email) });
  }
  if (url.pathname === '/auth/v1/user') {
    const tok = (req.headers.authorization ?? '').replace('Bearer ', '');
    try {
      const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
      return json(res, 200, usuario(p.sub, p.email));
    } catch { return json(res, 401, { msg: 'invalid' }); }
  }
  if (url.pathname === '/auth/v1/logout') { res.writeHead(204); return res.end(); }
  if (url.pathname.startsWith('/storage/v1')) return json(res, 200, { Key: 'fotos/x', signedURL: '/x' });
  if (url.pathname.startsWith('/rest/v1')) {
    const alvo = process.env.PGRST_URL + url.pathname.replace('/rest/v1', '') + url.search;
    const corpo = ['GET', 'HEAD'].includes(req.method) ? undefined : await ler(req);
    const h = { ...req.headers }; delete h.host; delete h['content-length'];
    const r = await fetch(alvo, { method: req.method, headers: h, body: corpo });
    res.writeHead(r.status, Object.fromEntries([...r.headers].filter(([k]) => !['content-encoding', 'transfer-encoding'].includes(k))));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  json(res, 404, { msg: 'não simulado' });
}).listen(PORTA, () => console.log('supabase falso em', PORTA));
