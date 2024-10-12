import { mat4, vec3 } from "gl-matrix";
import { noise1, noise2, noise3, noise4 } from "./noise";
import { listenInputEvents } from "./input";
import { moveXY, pinchOrbit, rotateOrbit } from "./orbital";
import vertSrc from "./marching-cubes.vert?raw";
import triTableURL from "./u8-tri-table-256x16.bin?url";
import { up } from "./config";

const triTable = await fetch(triTableURL).then(async (res) => {
  return new Uint8Array(await res.arrayBuffer());
});

function drawNoise1D() {
  const canvas = document.getElementById("noise1d") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const offset = Math.random();
  const scale = 0.05678;
  let p = noise1(offset);
  ctx.moveTo(0, canvas.height * p);
  ctx.beginPath();
  for (let i = 1; i < canvas.width; i++) {
    const nextP = noise1(offset + i * scale);
    ctx.lineTo(i, (canvas.height * (nextP + 1)) / 2);
    p = nextP;
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "black";
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
  for (let z = 0; z < field.depth; z++) {
    for (let y = 0; y < field.height; y++) {
      for (let x = 0; x < field.width; x++) {
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
  const projection = mat4.create();
  const target = vec3.fromValues(64, 64, 64);
  const view = mat4.lookAt(mat4.create(), [216, 216, 216], target, up);
  const viewProjection = mat4.identity(mat4.create());

  let isActive = false;
  const canvas = document.getElementById("noise3d") as HTMLCanvasElement;
  listenInputEvents(canvas, (e) => {
    const isActivePrev = isActive;
    isActive = !!e.buttons || e.keys.Space;
    if (isActive && !isActivePrev) requestAnimationFrame(frame);

    if ((e.keys.Space && e.keys.ShiftLeft) || e.buttons === 5) {
      rotateOrbit(view, target, e.delta);
    } else if ((e.keys.Space && e.keys.ControlLeft) || e.buttons === 6) {
      pinchOrbit(view, target, e.delta);
    } else if (e.keys.Space || e.buttons === 4) {
      moveXY(view, target, e.delta);
    } else {
      return;
    }
  });

  const gl = canvas.getContext("webgl2")!;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.depthFunc(gl.LEQUAL);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
  );
  gl.blendEquation(gl.FUNC_ADD);
  gl.colorMask(true, true, true, true);
  gl.clearColor(1, 1, 1, 1);
  gl.clearDepth(1);

  const vert = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
  const frag = gl.createShader(gl.FRAGMENT_SHADER) as WebGLShader;
  gl.shaderSource(vert, vertSrc);
  gl.shaderSource(
    frag,
    /* glsl */ `#version 300 es
    precision highp float;
    in vec3 vPosition;
    in vec3 vNormal;
    out vec4 finalColor;
    void main() {
      vec3 normal;
      normal = normalize(cross(dFdx(vPosition), dFdy(vPosition)));
      normal = vNormal;
      finalColor = vec4((normal + 1.f) / 2.f, 1.f);
    }
  `,
  );
  gl.compileShader(vert);
  gl.compileShader(frag);
  const program = gl.createProgram() as WebGLProgram;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  console.log(gl.getShaderInfoLog(vert));
  console.log(gl.getShaderInfoLog(frag));

  gl.useProgram(program);

  const fieldSizeLoc = gl.getUniformLocation(program, "fieldSize");
  const isolevelLoc = gl.getUniformLocation(program, "isolevel");
  const triTableLoc = gl.getUniformLocation(program, "triTable");
  const fieldLoc = gl.getUniformLocation(program, "field");
  const viewProjectionLoc = gl.getUniformLocation(program, "viewProjection");

  gl.uniform1f(isolevelLoc, 20);
  gl.uniform3iv(fieldSizeLoc, [field.width, field.height, field.depth]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8UI,
    16,
    256,
    0,
    gl.RED_INTEGER,
    gl.UNSIGNED_BYTE,
    triTable,
  );
  gl.uniform1i(triTableLoc, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.texImage3D(
    gl.TEXTURE_3D,
    0,
    gl.R8UI,
    field.width,
    field.height,
    field.depth,
    0,
    gl.RED_INTEGER,
    gl.UNSIGNED_BYTE,
    field.src,
  );
  gl.uniform1i(fieldLoc, 1);

  function frame() {
    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(projection, Math.PI / 4, aspectRatio, 0.01, +Infinity);
    mat4.multiply(viewProjection, projection, view);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniform1f(isolevelLoc, 128);
    gl.uniformMatrix4fv(viewProjectionLoc, false, viewProjection);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.drawArrays(
      gl.TRIANGLES,
      0,
      field.width * field.height * field.depth * 15,
    );
    if (isActive) requestAnimationFrame(frame);
  }
  frame();
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

  const projection = mat4.create();
  const target = vec3.fromValues(16, 16, 16);
  const view = mat4.lookAt(mat4.create(), [64, 64, 64], target, up);
  const viewProjection = mat4.identity(mat4.create());

  const canvas = document.getElementById("noise4d") as HTMLCanvasElement;
  listenInputEvents(canvas, (e) => {
    if ((e.keys.Space && e.keys.ShiftLeft) || e.buttons === 5) {
      rotateOrbit(view, target, e.delta);
    } else if ((e.keys.Space && e.keys.ControlLeft) || e.buttons === 6) {
      pinchOrbit(view, target, e.delta);
    } else if (e.keys.Space || e.buttons === 4) {
      moveXY(view, target, e.delta);
    } else {
      return;
    }
  });

  const gl = canvas.getContext("webgl2")!;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.depthFunc(gl.LEQUAL);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
  );
  gl.blendEquation(gl.FUNC_ADD);
  gl.colorMask(true, true, true, true);
  gl.clearColor(1, 1, 1, 1);
  gl.clearDepth(1);

  const vert = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
  const frag = gl.createShader(gl.FRAGMENT_SHADER) as WebGLShader;
  gl.shaderSource(vert, vertSrc);
  gl.shaderSource(
    frag,
    /* glsl */ `#version 300 es
    precision highp float;
    in vec3 vPosition;
    in vec3 vNormal;
    out vec4 finalColor;
    void main() {
      vec3 normal;
      normal = normalize(cross(dFdx(vPosition), dFdy(vPosition)));
      normal = vNormal;
      finalColor = vec4((normal + 1.f) / 2.f, 1.f);
    }
  `,
  );
  gl.compileShader(vert);
  gl.compileShader(frag);
  const program = gl.createProgram() as WebGLProgram;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  console.log(gl.getShaderInfoLog(vert));
  console.log(gl.getShaderInfoLog(frag));

  gl.useProgram(program);

  const fieldSizeLoc = gl.getUniformLocation(program, "fieldSize");
  const isolevelLoc = gl.getUniformLocation(program, "isolevel");
  const triTableLoc = gl.getUniformLocation(program, "triTable");
  const fieldLoc = gl.getUniformLocation(program, "field");
  const viewProjectionLoc = gl.getUniformLocation(program, "viewProjection");

  gl.uniform1f(isolevelLoc, 20);
  gl.uniform3iv(fieldSizeLoc, [field.width, field.height, field.depth]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8UI,
    16,
    256,
    0,
    gl.RED_INTEGER,
    gl.UNSIGNED_BYTE,
    triTable,
  );
  gl.uniform1i(triTableLoc, 0);

  const fieldTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, fieldTexture);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  gl.texImage3D(
    gl.TEXTURE_3D,
    0,
    gl.R8UI,
    field.width,
    field.height,
    field.depth,
    0,
    gl.RED_INTEGER,
    gl.UNSIGNED_BYTE,
    field.src,
  );
  gl.uniform1i(fieldLoc, 1);

  requestAnimationFrame(function frame(time: number) {
    for (let z = 0; z < field.depth; z++) {
      for (let y = 0; y < field.height; y++) {
        for (let x = 0; x < field.width; x++) {
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
    gl.bindTexture(gl.TEXTURE_3D, fieldTexture);
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.R8UI,
      field.width,
      field.height,
      field.depth,
      0,
      gl.RED_INTEGER,
      gl.UNSIGNED_BYTE,
      field.src,
    );

    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(projection, Math.PI / 4, aspectRatio, 0.01, +Infinity);
    mat4.multiply(viewProjection, projection, view);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniform1f(isolevelLoc, 128);
    gl.uniformMatrix4fv(viewProjectionLoc, false, viewProjection);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.drawArrays(
      gl.TRIANGLES,
      0,
      field.width * field.height * field.depth * 15,
    );
    requestAnimationFrame(frame);
  });
}

drawNoise1D();
drawNoise2D();
drawNoise3D();
drawNoise4D();
export {};
