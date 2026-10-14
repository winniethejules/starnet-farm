#!/usr/bin/env node
/* farm fork: generate pixel-art assets with the Codex CLI image tool (the user's ChatGPT plan), then pixelize them.
   One generation at a time by default (LANES=n to change); a rate-limited call backs off and retries.

   node scripts/farm-assets/generate.mjs <workdir> [name ...]     (no names = every asset in assets.json)

   Raw images land in <workdir>/raw/<name>.png, true-resolution sprites in <workdir>/px/<name>.png. Needs `codex` logged in and a Python with Pillow + NumPy (PYTHON env var, default python3). */
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
const todo = assets.filter(a => !only.length || only.includes(a.name));

const run = (cmd, args, opts) => new Promise(res => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', code => res({ code, out }));
});

async function one(a) {
  const raw = join(RAW, a.name + '.png');
  if (!existsSync(raw)) {
    const prompt = `Generate exactly one image with your image generation tool and save it as ${a.name}.png in the current directory. Do not edit or post-process it. Subject: ${a.prompt} Style: ${style}`;
    for (let attempt = 1; attempt <= 4 && !existsSync(raw); attempt++) {
      const r = await run('codex', ['exec', '--skip-git-repo-check', '-s', 'workspace-write', '-C', RAW, prompt]);
      if (existsSync(raw)) break;
      const limited = /429|Too Many Requests|rate limit/i.test(r.out);
      console.log(`… ${a.name}: attempt ${attempt} failed (${limited ? 'rate limited' : 'codex exit ' + r.code})`);
      if (!limited && attempt >= 2) { console.log(r.out.slice(-600)); break; }
      await new Promise(res => setTimeout(res, (limited ? 90 : 10) * 1000 * attempt));
    }
    if (!existsSync(raw)) { console.log(`✗ ${a.name}: no image`); return; }
  }
  if (a.sheet) { console.log(`✓ ${a.name}: raw sheet saved (slice separately)`); return; }
  const r = await run(PY, ['-I', join(HERE, 'pixelize.py'), raw, join(PX, a.name + '.png'), '--width', String(a.width), '--colors', '32', '--preview', '6']);
  console.log((r.code ? '✗ ' : '✓ ') + a.name + ': ' + r.out.trim());
}

const queue = [...todo];
const LANES = +process.env.LANES || 1;   // the image tool rate-limits parallel calls; one at a time is the reliable default
await Promise.all(Array.from({ length: LANES }, async () => { while (queue.length) await one(queue.shift()); }));
console.log('done');
