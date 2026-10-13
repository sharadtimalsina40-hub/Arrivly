import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const directory = await mkdtemp(join(tmpdir(), 'arrivly-resume-writing-tests-'));
const output = join(directory, 'resume-writing.test.mjs');

try {
  await build({
    entryPoints: [resolve('tests/resume/resume-writing.test.ts')],
    outfile: output,
    bundle: true,
    format: 'esm',
    platform: 'node',
    sourcemap: 'inline',
  });

  const processUnderTest = spawn(process.execPath, ['--test', output], {
    stdio: 'inherit',
  });
  const [exitCode] = await once(processUnderTest, 'exit');
  if (exitCode !== 0) {
    process.exitCode = typeof exitCode === 'number' ? exitCode : 1;
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

