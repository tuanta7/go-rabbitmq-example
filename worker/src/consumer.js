import amqp from 'amqplib';
import { setTimeout as sleep } from 'node:timers/promises';

function publishStatus(channel, queue, taskId, status) {
  if (!taskId) return;
  return new Promise((resolve, reject) => {
    channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify({ task_id: taskId, status })),
      { contentType: 'application/json' },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

async function processMessage(channel, message, resultsQueue, handleTask) {
  let task;
  try {
    task = JSON.parse(message.content.toString());
    if (!task || typeof task !== 'object' || Array.isArray(task))
      throw new Error('Expected a task object');
  } catch {
    console.error('discarding malformed task');
    channel.reject(message, false);
    return;
  }

  await publishStatus(channel, resultsQueue, task.task_id, 'processing');
  try {
    await handleTask(task);
  } catch (error) {
    console.error(`task failed: ${task.task_id ?? '<no id>'} (${error.name})`);
    await publishStatus(channel, resultsQueue, task.task_id, 'failed');
    channel.reject(message, false);
    return;
  }
  await publishStatus(channel, resultsQueue, task.task_id, 'done');
  channel.ack(message);
}

export async function consumeTasks(config, handleTask, signal) {
  const url = new URL(config.url);
  url.searchParams.set('heartbeat', '600');

  while (!signal.aborted) {
    let connection, channel, consumerTag, inFlight;
    const { promise: disconnected, resolve: finish } = Promise.withResolvers();
    signal.addEventListener('abort', finish, { once: true });
    try {
      connection = await amqp.connect(url.toString());
      connection.on('error', finish);
      connection.on('close', finish);
      if (signal.aborted) break;

      channel = await connection.createConfirmChannel();
      channel.on('error', finish);
      channel.on('close', finish);
      await channel.assertQueue(config.queue, { durable: true });
      await channel.assertQueue(config.resultsQueue, { durable: true });
      await channel.prefetch(1);
      ({ consumerTag } = await channel.consume(
        config.queue,
        (message) => {
          if (!message) return finish();
          inFlight = processMessage(channel, message, config.resultsQueue, handleTask).catch(
            finish,
          );
        },
        { noAck: false },
      ));
      console.info(`waiting for tasks on ${config.queue}`);
      await disconnected;
    } catch (error) {
      if (!signal.aborted) console.warn(`RabbitMQ connection interrupted (${error.name})`);
    } finally {
      signal.removeEventListener('abort', finish);
      // Stop new deliveries before draining the active task and closing the connection.
      if (consumerTag) await channel.cancel(consumerTag).catch(() => {});
      await inFlight;
      if (connection) await connection.close().catch(() => {});
    }
    if (!signal.aborted) {
      console.info('reconnecting to RabbitMQ in 5s');
      await sleep(5000, undefined, { signal }).catch(() => {});
    }
  }
}
