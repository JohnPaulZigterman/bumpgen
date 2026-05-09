const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
const stage = document.querySelector(".stage");
const textLines = document.querySelector("#textLines");
const addLineBtn = document.querySelector("#addLineBtn");
const imageInput = document.querySelector("#imageInput");
const songInput = document.querySelector("#songInput");
const creditText = document.querySelector("#creditText");
const creditPosition = document.querySelector("#creditPosition");
const creditFont = document.querySelector("#creditFont");
const creditSize = document.querySelector("#creditSize");
const creditSizeValue = document.querySelector("#creditSizeValue");
const secondsPerLineInput = document.querySelector("#secondsPerLine");
const secondsPerLineValue = document.querySelector("#secondsPerLineValue");
const fontSizeInput = document.querySelector("#fontSize");
const fontSizeValue = document.querySelector("#fontSizeValue");
const formatInput = document.querySelector("#format");
const toneInput = document.querySelector("#tone");
const tintStrength = document.querySelector("#tintStrength");
const tintStrengthValue = document.querySelector("#tintStrengthValue");
const previewBtn = document.querySelector("#previewBtn");
const renderBtn = document.querySelector("#renderBtn");
const downloadLink = document.querySelector("#downloadLink");
const outputVideo = document.querySelector("#outputVideo");
const status = document.querySelector("#status");
const progress = document.querySelector("#progress");
const timeLabel = document.querySelector("#timeLabel");
const durationLabel = document.querySelector("#durationLabel");
const wallpaperShapes = document.querySelector("#wallpaperShapes");
const wallpaperScheme = document.querySelector("#wallpaperScheme");
const wallpaperSpacing = document.querySelector("#wallpaperSpacing");
const wallpaperSpacingValue = document.querySelector("#wallpaperSpacingValue");
const wallpaperPreview = document.querySelector("#wallpaperPreview");
const wallpaperPreviewCtx = wallpaperPreview.getContext("2d");
const randomizeWallpaperBtn = document.querySelector("#randomizeWallpaperBtn");
const useWallpaperBtn = document.querySelector("#useWallpaperBtn");

let backgroundImage = null;
let backgroundUrl = "";
let outputUrl = "";
let animationId = 0;
let previewStart = performance.now();
let wallpaperSeed = Math.floor(Math.random() * 100000);
let creditWasAutoFilled = true;

const state = {
  rendering: false,
  previewing: true,
  usingWallpaper: false,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function selectedPlacement() {
  return document.querySelector("input[name='placement']:checked").value;
}

function selectedAlignment() {
  return document.querySelector("input[name='alignment']:checked").value;
}

function secondsPerLine() {
  return clamp(Number(secondsPerLineInput.value) || 5, 1, 12);
}

function textLineValues() {
  const lines = [...textLines.querySelectorAll(".line-input")]
    .map((input) => input.value.trim())
    .filter(Boolean);
  return lines.length ? lines : [" "];
}

function durationSeconds() {
  return textLineValues().length * secondsPerLine();
}

function activeText(time) {
  const lines = textLineValues();
  const index = Math.min(lines.length - 1, Math.floor(time / secondsPerLine()));
  return lines[index] || " ";
}

function synchsafeToInt(bytes) {
  return ((bytes[0] & 0x7f) << 21) | ((bytes[1] & 0x7f) << 14) | ((bytes[2] & 0x7f) << 7) | (bytes[3] & 0x7f);
}

function readUint32(bytes, synchsafe = false) {
  if (synchsafe) return synchsafeToInt(bytes);
  return ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
}

function decodeUtf16(bytes, littleEndian) {
  const values = [];
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const code = littleEndian ? bytes[index] | (bytes[index + 1] << 8) : (bytes[index] << 8) | bytes[index + 1];
    if (code === 0) break;
    values.push(code);
  }
  return String.fromCharCode(...values);
}

function decodeId3Text(bytes) {
  if (!bytes.length) return "";
  const encoding = bytes[0];
  const payload = bytes.slice(1);

  if (encoding === 0) return new TextDecoder("latin1").decode(payload).replace(/\0+$/g, "").trim();
  if (encoding === 3) return new TextDecoder("utf-8").decode(payload).replace(/\0+$/g, "").trim();
  if (encoding === 1) {
    if (payload[0] === 0xff && payload[1] === 0xfe) return decodeUtf16(payload.slice(2), true).trim();
    if (payload[0] === 0xfe && payload[1] === 0xff) return decodeUtf16(payload.slice(2), false).trim();
    return decodeUtf16(payload, false).trim();
  }
  if (encoding === 2) return decodeUtf16(payload, false).trim();

  return new TextDecoder("utf-8").decode(payload).replace(/\0+$/g, "").trim();
}

async function readAudioMetadata(file) {
  const headerBuffer = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();
  const bytes = new Uint8Array(headerBuffer);
  const tags = {};

  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return tags;

  const majorVersion = bytes[3];
  const tagSize = synchsafeToInt(bytes.slice(6, 10));
  let offset = 10;
  const end = Math.min(bytes.length, 10 + tagSize);

  while (offset + 10 <= end) {
    const frameId = new TextDecoder("latin1").decode(bytes.slice(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;
    const frameSize = readUint32(bytes.slice(offset + 4, offset + 8), majorVersion === 4);
    if (!frameSize) break;
    const frameStart = offset + 10;
    const frameEnd = Math.min(frameStart + frameSize, end);
    const frameData = bytes.slice(frameStart, frameEnd);

    if (frameId === "TPE1") tags.artist = decodeId3Text(frameData);
    if (frameId === "TIT2") tags.title = decodeId3Text(frameData);
    if (frameId === "TALB") tags.album = decodeId3Text(frameData);

    offset = frameEnd;
  }

  return tags;
}

async function autofillCreditFromAudio(file) {
  if (!file || (!creditWasAutoFilled && creditText.value.trim())) return;

  try {
    const metadata = await readAudioMetadata(file);
    const fallbackName = file.name.replace(/\.[^/.]+$/, "");
    let text = "";

    if (metadata.artist && metadata.title) {
      text = `Music: ${metadata.title} by ${metadata.artist}`;
    } else if (metadata.artist) {
      text = `Music: ${metadata.artist}`;
    } else if (metadata.title) {
      text = `Music: ${metadata.title}`;
    } else {
      text = `Music: ${fallbackName}`;
    }

    creditText.value = text;
    creditWasAutoFilled = true;
    restartPreview();
  } catch (error) {
    console.warn("Could not read audio metadata", error);
    creditText.value = `Music: ${file.name.replace(/\.[^/.]+$/, "")}`;
    creditWasAutoFilled = true;
    restartPreview();
  }
}

function tintAlpha() {
  return clamp(Number(tintStrength.value) || 0, 0, 100) / 100;
}

function wallpaperConfig() {
  return {
    shapes: wallpaperShapes.value,
    scheme: wallpaperScheme.value,
    spacing: Number(wallpaperSpacing.value),
    seed: wallpaperSeed,
  };
}

function setCanvasFormat() {
  const format = formatInput.value;
  const sizes = {
    landscape: [1280, 720],
    square: [1080, 1080],
    vertical: [1080, 1920],
  };
  const [width, height] = sizes[format];
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function loadImage(file) {
  if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
  state.usingWallpaper = false;
  backgroundImage = new Image();
  backgroundUrl = URL.createObjectURL(file);
  backgroundImage.src = backgroundUrl;
  backgroundImage.onload = drawFrame;
  backgroundImage.onerror = () => {
    backgroundImage = null;
    status.textContent = "That image could not be loaded.";
    drawFrame();
  };
}

function seededUnit(seed, x, y, salt = 0) {
  const value = Math.sin(seed * 12.9898 + x * 78.233 + y * 37.719 + salt * 19.19) * 43758.5453;
  return value - Math.floor(value);
}

function drawPolygon(target, x, y, radius, sides, rotation) {
  target.beginPath();
  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (Math.PI * 2 * index) / sides;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) {
      target.moveTo(px, py);
    } else {
      target.lineTo(px, py);
    }
  }
  target.closePath();
}

function wallpaperPalette(name) {
  const palettes = {
    midnight: {
      bg: ["#02030a", "#07111f", "#220b33"],
      shape: ["#fff8d7", "#ffe15a", "#36c8ff", "#ff4f7b"],
    },
    pool: {
      bg: ["#00150f", "#013f35", "#06294f"],
      shape: ["#eafff8", "#42ffb0", "#ffdd4a", "#ff6f59"],
    },
    candy: {
      bg: ["#19001f", "#3a0066", "#001b54"],
      shape: ["#ff4fd8", "#00e5ff", "#fff35c", "#6dff8b"],
    },
    paper: {
      bg: ["#241a09", "#7a5b21", "#f2d778"],
      shape: ["#17100a", "#fff7d6", "#0f6f78", "#d12626"],
    },
    mono: {
      bg: ["#000000", "#121212", "#303030"],
      shape: ["#ffffff", "#d0d0d0", "#8c8c8c", "#f2f2f2"],
    },
    arcade: {
      bg: ["#090018", "#1b0045", "#00143f"],
      shape: ["#ff2bd6", "#00ffea", "#faff00", "#ff6b00"],
    },
    warning: {
      bg: ["#080600", "#1f1600", "#453000"],
      shape: ["#ffd400", "#111111", "#ff5a00", "#fff5b5"],
    },
    citrus: {
      bg: ["#102000", "#2f7d00", "#f7db00"],
      shape: ["#ffffff", "#ff4d00", "#00e676", "#111111"],
    },
    broadcast: {
      bg: ["#050505", "#1c1c1c", "#050505"],
      shape: ["#ffffff", "#ff003c", "#00f0ff", "#ffe600"],
    },
    miami: {
      bg: ["#090022", "#24115e", "#ff3f81"],
      shape: ["#00f5ff", "#ffef5a", "#ff7ad9", "#ffffff"],
    },
    mint: {
      bg: ["#001f24", "#005d55", "#d8ff4f"],
      shape: ["#f8fff2", "#00ff94", "#ff2e63", "#173bff"],
    },
    ruby: {
      bg: ["#100006", "#3a0014", "#7f001f"],
      shape: ["#ffccd5", "#ff1744", "#ffb000", "#ffffff"],
    },
    blueprint: {
      bg: ["#00152e", "#003e7a", "#006dc1"],
      shape: ["#ffffff", "#7bd8ff", "#ffec8b", "#00152e"],
    },
  };
  return palettes[name] || palettes.midnight;
}

function drawWallpaperShape(target, shape, x, y, size, rotation) {
  if (shape === "circles") {
    target.beginPath();
    target.arc(x, y, size * 0.44, 0, Math.PI * 2);
    target.fill();
    return;
  }

  if (shape === "diamonds") {
    drawPolygon(target, x, y, size * 0.5, 4, rotation + Math.PI / 4);
    target.fill();
    return;
  }

  if (shape === "triangles") {
    drawPolygon(target, x, y, size * 0.56, 3, rotation - Math.PI / 2);
    target.fill();
    return;
  }

  if (shape === "lines") {
    target.save();
    target.translate(x, y);
    target.rotate(rotation);
    target.lineWidth = Math.max(2, size * 0.09);
    target.lineCap = "round";
    target.beginPath();
    target.moveTo(-size * 0.48, 0);
    target.lineTo(size * 0.48, 0);
    target.stroke();
    target.restore();
    return;
  }

  drawPolygon(target, x, y, size * 0.46, 6, rotation);
  target.fill();
}

function drawStripePattern(target, width, height, time, config, palette) {
  const spacing = config.spacing;
  const diagonal = Math.hypot(width, height);
  target.save();
  target.translate(width / 2, height / 2);
  target.rotate(-Math.PI / 8);
  target.globalAlpha = 0.86;
  for (let x = -diagonal; x < diagonal; x += spacing) {
    const color = palette.shape[Math.abs(Math.floor(x / spacing)) % palette.shape.length];
    target.fillStyle = color;
    target.fillRect(x + (time * 18) % spacing, -diagonal, spacing * 0.48, diagonal * 2);
  }
  target.restore();
}

function drawPolkaPattern(target, width, height, time, config, palette) {
  const spacing = config.spacing;
  target.save();
  target.globalCompositeOperation = "screen";
  for (let y = -spacing; y < height + spacing; y += spacing) {
    for (let x = -spacing; x < width + spacing; x += spacing) {
      const cellX = Math.round(x / spacing);
      const cellY = Math.round(y / spacing);
      const radius = spacing * (0.22 + seededUnit(config.seed, cellX, cellY, 4) * 0.12);
      const offset = (cellY % 2) * spacing * 0.5;
      const pulse = Math.sin(time + cellX * 0.7 + cellY) * spacing * 0.025;
      target.globalAlpha = 0.72;
      target.fillStyle = palette.shape[Math.abs(cellX + cellY) % palette.shape.length];
      target.beginPath();
      target.arc(x + offset, y + pulse, radius, 0, Math.PI * 2);
      target.fill();
    }
  }
  target.restore();
}

function drawPlaidPattern(target, width, height, time, config, palette, tartan = false) {
  const spacing = config.spacing;
  const bands = tartan
    ? [0.14, 0.24, 0.05, 0.42, 0.07]
    : [0.18, 0.34, 0.1];

  target.save();
  target.globalCompositeOperation = "screen";
  bands.forEach((band, index) => {
    const step = spacing * (index + 1.05);
    const size = Math.max(3, spacing * band);
    target.fillStyle = palette.shape[index % palette.shape.length];
    target.globalAlpha = tartan ? 0.48 : 0.36;
    for (let x = -step; x < width + step; x += step) {
      target.fillRect(x + (time * 4) % step, 0, size, height);
    }
    for (let y = -step; y < height + step; y += step) {
      target.fillRect(0, y - (time * 3) % step, width, size);
    }
  });
  target.restore();
}

function drawArgylePattern(target, width, height, time, config, palette) {
  const spacing = config.spacing;
  target.save();
  target.globalCompositeOperation = "screen";
  for (let y = -spacing; y < height + spacing * 2; y += spacing * 0.9) {
    for (let x = -spacing; x < width + spacing * 2; x += spacing) {
      const cellX = Math.round(x / spacing);
      const cellY = Math.round(y / spacing);
      const cx = x + (cellY % 2) * spacing * 0.5;
      const cy = y + Math.sin(time * 0.35 + cellX) * spacing * 0.04;
      target.globalAlpha = 0.58;
      target.fillStyle = palette.shape[Math.abs(cellX + cellY) % palette.shape.length];
      drawPolygon(target, cx, cy, spacing * 0.46, 4, Math.PI / 4);
      target.fill();
    }
  }

  target.globalAlpha = 0.52;
  target.strokeStyle = palette.shape[0];
  target.lineWidth = Math.max(1, spacing * 0.035);
  for (let x = -width; x < width * 2; x += spacing) {
    target.beginPath();
    target.moveTo(x, -spacing);
    target.lineTo(x + height, height + spacing);
    target.stroke();
    target.beginPath();
    target.moveTo(x, height + spacing);
    target.lineTo(x + height, -spacing);
    target.stroke();
  }
  target.restore();
}

function drawMondrianPattern(target, width, height, time, config, palette) {
  const spacing = config.spacing;
  const lineWidth = Math.max(7, spacing * 0.11);
  target.save();
  target.globalAlpha = 0.96;
  target.fillStyle = palette.bg[0];
  target.fillRect(0, 0, width, height);

  let y = 0;
  let row = 0;
  while (y < height) {
    const rowHeight = spacing * (0.8 + seededUnit(config.seed, row, 0, 1) * 1.5);
    let x = 0;
    let col = 0;
    while (x < width) {
      const colWidth = spacing * (0.8 + seededUnit(config.seed, col, row, 2) * 1.8);
      const colorRoll = seededUnit(config.seed, col, row, 3);
      target.fillStyle = colorRoll < 0.28 ? palette.shape[Math.floor(colorRoll * palette.shape.length * 3) % palette.shape.length] : "#f6f1df";
      target.fillRect(x, y, colWidth, rowHeight);
      x += colWidth;
      col += 1;
    }
    y += rowHeight;
    row += 1;
  }

  target.strokeStyle = "#090909";
  target.lineWidth = lineWidth;
  target.strokeRect(-lineWidth / 2, -lineWidth / 2, width + lineWidth, height + lineWidth);
  for (let x = spacing; x < width; x += spacing * (1.1 + seededUnit(config.seed, x, 0, 4))) {
    target.beginPath();
    target.moveTo(x + Math.sin(time * 0.2) * 2, 0);
    target.lineTo(x, height);
    target.stroke();
  }
  for (let yLine = spacing; yLine < height; yLine += spacing * (1.1 + seededUnit(config.seed, 0, yLine, 5))) {
    target.beginPath();
    target.moveTo(0, yLine);
    target.lineTo(width, yLine + Math.cos(time * 0.2) * 2);
    target.stroke();
  }
  target.restore();
}

function drawCheckerboardPattern(target, width, height, time, config, palette) {
  const spacing = config.spacing * 0.72;
  target.save();
  for (let y = 0; y < height + spacing; y += spacing) {
    for (let x = 0; x < width + spacing; x += spacing) {
      const index = (Math.floor(x / spacing) + Math.floor(y / spacing)) % 2;
      target.globalAlpha = 0.78;
      target.fillStyle = index ? palette.shape[0] : palette.shape[2 % palette.shape.length];
      target.fillRect(x + Math.sin(time * 0.25) * 3, y, spacing, spacing);
    }
  }
  target.restore();
}

function drawTerrazzoPattern(target, width, height, time, config, palette) {
  const spacing = config.spacing;
  target.save();
  target.globalCompositeOperation = "screen";
  for (let y = -spacing; y < height + spacing; y += spacing * 0.55) {
    for (let x = -spacing; x < width + spacing; x += spacing * 0.55) {
      const cellX = Math.round(x / spacing);
      const cellY = Math.round(y / spacing);
      if (seededUnit(config.seed, cellX, cellY, 1) < 0.34) continue;
      const sides = 3 + Math.floor(seededUnit(config.seed, cellX, cellY, 2) * 4);
      const size = spacing * (0.12 + seededUnit(config.seed, cellX, cellY, 3) * 0.18);
      target.globalAlpha = 0.62;
      target.fillStyle = palette.shape[Math.floor(seededUnit(config.seed, cellX, cellY, 4) * palette.shape.length)];
      drawPolygon(target, x, y + Math.sin(time * 0.4 + cellX) * 2, size, sides, seededUnit(config.seed, cellX, cellY, 5) * Math.PI);
      target.fill();
    }
  }
  target.restore();
}

function drawStarburstPattern(target, width, height, time, config, palette) {
  const rays = Math.max(18, Math.floor(360 / Math.max(8, config.spacing * 0.22)));
  const radius = Math.hypot(width, height);
  const cx = width * (0.5 + Math.sin(config.seed) * 0.08);
  const cy = height * (0.5 + Math.cos(config.seed) * 0.08);
  target.save();
  target.globalAlpha = 0.82;
  for (let index = 0; index < rays; index += 1) {
    const angle = (Math.PI * 2 * index) / rays + time * 0.02;
    target.fillStyle = palette.shape[index % palette.shape.length];
    target.beginPath();
    target.moveTo(cx, cy);
    target.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    target.lineTo(cx + Math.cos(angle + Math.PI / rays) * radius, cy + Math.sin(angle + Math.PI / rays) * radius);
    target.closePath();
    target.fill();
  }
  target.restore();
}

function drawMemphisPattern(target, width, height, time, config, palette) {
  drawPolkaPattern(target, width, height, time, config, palette);
  target.save();
  target.globalCompositeOperation = "screen";
  target.globalAlpha = 0.78;
  for (let y = -config.spacing; y < height + config.spacing; y += config.spacing * 1.25) {
    for (let x = -config.spacing; x < width + config.spacing; x += config.spacing * 1.25) {
      const cellX = Math.round(x / config.spacing);
      const cellY = Math.round(y / config.spacing);
      const shape = ["triangles", "lines", "diamonds"][Math.floor(seededUnit(config.seed, cellX, cellY, 9) * 3)];
      target.fillStyle = palette.shape[Math.floor(seededUnit(config.seed, cellX, cellY, 10) * palette.shape.length)];
      target.strokeStyle = target.fillStyle;
      drawWallpaperShape(target, shape, x, y, config.spacing * 0.5, seededUnit(config.seed, cellX, cellY, 11) * Math.PI);
    }
  }
  target.restore();
}

function drawFullCanvasPattern(target, width, height, time, config, palette) {
  if (config.shapes === "stripes") drawStripePattern(target, width, height, time, config, palette);
  if (config.shapes === "polka") drawPolkaPattern(target, width, height, time, config, palette);
  if (config.shapes === "plaid") drawPlaidPattern(target, width, height, time, config, palette);
  if (config.shapes === "tartan") drawPlaidPattern(target, width, height, time, config, palette, true);
  if (config.shapes === "argyle") drawArgylePattern(target, width, height, time, config, palette);
  if (config.shapes === "mondrian") drawMondrianPattern(target, width, height, time, config, palette);
  if (config.shapes === "checkerboard") drawCheckerboardPattern(target, width, height, time, config, palette);
  if (config.shapes === "terrazzo") drawTerrazzoPattern(target, width, height, time, config, palette);
  if (config.shapes === "memphis") drawMemphisPattern(target, width, height, time, config, palette);
  if (config.shapes === "starburst") drawStarburstPattern(target, width, height, time, config, palette);
}

function drawWallpaperBackground(target, width, height, time, config) {
  const palette = wallpaperPalette(config.scheme);
  const gradient = target.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.bg[0]);
  gradient.addColorStop(0.55, palette.bg[1]);
  gradient.addColorStop(1, palette.bg[2]);
  target.fillStyle = gradient;
  target.fillRect(0, 0, width, height);

  const fullPatternModes = ["stripes", "polka", "plaid", "tartan", "argyle", "mondrian", "checkerboard", "terrazzo", "memphis", "starburst"];
  if (fullPatternModes.includes(config.shapes)) {
    drawFullCanvasPattern(target, width, height, time, config, palette);
    return;
  }

  const spacing = config.spacing;
  const diagonal = Math.hypot(width, height);
  const parallax = time * spacing * 0.08;
  const startX = -spacing * 2;
  const startY = -spacing * 2;
  const endX = width + spacing * 2;
  const endY = height + spacing * 2;
  const shapeChoices = config.shapes === "mixed" ? ["circles", "diamonds", "triangles", "lines"] : [config.shapes];

  target.save();
  target.globalCompositeOperation = "screen";
  for (let y = startY; y < endY; y += spacing) {
    for (let x = startX; x < endX; x += spacing) {
      const cellX = Math.round(x / spacing);
      const cellY = Math.round(y / spacing);
      const jitterX = (seededUnit(config.seed, cellX, cellY, 1) - 0.5) * spacing * 0.46;
      const jitterY = (seededUnit(config.seed, cellX, cellY, 2) - 0.5) * spacing * 0.46;
      const pulse = Math.sin(time * 0.9 + seededUnit(config.seed, cellX, cellY, 3) * Math.PI * 2) * spacing * 0.05;
      const drawX = x + jitterX + Math.sin(time * 0.18 + cellY) * spacing * 0.08;
      const drawY = y + jitterY + parallax;
      const wrappedY = ((drawY + spacing * 2) % (height + spacing * 4)) - spacing * 2;
      const size = spacing * (0.34 + seededUnit(config.seed, cellX, cellY, 4) * 0.42) + pulse;
      const colorIndex = Math.floor(seededUnit(config.seed, cellX, cellY, 5) * palette.shape.length);
      const alpha = 0.3 + seededUnit(config.seed, cellX, cellY, 6) * 0.42;
      const shapeIndex = Math.floor(seededUnit(config.seed, cellX, cellY, 7) * shapeChoices.length);
      const rotation = seededUnit(config.seed, cellX, cellY, 8) * Math.PI * 2 + time * 0.08;

      target.fillStyle = palette.shape[colorIndex];
      target.strokeStyle = palette.shape[colorIndex];
      target.globalAlpha = alpha;
      drawWallpaperShape(target, shapeChoices[shapeIndex], drawX, wrappedY, size, rotation);
    }
  }
  target.restore();

  target.save();
  target.globalAlpha = 0.08;
  target.strokeStyle = palette.shape[1];
  target.lineWidth = Math.max(1, diagonal / 900);
  const stripeGap = spacing * 1.35;
  for (let offset = -diagonal; offset < diagonal; offset += stripeGap) {
    target.beginPath();
    target.moveTo(offset + time * 10, 0);
    target.lineTo(offset + width * 0.4 + time * 10, height);
    target.stroke();
  }
  target.restore();
}

function renderWallpaperPreview() {
  drawWallpaperBackground(wallpaperPreviewCtx, wallpaperPreview.width, wallpaperPreview.height, 0.8, wallpaperConfig());
}

function drawCoverImage(image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawFallbackBackground(width, height, time) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#080808");
  gradient.addColorStop(0.52, "#15191f");
  gradient.addColorStop(1, "#2a2316");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  const gap = Math.max(38, width / 24);
  const offset = (time * 18) % gap;
  for (let x = -gap; x < width + gap; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x - width * 0.2 + offset, height);
    ctx.stroke();
  }
  ctx.restore();
}

function wrapText(text, maxWidth, font) {
  ctx.font = font;
  const rawLines = text.split(/\n/);
  const lines = [];

  function pushWord(line, word) {
    if (ctx.measureText(word).width <= maxWidth) {
      return word;
    }

    let chunk = "";
    for (const char of word) {
      const test = chunk + char;
      if (ctx.measureText(test).width > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = test;
      }
    }
    return chunk;
  }

  rawLines.forEach((rawLine) => {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }

    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = line ? test : pushWord(line, word);
      } else {
        lines.push(line);
        line = pushWord("", word);
      }
    });
    lines.push(line);
  });
  return lines.slice(0, 12);
}

function drawTextBlock(width, height, time) {
  const text = activeText(time);
  const fontSize = Number(fontSizeInput.value);
  const lineHeight = fontSize * 1.28;
  const pad = Math.round(Math.min(width, height) * 0.075);
  const font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  const textWidth = Math.min(width - pad * 2, Math.round(width * 0.62), fontSize * 16);
  const lines = wrapText(text, textWidth, font);
  const blockHeight = lines.length * lineHeight;
  const placement = selectedPlacement();
  const alignment = selectedAlignment();
  const tone = toneInput.value;
  const drift = Math.sin(time * 0.9) * 3;
  const textXByAlignment = {
    left: pad,
    center: width / 2,
    right: width - pad,
  };
  const cardXByAlignment = {
    left: pad,
    center: width / 2 - textWidth / 2,
    right: width - pad - textWidth,
  };
  const textX = textXByAlignment[alignment];
  const cardX = cardXByAlignment[alignment];

  let y = height / 2 - blockHeight / 2;
  if (placement === "top") y = pad;
  if (placement === "bottom") y = height - pad - blockHeight;

  if (tone === "classic") {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${tintAlpha()})`;
    ctx.fillRect(-2, -2, width + 4, height + 4);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(0, drift);

  if (tone === "caption") {
    const cardPad = fontSize * 0.72;
    ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
    ctx.fillRect(cardX - cardPad, y - cardPad * 0.7, textWidth + cardPad * 2, blockHeight + cardPad * 1.25);
  }

  ctx.font = font;
  ctx.textAlign = alignment;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#f4f0e8";
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = tone === "classic" ? 0 : 14;
  ctx.shadowOffsetY = tone === "classic" ? 0 : 3;

  lines.forEach((line, index) => {
    ctx.fillText(line, textX, y + index * lineHeight);
  });

  ctx.restore();
}

function drawCreditBlock(width, height) {
  const text = creditText.value.trim();
  if (!text) return;

  const size = Number(creditSize.value);
  const pad = Math.round(Math.min(width, height) * 0.04);
  const maxWidth = Math.min(width * 0.42, size * 28);
  const lines = wrapText(text, maxWidth, `700 ${size}px ${creditFont.value}`);
  const lineHeight = size * 1.26;
  const blockHeight = lines.length * lineHeight;
  const position = creditPosition.value;
  const [vertical, horizontal = "center"] = position.split("-");

  const align = horizontal === "left" ? "left" : horizontal === "right" ? "right" : "center";
  const xByAlign = {
    left: pad,
    center: width / 2,
    right: width - pad,
  };
  const yByPosition = {
    top: pad,
    center: height / 2 - blockHeight / 2,
    bottom: height - pad - blockHeight,
  };

  ctx.save();
  ctx.font = `700 ${size}px ${creditFont.value}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(244, 240, 232, 0.88)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = Math.max(6, size * 0.45);
  ctx.shadowOffsetY = Math.max(1, size * 0.12);

  lines.forEach((line, index) => {
    ctx.fillText(line, xByAlign[align], yByPosition[vertical] + index * lineHeight);
  });

  ctx.restore();
}

function drawFrame(time = 0) {
  setCanvasFormat();
  const width = canvas.width;
  const height = canvas.height;
  const tone = toneInput.value;

  ctx.clearRect(0, 0, width, height);
  if (state.usingWallpaper) {
    drawWallpaperBackground(ctx, width, height, time, wallpaperConfig());
  } else if (backgroundImage && backgroundImage.complete && backgroundImage.naturalWidth) {
    drawCoverImage(backgroundImage, 0, 0, width, height);
  } else {
    drawFallbackBackground(width, height, time);
  }

  if (tone === "washed") {
    ctx.fillStyle = "rgba(244, 240, 232, 0.34)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    ctx.fillRect(0, 0, width, height);
  }

  const vignette = ctx.createRadialGradient(width / 2, height / 2, width * 0.25, width / 2, height / 2, width * 0.72);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  drawTextBlock(width, height, time);
  drawCreditBlock(width, height);
}

function previewLoop(now) {
  if (!state.previewing) return;
  const duration = durationSeconds();
  const elapsed = ((now - previewStart) / 1000) % duration;
  drawFrame(elapsed);
  timeLabel.textContent = `${elapsed.toFixed(1)}s`;
  durationLabel.textContent = `${duration.toFixed(1)}s`;
  progress.style.width = `${(elapsed / duration) * 100}%`;
  animationId = requestAnimationFrame(previewLoop);
}

function restartPreview() {
  stage.classList.remove("hide");
  outputVideo.classList.add("hide");
  state.previewing = true;
  previewStart = performance.now();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(previewLoop);
}

function keepOutputPreviewLive() {
  stage.classList.add("hide");
  outputVideo.classList.remove("hide");
  state.previewing = true;
  previewStart = performance.now();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(previewLoop);
}

function bestMimeType() {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function renderVideo() {
  if (!window.MediaRecorder || !canvas.captureStream) {
    status.textContent = "This browser cannot export video from canvas.";
    return;
  }

  state.rendering = true;
  state.previewing = false;
  renderBtn.disabled = true;
  previewBtn.disabled = true;
  downloadLink.setAttribute("aria-disabled", "true");
  stage.classList.remove("hide");
  outputVideo.classList.add("hide");
  status.textContent = "Generating...";
  cancelAnimationFrame(animationId);

  const duration = durationSeconds();
  const fps = 30;
  const stream = canvas.captureStream(fps);
  let audioContext = null;
  let audioElement = null;
  let audioUrl = "";
  let generatedVideo = false;

  try {
    if (songInput.files[0]) {
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      audioElement = new Audio(URL.createObjectURL(songInput.files[0]));
      audioElement.crossOrigin = "anonymous";
      audioElement.loop = true;
      audioElement.volume = 0.82;
      audioUrl = audioElement.src;
      const source = audioContext.createMediaElementSource(audioElement);
      const gain = audioContext.createGain();
      gain.gain.value = 0.9;
      source.connect(gain).connect(destination);
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      await audioContext.resume();
    }

    const mimeType = bestMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    const done = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    drawFrame(0);
    timeLabel.textContent = "0.0s";
    durationLabel.textContent = `${duration.toFixed(1)}s`;
    progress.style.width = "0%";

    recorder.start();
    if (audioElement) await audioElement.play();

    const started = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const elapsed = Math.min((now - started) / 1000, duration);
        drawFrame(elapsed);
        timeLabel.textContent = `${elapsed.toFixed(1)}s`;
        durationLabel.textContent = `${duration.toFixed(1)}s`;
        progress.style.width = `${(elapsed / duration) * 100}%`;
        if (elapsed < duration) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });

    recorder.stop();
    await done;
    stream.getTracks().forEach((track) => track.stop());
    if (audioElement) {
      audioElement.pause();
      URL.revokeObjectURL(audioUrl);
    }
    if (audioContext) await audioContext.close();

    const blob = new Blob(chunks, { type: mimeType || "video/webm" });
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = URL.createObjectURL(blob);
    outputVideo.src = outputUrl;
    stage.classList.add("hide");
    outputVideo.classList.remove("hide");
    downloadLink.href = outputUrl;
    downloadLink.download = `bump-${Date.now()}.webm`;
    downloadLink.removeAttribute("aria-disabled");
    status.textContent = "Video ready.";
    generatedVideo = true;
  } catch (error) {
    console.error(error);
    status.textContent = "Export failed. Try a shorter clip or different audio file.";
    if (audioElement) audioElement.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (audioContext && audioContext.state !== "closed") await audioContext.close();
    stream.getTracks().forEach((track) => track.stop());
  } finally {
    state.rendering = false;
    renderBtn.disabled = false;
    previewBtn.disabled = false;
    if (generatedVideo) {
      keepOutputPreviewLive();
    } else {
      restartPreview();
    }
  }
}

function updateLineRemoveButtons() {
  const rows = [...textLines.querySelectorAll(".text-line")];
  rows.forEach((row) => {
    const button = row.querySelector(".remove-line");
    button.disabled = rows.length === 1;
  });
}

function bindTextLine(row) {
  const input = row.querySelector(".line-input");
  const removeButton = row.querySelector(".remove-line");

  input.addEventListener("input", restartPreview);
  removeButton.addEventListener("click", () => {
    const rows = [...textLines.querySelectorAll(".text-line")];
    if (rows.length === 1) {
      input.value = "";
    } else {
      row.remove();
    }
    updateLineLabels();
    restartPreview();
  });
}

function updateLineLabels() {
  [...textLines.querySelectorAll(".text-line")].forEach((row, index) => {
    row.querySelector(".line-input").setAttribute("aria-label", `Text line ${index + 1}`);
  });
  updateLineRemoveButtons();
}

function addTextLine(value = "") {
  const row = document.createElement("div");
  row.className = "text-line";
  row.innerHTML = `
    <input class="line-input" type="text" value="" aria-label="Text line">
    <button class="icon-button remove-line" type="button" aria-label="Remove line" title="Remove line">x</button>
  `;
  row.querySelector(".line-input").value = value;
  textLines.append(row);
  bindTextLine(row);
  updateLineLabels();
  row.querySelector(".line-input").focus();
  restartPreview();
}

imageInput.addEventListener("change", () => {
  if (imageInput.files[0]) loadImage(imageInput.files[0]);
});

songInput.addEventListener("change", () => {
  if (songInput.files[0]) autofillCreditFromAudio(songInput.files[0]);
});

wallpaperSpacing.addEventListener("input", () => {
  wallpaperSpacingValue.textContent = wallpaperSpacing.value;
  renderWallpaperPreview();
  if (state.usingWallpaper) restartPreview();
});

[wallpaperShapes, wallpaperScheme].forEach((input) => {
  input.addEventListener("input", () => {
    renderWallpaperPreview();
    if (state.usingWallpaper) restartPreview();
  });
});

randomizeWallpaperBtn.addEventListener("click", () => {
  wallpaperSeed = Math.floor(Math.random() * 100000);
  renderWallpaperPreview();
  if (state.usingWallpaper) restartPreview();
});

useWallpaperBtn.addEventListener("click", () => {
  state.usingWallpaper = true;
  status.textContent = "Using generated wallpaper.";
  restartPreview();
});

fontSizeInput.addEventListener("input", () => {
  fontSizeValue.textContent = fontSizeInput.value;
  drawFrame();
});

tintStrength.addEventListener("input", () => {
  tintStrengthValue.textContent = `${tintStrength.value}%`;
  drawFrame();
});

secondsPerLineInput.addEventListener("input", () => {
  secondsPerLineValue.textContent = `${secondsPerLineInput.value}s`;
});

creditText.addEventListener("input", () => {
  creditWasAutoFilled = false;
  restartPreview();
});

creditSize.addEventListener("input", () => {
  creditSizeValue.textContent = creditSize.value;
  drawFrame();
});

addLineBtn.addEventListener("click", () => addTextLine());

[...textLines.querySelectorAll(".text-line")].forEach(bindTextLine);
updateLineLabels();

[secondsPerLineInput, formatInput, toneInput, tintStrength, creditPosition, creditFont, creditSize, ...document.querySelectorAll("input[name='placement'], input[name='alignment']")]
  .forEach((input) => input.addEventListener("input", restartPreview));

previewBtn.addEventListener("click", restartPreview);
renderBtn.addEventListener("click", renderVideo);

durationLabel.textContent = `${durationSeconds().toFixed(1)}s`;
renderWallpaperPreview();
restartPreview();
