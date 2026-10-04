import { decodeRgb, resizeColor, encodePng } from './image.js';
import { splitBrightnessAndColor, mergeBrightnessAndColor } from './color.js';
import { upscaleBrightness } from './model.js';

export async function upscaleImage({ scale, session }, input) {
  const { data, width, height } = await decodeRgb(input);
  const { brightness, color } = splitBrightnessAndColor(data, width, height);
  const outputWidth = width * scale;
  const outputHeight = height * scale;

  const [resizedColor, upscaledBrightness] = await Promise.all([
    resizeColor(color, width, height, outputWidth, outputHeight),
    upscaleBrightness(session, brightness, width, height, scale),
  ]);

  const result = mergeBrightnessAndColor(resizedColor, upscaledBrightness);
  return encodePng(result, outputWidth, outputHeight);
}
