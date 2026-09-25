import sharp from 'sharp';
import * as ort from 'onnxruntime-node';
import { fileURLToPath } from 'node:url';

const byte = (value) => Math.max(0, Math.min(255, Math.round(value)));

export async function loadModel(
  scale,
  weights = new URL(`../assets/weights/fsrcnn_x${scale}.onnx`, import.meta.url),
) {
  if (![2, 3, 4].includes(scale)) throw new Error('scale must be 2, 3, or 4');
  const session = await ort.InferenceSession.create(
    weights instanceof URL ? fileURLToPath(weights) : weights,
    {
      executionProviders: ['cpu'],
      intraOpNumThreads: 1,
    },
  );
  return { scale, session };
}

export async function upscaleImage({ scale, session }, input) {
  const {
    data,
    info: { width, height },
  } = await sharp(input)
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const y = new Float32Array(width * height);
  const color = Buffer.alloc(width * height * 3);
  for (let i = 0; i < y.length; i++) {
    const r = data[i * 3],
      g = data[i * 3 + 1],
      b = data[i * 3 + 2];
    const luminance = byte(0.299 * r + 0.587 * g + 0.114 * b);
    y[i] = luminance / 255;
    color[i * 3] = luminance;
    color[i * 3 + 1] = byte((r - luminance) * 0.713 + 128);
    color[i * 3 + 2] = byte((b - luminance) * 0.564 + 128);
  }
  const w = width * scale,
    h = height * scale;
  const resized = await sharp(color, { raw: { width, height, channels: 3 } })
    .resize(w, h, { kernel: 'cubic' })
    .raw()
    .toBuffer();
  const outputs = await session.run({
    [session.inputNames[0]]: new ort.Tensor('float32', y, [1, 1, height, width]),
  });
  const result = outputs[session.outputNames[0]];
  if (result.data.length !== w * h) throw new Error('Unexpected model output dimensions');
  for (let i = 0; i < w * h; i++) {
    const luminance = Math.trunc(Math.max(0, Math.min(1, result.data[i])) * 255);
    const cr = resized[i * 3 + 1] - 128,
      cb = resized[i * 3 + 2] - 128;
    resized[i * 3] = byte(luminance + 1.403 * cr);
    resized[i * 3 + 1] = byte(luminance - 0.714 * cr - 0.344 * cb);
    resized[i * 3 + 2] = byte(luminance + 1.773 * cb);
  }
  return sharp(resized, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toBuffer();
}
