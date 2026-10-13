import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), 'arrivly-job-analysis-tests-'),
);
const outputFile = join(temporaryDirectory, 'job-analysis.test.mjs');

try {
  await build({
    entryPoints: [resolve('tests/resume/job-analysis.test.ts')],
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
