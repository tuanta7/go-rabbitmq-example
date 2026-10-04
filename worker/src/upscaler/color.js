const byte = (value) => Math.max(0, Math.min(255, Math.round(value)));

export function splitBrightnessAndColor(rgb, width, height) {
  const brightness = new Float32Array(width * height);
  const color = Buffer.alloc(width * height * 3);

  for (let i = 0; i < brightness.length; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const luminance = byte(0.299 * r + 0.587 * g + 0.114 * b);
    brightness[i] = luminance / 255;
    color[i * 3] = luminance;
    color[i * 3 + 1] = byte((r - luminance) * 0.713 + 128);
    color[i * 3 + 2] = byte((b - luminance) * 0.564 + 128);
  }

  return { brightness, color };
}

export function mergeBrightnessAndColor(color, brightness) {
  for (let i = 0; i < brightness.length; i++) {
    const luminance = Math.trunc(Math.max(0, Math.min(1, brightness[i])) * 255);
    const cr = color[i * 3 + 1] - 128;
    const cb = color[i * 3 + 2] - 128;
    color[i * 3] = byte(luminance + 1.403 * cr);
    color[i * 3 + 1] = byte(luminance - 0.714 * cr - 0.344 * cb);
    color[i * 3 + 2] = byte(luminance + 1.773 * cb);
  }
  return color;
}
