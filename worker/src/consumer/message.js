function publishStatus(channel, queue, taskId, status) {
  if (!taskId) return;
  return new Promise((resolve, reject) => {
    channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify({ task_id: taskId, status })),
      { contentType: 'application/json', persistent: true },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

export async function process(channel, message, resultsQueue, handleTask) {
  let task;
  try {
    task = JSON.parse(message.content.toString());
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      throw new Error('Expected a task object');
    }
  } catch {
    console.error('discarding malformed task');
    channel.nack(message, false, false);
    return;
  }

  await publishStatus(channel, resultsQueue, task.task_id, 'processing');
  try {
    await handleTask(task);
  } catch (error) {
    console.error(`task failed: ${task.task_id ?? '<no id>'} (${error.name})`);
    await publishStatus(channel, resultsQueue, task.task_id, 'failed');
    channel.nack(message, false, false);
    return;
  }

  await publishStatus(channel, resultsQueue, task.task_id, 'done');
  channel.ack(message);
}
