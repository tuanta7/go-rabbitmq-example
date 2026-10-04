import * as ort from 'onnxruntime-node';
import { fileURLToPath } from 'node:url';

export async function loadModel(
  scale,
  weights = new URL(`../../assets/weights/fsrcnn_x${scale}.onnx`, import.meta.url),
) {
  if (![2, 3, 4].includes(scale)) throw new Error('scale must be 2, 3, or 4');

  const session = await ort.InferenceSession.create(
    weights instanceof URL ? fileURLToPath(weights) : weights,
    { executionProviders: ['cpu'], intraOpNumThreads: 1 },
  );
  return { scale, session };
}

export async function upscaleBrightness(session, brightness, width, height, scale) {
  const outputs = await session.run({
    [session.inputNames[0]]: new ort.Tensor('float32', brightness, [1, 1, height, width]),
  });
  const result = outputs[session.outputNames[0]];
  if (result.data.length !== width * height * scale * scale) {
    throw new Error('Unexpected model output dimensions');
  }
  return result.data;
}
