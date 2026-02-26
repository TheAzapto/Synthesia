import vertSrc from "./shader.vert?raw";
import fragSrc from "./shader.frag?raw";
import "./style.css";

import { createGL, createFBO } from "./gl";
import { AudioEngine } from "./audio";

/* ═══════════════════════ DOM ═══════════════════════ */
const doc = document.getElementById("app");

// Landing
const landing = document.getElementById("landing");
const inputField = document.getElementById("file");

// Player
const player = document.getElementById("player");
const songNameEl = document.getElementById("song-name");
const btnPlay = document.getElementById("btn-play");
const btnStop = document.getElementById("btn-stop");
const btnFile = document.getElementById("btn-file");
const iconPlay = document.getElementById("icon-play");
const iconPause = document.getElementById("icon-pause");
const progressEl = document.getElementById("progress");
const volumeEl = document.getElementById("volume");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");

/* ═══════════════════════ AUDIO ═══════════════════════ */
const audioCtx = new AudioEngine();

async function loadAudio(file) {
  await audioCtx.initFromFile(file);

  // Update UI
  songNameEl.textContent = audioCtx.songName;
  timeTotal.textContent = formatTime(audioCtx.getDuration());
  progressEl.value = 0;

  // Show player, hide landing
  landing.classList.add("fade-out");
  player.classList.remove("hidden");

  updatePlayIcon();
}

/* ═══════════════════════ CONTROLS ═══════════════════════ */

// Play / Pause
btnPlay.addEventListener("click", () => {
  audioCtx.togglePlay();
  updatePlayIcon();
});

// Stop
btnStop.addEventListener("click", () => {
  audioCtx.stop();
  updatePlayIcon();
  progressEl.value = 0;
  timeCurrent.textContent = "0:00";
  updateSliderFill(progressEl, 0, 1000);
});

// Open new file (inside player)
btnFile.addEventListener("click", () => {
  inputField.click();
});

// File input
inputField.addEventListener("change", (e) => {
  if (e.target.files[0]) loadAudio(e.target.files[0]);
});

// Seek
let isSeeking = false;
progressEl.addEventListener("mousedown", () => (isSeeking = true));
progressEl.addEventListener("touchstart", () => (isSeeking = true), { passive: true });

progressEl.addEventListener("input", () => {
  if (!audioCtx.getDuration()) return;
  const seekTime = (progressEl.value / 1000) * audioCtx.getDuration();
  timeCurrent.textContent = formatTime(seekTime);
});

function finishSeek() {
  if (!isSeeking) return;
  isSeeking = false;
  if (!audioCtx.getDuration()) return;
  const seekTime = (progressEl.value / 1000) * audioCtx.getDuration();
  audioCtx.seek(seekTime);
  updatePlayIcon();
}
progressEl.addEventListener("mouseup", finishSeek);
progressEl.addEventListener("touchend", finishSeek);

// Volume
volumeEl.addEventListener("input", () => {
  const v = volumeEl.value / 100;
  audioCtx.setVolume(v);
  updateSliderFill(volumeEl, volumeEl.value, 100);
});

// Init volume display
audioCtx.setVolume && updateSliderFill(volumeEl, 80, 100);

/* ═══════════════════════ HELPERS ═══════════════════════ */

function updatePlayIcon() {
  const playing = audioCtx.isPlaying && !audioCtx.isPaused;
  iconPlay.style.display = playing ? "none" : "block";
  iconPause.style.display = playing ? "block" : "none";
}

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updateSliderFill(el, value, max) {
  const pct = (value / max) * 100;
  el.style.background = `linear-gradient(to right, rgba(0,240,255,0.7) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
}

/* ═══════════════════════ WEBGL ═══════════════════════ */
const canvas = document.createElement("canvas");
canvas.id = "gl-canvas";
doc.appendChild(canvas);

const { gl, program } = createGL(canvas, vertSrc, fragSrc);

const vertices = new Float32Array([
  -1, -1, 1, -1, -1, 1,
  -1, 1, 1, -1, 1, 1
]);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const posLoc = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

const uTime = gl.getUniformLocation(program, "u_time");
const uLow = gl.getUniformLocation(program, "u_low");
const uMid = gl.getUniformLocation(program, "u_mid");
const uHigh = gl.getUniformLocation(program, "u_high");
const uRes = gl.getUniformLocation(program, "u_resolution");
const uPrev = gl.getUniformLocation(program, "u_prev");

let bufferA = createFBO(gl, canvas.width, canvas.height);
let bufferB = createFBO(gl, canvas.width, canvas.height);

let front = bufferA;
let back = bufferB;

gl.bindFramebuffer(gl.FRAMEBUFFER, front.fbo);
gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

/* ═══════════════════════ RENDER LOOP ═══════════════════════ */
function loop(t) {
  audioCtx.update();

  // Update progress bar & time
  if (audioCtx.isPlaying && !isSeeking) {
    const cur = audioCtx.getCurrentTime();
    const dur = audioCtx.getDuration();
    if (dur > 0) {
      const pct = (cur / dur) * 1000;
      progressEl.value = pct;
      timeCurrent.textContent = formatTime(cur);
      updateSliderFill(progressEl, pct, 1000);
    }
  }

  // WebGL render
  gl.useProgram(program);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.uniform1f(uTime, t * 0.001);
  gl.uniform1f(uLow, audioCtx.low);
  gl.uniform1f(uMid, audioCtx.mid);
  gl.uniform1f(uHigh, audioCtx.high);
  gl.uniform2f(uRes, canvas.width, canvas.height);

  // Render into back buffer
  gl.bindFramebuffer(gl.FRAMEBUFFER, back.fbo);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, front.tex);
  gl.uniform1i(uPrev, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Render to screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, back.tex);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Swap
  [front, back] = [back, front];

  requestAnimationFrame(loop);
}

loop();
