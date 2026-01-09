import vertSrc from "./shader.vert?raw";
import fragSrc from "./shader.frag?raw";
import "./style.css";

import { createGL, createFBO } from "./gl";
import { AudioEngine } from "./audio";

const doc = document.getElementById("app");

/* ------------------ AUDIO ------------------ */
let audioCtx = new AudioEngine();
async function loadAudio(file) {
  await audioCtx.initFromFile(file);
}

/* ------------------ WEBGL ------------------ */
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


function loop(t) {
  audioCtx.update();

  gl.useProgram(program);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.uniform1f(uTime, t * 0.001);
  gl.uniform1f(uLow, audioCtx.low);
  gl.uniform1f(uMid, audioCtx.mid);
  gl.uniform1f(uHigh, audioCtx.high);
  gl.uniform2f(uRes, canvas.width, canvas.height);

  // --- render into back buffer ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, back.fbo);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, front.tex);
  gl.uniform1i(uPrev, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // --- render to screen ---
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, back.tex);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // swap
  [front, back] = [back, front];

  requestAnimationFrame(loop);
}

loop();

/* ------------------ FILE INPUT ------------------ */
const inputField = document.getElementById("file");
inputField.style.display = "none";
inputField.onchange = e => {
  if (e.target.files[0]) loadAudio(e.target.files[0]);
};
