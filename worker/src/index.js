import { setTimeout as sleep } from 'node:timers/promises';
import { readConfig } from './config.js';
import { ensureBucket, download, upload, closeStorage } from './storage.js';
import { loadModel, upscaleImage } from './upscaler.js';
import { consumeTasks } from './consumer.js';

const config = readConfig();
const models = new Map();
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

async function handleTask({ input_key: inputKey, output_key: outputKey, scale }) {
  if (typeof inputKey !== 'string' || !inputKey || typeof outputKey !== 'string' || !outputKey) {
    throw new Error('input_key and output_key are required strings');
  }
  const model = models.get(scale) ?? models.get(config.scale);
  const input = await download(inputKey);
  await sleep(config.delay * 1000);
  await upload(outputKey, await upscaleImage(model, input));
  console.info(`upscaled ${inputKey} -> ${outputKey} (scale=${model.scale})`);
}

try {
  await ensureBucket();
  for (const scale of [2, 3, 4]) {
    if (shutdown.signal.aborted) break;
    models.set(scale, await loadModel(scale));
  }
  if (!shutdown.signal.aborted) {
    console.info(`worker ready (pid ${process.pid})`);
    await consumeTasks(config, handleTask, shutdown.signal);
  }
} catch (error) {
  console.error(`worker failed (${error.name})`);
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  await Promise.allSettled([...models.values()].map((model) => model.session.release()));
  closeStorage();
}
