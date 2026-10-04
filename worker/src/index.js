import { setTimeout as sleep } from 'node:timers/promises';
import { readConfig } from './config.js';
import { ensureBucket, download, upload, closeStorage } from './storage.js';
import { loadModel, upscaleImage } from './upscaler/index.js';
import { consume } from './consumer/index.js';

const config = readConfig();
const models = new Map();

const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  // Prepare storage before receiving any tasks.
  await ensureBucket();
  // Load each model once and reuse it for every task at that scale.
  for (const scale of [2, 3, 4]) {
    if (shutdown.signal.aborted) break;
    models.set(scale, await loadModel(scale));
  }

  if (!shutdown.signal.aborted) {
    console.info(`worker ready (pid ${process.pid})`);
    await consume(config, handleTask, shutdown.signal);
  }
} catch (error) {
  console.error(`worker failed (${error.name})`);
  process.exitCode = 1;
} finally {
  // Release native model sessions and the S3 client after consumption stops.
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  await Promise.allSettled([...models.values()].map((model) => model.session.release()));
  closeStorage();
}

async function handleTask({ input_key: inputKey, output_key: outputKey, scale }) {
  if (typeof inputKey !== 'string' || !inputKey || typeof outputKey !== 'string' || !outputKey) {
    throw new Error('input_key and output_key are required strings');
  }
  const model = models.get(scale) ?? models.get(config.scale);
  const input = await download(inputKey);
  // Optional delay simulates slow processing during development.
  await sleep(config.delay * 1000);
  // Upload must finish before the consumer can report success and ACK the task.
  await upload(outputKey, await upscaleImage(model, input));
  console.info(`upscaled ${inputKey} -> ${outputKey} (scale=${model.scale})`);
}
