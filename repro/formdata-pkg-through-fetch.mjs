// P4: body-layer inversion + stream lifecycle probes (axios v1.20.0)
import http from 'node:http';
import fs from 'node:fs';
import FormDataPkg from 'form-data';
import { listenerCount } from 'node:events';
import axios from '../index.js';

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    if (req.url === '/empty204') { res.statusCode = 204; return res.end(); }
    const body = Buffer.concat(chunks);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      ct: req.headers['content-type'] ?? null,
      len: body.length,
      head: body.subarray(0, 60).toString('latin1'),
    }));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;

// (a) postForm with env.FormData = form-data package, forced fetch adapter
{
  const fd = new FormDataPkg();
  fd.append('field', 'value');
  try {
    const r = await axios.post(base + '/a', fd, { adapter: 'fetch' });
    console.log('(a) fetch + form-data-pkg instance ->', JSON.stringify(r.data));
  } catch (e) {
    console.log('(a) fetch + form-data-pkg instance -> ERROR', e.code, String(e.message).slice(0, 90));
  }
  try {
    const r = await axios.post(base + '/a2', { field: 'value' }, {
      adapter: 'fetch',
      headers: { 'Content-Type': 'multipart/form-data' },
      env: { FormData: FormDataPkg },
    });
    console.log('(a2) fetch + env.FormData=form-data-pkg ->', JSON.stringify(r.data));
  } catch (e) {
    console.log('(a2) fetch + env.FormData=form-data-pkg -> ERROR', e.code, String(e.message).slice(0, 90));
  }
  // control: http adapter with the same package instance
  const fd2 = new FormDataPkg();
  fd2.append('field', 'value');
  try {
    const r = await axios.post(base + '/a3', fd2, { adapter: 'http' });
    console.log('(a3) http  + form-data-pkg instance ->', JSON.stringify(r.data));
  } catch (e) {
    console.log('(a3) http  + form-data-pkg instance -> ERROR', e.code, String(e.message).slice(0, 90));
  }
}

// (b) fetch stream + 204: composed signal listener/timer lifetime
{
  const ctrl = new AbortController();
  const t0 = Date.now();
  const p = axios.get(base + '/empty204', { responseType: 'stream', adapter: 'fetch', signal: ctrl.signal, timeout: 1200 });
  const resp = await p;
  console.log('(b) stream+204 resolved in', Date.now() - t0, 'ms; listeners on user signal:', listenerCount(ctrl.signal, 'abort'));
  // http adapter control
  const ctrl2 = new AbortController();
  await axios.get(base + '/empty204', { responseType: 'stream', adapter: 'http', signal: ctrl2.signal, timeout: 1200 });
  console.log('(b) http  stream+204 listeners after resolve:', listenerCount(ctrl2.signal, 'abort'));
}

// (c) http: stream response + abort mid-body -> error on stream? reason preserved?
{
  const srv2 = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    let n = 0;
    const iv = setInterval(() => { res.write('x'.repeat(32)); if (++n > 5) { clearInterval(iv); } }, 60);
    req.on('aborted', () => clearInterval(iv));
  });
  await new Promise((r) => srv2.listen(0, '127.0.0.1', r));
  const b2 = 'http://127.0.0.1:' + srv2.address().port;
  const ctrl = new AbortController();
  const r = await axios.get(b2 + '/slow', { responseType: 'stream', adapter: 'http', signal: ctrl.signal });
  const data = r.data;
  const outcome = await new Promise((resolve) => {
    let n = 0;
    data.on('data', (c) => { if (++n === 2) ctrl.abort(new Error('mid-body-reason')); });
    data.on('error', (e) => resolve('stream error: ' + e.code + ' ' + e.message));
    data.on('end', () => resolve('stream ended clean'));
    data.on('close', () => resolve('closed'));
  });
  console.log('(c) http stream mid-abort ->', outcome, '| isCancel:', axios.isCancel);
  srv2.close();
}
server.close();
process.exit(0);
