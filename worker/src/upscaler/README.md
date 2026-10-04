# Image upscaler

This folder is a black box for the rest of the worker. Give it an image and a loaded model; it returns a larger PNG. The worker does not need to know how pixels or ONNX tensors are handled.

## Public API

From another module in `worker/src`, import both functions from `./upscaler/index.js`:

```js
import { loadModel, upscaleImage } from './upscaler/index.js';

const model = await loadModel(3); // 2, 3, or 4; loads the matching bundled ONNX weights
try {
  const png = await upscaleImage(model, inputImage); // Buffer in, PNG Buffer out
} finally {
  await model.session.release();
}
```

`inputImage` can be any image format that Sharp can decode. `upscaleImage` returns a PNG buffer whose width and height are each multiplied by `model.scale`. `loadModel` also accepts an optional path to another ONNX weights file. Model loading and image decoding errors are passed to the caller.

To try it without writing code, run `npm run try-upscale` from `worker/`. This reads the bundled example image and saves a 3× PNG in `worker/assets/images/`.

## What happens inside

1. `image.js` decodes the image into RGB pixels, removing any alpha channel.
2. `color.js` separates brightness from color. The FSRCNN model only needs brightness; this keeps the model small.
3. `model.js` runs the brightness values through the ONNX model on the CPU. In parallel, `image.js` enlarges the color values with cubic interpolation.
4. `color.js` combines the improved brightness with the enlarged color, and `image.js` encodes the result as PNG.

`upscale.js` connects these steps. `index.js` exposes only the two functions used by the CLI and RabbitMQ worker. The caller owns the loaded model and must release its session when finished.
