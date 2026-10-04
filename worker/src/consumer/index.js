import amqp from 'amqplib';
import { setTimeout as sleep } from 'node:timers/promises';
import { process } from './message.js';

export async function consume(config, handleTask, signal) {
  const url = new URL(config.url);
  url.searchParams.set('heartbeat', '600');

  while (!signal.aborted) {
    let connection, channel, consumerTag;
    let inFlight = Promise.resolve();
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
          inFlight = process(channel, message, config.resultsQueue, handleTask).catch(finish);
        },
        { noAck: false },
      ));
      console.info(`waiting for tasks on ${config.queue}`);

      await disconnected;
    } catch (error) {
      if (!signal.aborted) {
        console.warn(`RabbitMQ connection interrupted (${error.name})`);
      }
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
