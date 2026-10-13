import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), 'arrivly-follow-up-tests-'),
);
const outputFile = join(temporaryDirectory, 'follow-up.test.mjs');

try {
  await build({
    entryPoints: [resolve('tests/resume/follow-up.test.ts')],
    outfile: outputFile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    sourcemap: 'inline',
  });

  const testProcess = spawn(process.execPath, ['--test', outputFile], {
    stdio: 'inherit',
  });
  const [exitCode] = await once(testProcess, 'exit');

  if (exitCode !== 0) {
    process.exitCode = typeof exitCode === 'number' ? exitCode : 1;
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

