import sharp from 'sharp';

export async function decodeRgb(input) {
  const { data, info } = await sharp(input)
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function resizeColor(color, width, height, outputWidth, outputHeight) {
  return sharp(color, { raw: { width, height, channels: 3 } })
    .resize(outputWidth, outputHeight, { kernel: 'cubic' })
    .raw()
    .toBuffer();
}

export async function encodePng(rgb, width, height) {
  return sharp(rgb, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}
