const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");
const stage = document.querySelector(".stage");
const bumpText = document.querySelector("#bumpText");
const imageInput = document.querySelector("#imageInput");
const songInput = document.querySelector("#songInput");
const durationInput = document.querySelector("#duration");
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

function durationSeconds() {
  return clamp(Number(durationInput.value) || 5, 2, 12);
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

function drawWallpaperBackground(target, width, height, time, config) {
  const palette = wallpaperPalette(config.scheme);
  const gradient = target.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, palette.bg[0]);
  gradient.addColorStop(0.55, palette.bg[1]);
  gradient.addColorStop(1, palette.bg[2]);
  target.fillStyle = gradient;
  target.fillRect(0, 0, width, height);

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
  const text = bumpText.value.trim() || " ";
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

imageInput.addEventListener("change", () => {
  if (imageInput.files[0]) loadImage(imageInput.files[0]);
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

[bumpText, durationInput, formatInput, toneInput, tintStrength, ...document.querySelectorAll("input[name='placement'], input[name='alignment']")]
  .forEach((input) => input.addEventListener("input", restartPreview));

previewBtn.addEventListener("click", restartPreview);
renderBtn.addEventListener("click", renderVideo);

durationLabel.textContent = `${durationSeconds().toFixed(1)}s`;
renderWallpaperPreview();
restartPreview();
