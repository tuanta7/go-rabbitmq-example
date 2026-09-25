import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { loadModel, upscaleImage } from './upscaler.js';

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      scale: { type: 'string', default: process.env.WORKER_UPSCALE_SCALE ?? '3' },
      weights: { type: 'string' },
    },
    allowPositionals: true,
  });
  if (positionals.length !== 2) {
    throw new Error('Usage: npm run upscale -- input output --scale 3 [--weights model.onnx]');
  }

  const [inputPath, outputPath] = positionals;
  const upscaler = await loadModel(
    Number(values.scale),
    values.weights ?? process.env.WEIGHTS_PATH,
  );
  try {
    const input = await readFile(inputPath);
    await writeFile(outputPath, await upscaleImage(upscaler, input));
    console.info(`saved ${outputPath}`);
  } finally {
    await upscaler.session.release();
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
