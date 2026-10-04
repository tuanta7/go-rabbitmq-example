# Worker

Consumes RabbitMQ tasks, downloads images from S3 Storage, upscales them with FSRCNN, and uploads PNG results.

The image processing code lives in [`src/upscaler/`](src/upscaler/README.md). Its README explains the two-function API and the steps inside the upscaler.

[`src/consumer/`](src/consumer/index.js) receives RabbitMQ tasks. It acknowledges a task after the image is uploaded and the `done` status is confirmed by RabbitMQ. Malformed and failed tasks are rejected without requeueing; a connection or status publish failure leaves the task unacknowledged so RabbitMQ can redeliver it.
