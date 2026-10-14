#!/usr/bin/env node
/* farm fork: generate pixel-art assets with the Codex CLI image tool (the user's ChatGPT plan), then pixelize them.
   One generation at a time by default (LANES=n to change); a rate-limited call backs off and retries.

   node scripts/farm-assets/generate.mjs <workdir> [name ...]     (no names = every asset in assets.json)

   Raw images land in <workdir>/raw/<name>.png, true-resolution sprites in <workdir>/px/<name>.png. Needs `codex` logged in and a Python with Pillow + NumPy (PYTHON env var, default python3).
   Exits 1 if any requested asset ends without its file, or a name is unknown. Each child process gets a time limit
   (CODEX_TIMEOUT / PY_TIMEOUT seconds, default 600 / 120). */
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { style, assets } = JSON.parse(readFileSync(join(HERE, 'assets.json'), 'utf8'));
const [work, ...only] = process.argv.slice(2);
if (!work) { console.error('usage: generate.mjs <workdir> [name ...]'); process.exit(1); }
const RAW = join(work, 'raw'), PX = join(work, 'px');
mkdirSync(RAW, { recursive: true }); mkdirSync(PX, { recursive: true });
const PY = process.env.PYTHON || 'python3';
const unknown = only.filter(n => !assets.some(a => a.name === n));
if (unknown.length) { console.error('unknown asset name(s): ' + unknown.join(', ') + '\nknown: ' + assets.map(a => a.name).join(', ')); process.exit(1); }
const todo = assets.filter(a => !only.length || only.includes(a.name));
const lanes = process.env.LANES == null ? 1 : Number(process.env.LANES);
if (!Number.isInteger(lanes) || lanes < 1 || lanes > 4) { console.error('LANES must be a whole number from 1 to 4'); process.exit(1); }
const seconds = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const CODEX_TIMEOUT = seconds(process.env.CODEX_TIMEOUT, 600), PY_TIMEOUT = seconds(process.env.PY_TIMEOUT, 120);
const failed = [];

// never rejects: a missing executable or a hung child comes back as a failed result instead of killing the queue
const run = (cmd, args, timeoutS) => new Promise(res => {
  let out = '', done = false, p;
  const finish = (code, extra) => { if (done) return; done = true; clearTimeout(timer); res({ code, out: out + (extra || '') }); };
  const timer = setTimeout(() => { if (p) p.kill('SIGKILL'); finish(124, `\n[timed out after ${timeoutS}s]`); }, timeoutS * 1000);
  try { p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return finish(127, String(e.message || e)); }
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('error', e => finish(127, `\n${cmd}: ${e.code === 'ENOENT' ? 'not found on PATH' : e.message}`));
  p.on('close', code => finish(code == null ? 1 : code));
});

async function one(a) {
  const raw = join(RAW, a.name + '.png');
  if (!existsSync(raw)) {
    const prompt = `Generate exactly one image with your image generation tool and save it as ${a.name}.png in the current directory. Do not edit or post-process it. Subject: ${a.prompt} Style: ${style}`;
    for (let attempt = 1; attempt <= 4 && !existsSync(raw); attempt++) {
      const r = await run('codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', RAW, prompt], CODEX_TIMEOUT);
      if (r.code === 127) { console.log(r.out.trim().split('\n').pop()); break; }   // codex missing: retrying will not help
      if (existsSync(raw)) break;
      const limited = /429|Too Many Requests|rate limit/i.test(r.out);
      console.log(`… ${a.name}: attempt ${attempt} failed (${limited ? 'rate limited' : 'codex exit ' + r.code})`);
      if (!limited && attempt >= 2) { console.log(r.out.slice(-600)); break; }
      await new Promise(res => setTimeout(res, (limited ? 90 : 10) * 1000 * attempt));
    }
    if (!existsSync(raw)) { console.log(`✗ ${a.name}: no image`); failed.push(a.name); return; }
  }
  if (a.sheet) { console.log(`✓ ${a.name}: raw sheet saved (slice separately)`); return; }
  const r = await run(PY, ['-I', join(HERE, 'pixelize.py'), raw, join(PX, a.name + '.png'), '--width', String(a.width), '--colors', '32', '--preview', '6'], PY_TIMEOUT);
  console.log((r.code ? '✗ ' : '✓ ') + a.name + ': ' + r.out.trim());
  if (r.code) failed.push(a.name);
}

const queue = [...todo];
// the image tool rate-limits parallel calls; one at a time is the reliable default
await Promise.all(Array.from({ length: lanes }, async () => { while (queue.length) await one(queue.shift()); }));
if (failed.length) { console.log(`done with ${failed.length} failure(s): ${failed.join(', ')}`); process.exitCode = 1; }
else console.log(`done: ${todo.length} asset(s)`);
