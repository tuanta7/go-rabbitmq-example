export function readConfig(env = process.env) {
  const scale = Number(env.WORKER_UPSCALE_SCALE ?? 3);
  const delay = Number(env.WORKER_FAKE_DELAY ?? 5);
  if (![2, 3, 4].includes(scale)) throw new Error('WORKER_UPSCALE_SCALE must be 2, 3, or 4');
  if (!Number.isFinite(delay) || delay < 0)
    throw new Error('WORKER_FAKE_DELAY must be a nonnegative number');
  return {
    scale,
    delay,
    url: env.RABBITMQ_URL ?? 'amqp://rabbitmq:password@localhost:5672/',
    queue: env.RABBITMQ_TASK_QUEUE ?? 'upscale.tasks',
    resultsQueue: env.RABBITMQ_RESULTS_QUEUE ?? 'upscale.results',
    endpoint: env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: env.S3_REGION ?? 'ap-southeast-1',
    accessKey: env.S3_ACCESS_KEY ?? 'minio',
    secretKey: env.S3_SECRET_KEY ?? 'password',
    bucket: env.S3_BUCKET ?? 'images',
  };
}
