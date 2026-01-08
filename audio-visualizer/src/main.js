import { AudioEngine } from "./audio.js";
import { createGL } from "./gl.js";
import "./style.css";

const doc = document.getElementById("app")

const canvas = document.createElement("canvas");
canvas.id = "gl";
doc.appendChild(canvas);

const gl = createGL(canvas);
const audio = new AudioEngine();

const input = document.createElement("input");
input.id = "fileInput";
input.type = "file";
input.accept = "audio/*";
input.style.display = "none";
doc.appendChild(input);

const label = document.createElement("label");
label.id = "fileLabel"
label.id = "fileLabel";
label.htmlFor = "fileInput";
label.textContent = "Select Audio";
doc.appendChild(label);

input.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await audio.initFromFile(file);
};

function loop() {
  audio.update();

  gl.clearColor(audio.low, audio.mid, audio.high, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  requestAnimationFrame(loop);
}

loop();

