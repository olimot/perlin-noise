import { vec3 } from "gl-matrix";
import { addCameraControl, createMarchingCubesProgram, initGL2 } from "./gl";
import { noise1, noise2, noise3, noise4 } from "./noise";

function drawNoise1D() {
  const canvas = document.getElementById("noise1d") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const offset = Math.random();
  const scale = 0.05678;
  let p = noise1(offset);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.moveTo(0, canvas.height * p);
  ctx.beginPath();
  for (let i = 1; i < canvas.width; i++) {
    const nextP = noise1(offset + i * scale);
    ctx.lineTo(i, (canvas.height * (nextP + 1)) / 2);
    p = nextP;
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "white";
  ctx.stroke();
}

function drawNoise2D() {
  const canvas = document.getElementById("noise2d") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const xOffset = Math.random();
  const yOffset = Math.random();
  const scale = 0.05678;
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < canvas.height; i++) {
    for (let j = 0; j < canvas.width; j++) {
      const value = noise2(xOffset + j * scale, yOffset + i * scale);
      const p = 255 * ((value + 1) / 2);
      const color = [p, p, p, 255];
      imageData.data.set(color, i * canvas.width * 4 + j * 4);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function drawNoise3D() {
  const field = {
    width: 128,
    height: 128,
    depth: 128,
    src: new Uint8Array(128 * 128 * 128),
  };
  const xOffset = Math.random();
  const yOffset = Math.random();
  const zOffset = Math.random();
  const scale = 0.05678;
  for (let z = 1; z < field.depth - 1; z++) {
    for (let y = 1; y < field.height - 1; y++) {
      for (let x = 1; x < field.width - 1; x++) {
        const value = noise3(
          xOffset + x * scale,
          yOffset + y * scale,
          zOffset + z * scale,
        );
        const idx = z * field.width * field.height + y * field.width + x;
        field.src[idx] = 255 * ((value + 1) / 2);
      }
    }
  }

  const canvas = document.getElementById("noise3d") as HTMLCanvasElement;
  const camera = addCameraControl(canvas);
  vec3.set(camera.eye, 216, 216, 216);
  vec3.set(camera.target, 64, 64, 64);

  const gl = initGL2(canvas);
  const { uLoc } = createMarchingCubesProgram(gl, field);

  requestAnimationFrame(function frame() {
    camera.updateMatrices();

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniform1f(uLoc.isolevel, 128);
    gl.uniformMatrix4fv(uLoc.viewProjection, false, camera.viewProjection);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    const cnt = (field.width - 1) * (field.height - 1) * (field.depth - 1) * 15;
    gl.drawArrays(gl.TRIANGLES, 0, cnt);

    requestAnimationFrame(frame);
  });
}

function drawNoise4D() {
  const field = {
    width: 32,
    height: 32,
    depth: 32,
    src: new Uint8Array(32 * 32 * 32),
  };
  const xOffset = Math.random();
  const yOffset = Math.random();
  const zOffset = Math.random();
  const wOffset = Math.random();
  const scale = 0.1234;

  const canvas = document.getElementById("noise4d") as HTMLCanvasElement;

  const camera = addCameraControl(canvas);
  vec3.set(camera.eye, 64, 64, 64);
  vec3.set(camera.target, 16, 16, 16);

  const gl = initGL2(canvas);
  const { uLoc, fieldTexture } = createMarchingCubesProgram(gl, field);

  requestAnimationFrame(function frame(time) {
    for (let z = 1; z < field.depth - 1; z++) {
      for (let y = 1; y < field.height - 1; y++) {
        for (let x = 1; x < field.width - 1; x++) {
          const value = noise4(
            xOffset + x * scale,
            yOffset + y * scale,
            zOffset + z * scale,
            wOffset + (time / 100) * scale,
          );
          const idx = z * field.width * field.height + y * field.width + x;
          field.src[idx] = 255 * ((value + 1) / 2);
        }
      }
    }

    const target = gl.TEXTURE_3D;
    const type = gl.UNSIGNED_BYTE;
    const { width: w, height: h, depth: d, src } = field;
    gl.bindTexture(target, fieldTexture);
    gl.texImage3D(target, 0, gl.R8UI, w, h, d, 0, gl.RED_INTEGER, type, src);

    camera.updateMatrices();

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniform1f(uLoc.isolevel, 128);
    gl.uniformMatrix4fv(uLoc.viewProjection, false, camera.viewProjection);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    const cnt = (field.width - 1) * (field.height - 1) * (field.depth - 1) * 15;
    gl.drawArrays(gl.TRIANGLES, 0, cnt);
    requestAnimationFrame(frame);
  });
}

drawNoise1D();
drawNoise2D();
drawNoise3D();
drawNoise4D();
export {};
