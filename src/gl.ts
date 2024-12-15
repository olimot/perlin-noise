import { mat4, ReadonlyVec3, vec3 } from "gl-matrix";
import vertexShaderSource from "./marching-cubes.vert?raw";
import fragmentShaderSource from "./normal-color.frag?raw";
import triTableURL from "./u8-tri-table-256x16.bin?url";

const triTable = await fetch(triTableURL).then(async (res) => {
  return new Uint8Array(await res.arrayBuffer());
});

export function initGL2(canvas: HTMLCanvasElement) {
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
  return gl;
}

export function createMarchingCubesProgram(
  gl: WebGL2RenderingContext,
  field: {
    width: number;
    height: number;
    depth: number;
    src: Uint8Array<ArrayBuffer>;
  },
) {
  const vert = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
  const frag = gl.createShader(gl.FRAGMENT_SHADER) as WebGLShader;
  gl.shaderSource(vert, vertexShaderSource);
  gl.shaderSource(frag, fragmentShaderSource);
  gl.compileShader(vert);
  gl.compileShader(frag);
  const program = gl.createProgram() as WebGLProgram;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.useProgram(program);

  const uLoc = {
    fieldSize: gl.getUniformLocation(program, "fieldSize"),
    isolevel: gl.getUniformLocation(program, "isolevel"),
    triTable: gl.getUniformLocation(program, "triTable"),
    field: gl.getUniformLocation(program, "field"),
    viewProjection: gl.getUniformLocation(program, "viewProjection"),
  };

  gl.uniform1f(uLoc.isolevel, 20);
  gl.uniform3iv(uLoc.fieldSize, [field.width, field.height, field.depth]);
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
  gl.uniform1i(uLoc.triTable, 0);

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
  gl.uniform1i(uLoc.field, 1);

  return { program, uLoc, fieldTexture };
}

export function addCameraControl(canvas: HTMLCanvasElement) {
  // # setup camera
  const up: ReadonlyVec3 = vec3.fromValues(0, 1, 0);
  const eye = vec3.fromValues(2, 2, 2);
  const target = vec3.fromValues(0, 0, 0);
  const view = mat4.lookAt(mat4.create(), eye, target, up);
  const projection = mat4.create();
  const viewProjection = mat4.identity(mat4.create());
  const invViewProj = mat4.identity(mat4.create());
  const near = 0.01;
  const far = 1024;
  const yfov = Math.PI / 4;

  function updateMatrices() {
    mat4.lookAt(view, eye, target, up);
    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(projection, yfov, aspectRatio, near, far);
    mat4.multiply(viewProjection, projection, view);
    mat4.invert(invViewProj, viewProjection);
  }

  // ## add camera control
  const raycastToTargetPlane = (() => {
    const temp = vec3.create();
    const temp2 = vec3.create();
    const temp3 = vec3.create();
    return (out: vec3, x: number, y: number) => {
      temp[0] = (x / canvas.clientWidth) * 2 - 1;
      temp[1] = (-y / canvas.clientHeight) * 2 + 1;
      temp[2] = -1;
      const P_0 = vec3.transformMat4(temp, temp, invViewProj);
      const N = vec3.normalize(temp2, vec3.sub(temp2, eye, target));
      const V = vec3.normalize(temp3, vec3.sub(temp3, P_0, eye));
      const d = vec3.dot(target, N);

      // $P = P_0 + \dfrac {-(P_0 \cdot N + d)} {V \cdot N}V$
      const t = -(vec3.dot(P_0, N) + d) / vec3.dot(V, N);
      return vec3.scaleAndAdd(out, P_0, V, t);
    };
  })();

  const onPointerEvent = (() => {
    const temp = vec3.create();
    const temp2 = vec3.create();
    const temp3 = vec3.create();
    return (e: PointerEvent) => {
      e.preventDefault();
      if (!e.buttons || (!e.movementX && !e.movementY)) return;

      const { offsetX: x, offsetY: y, movementX: dX, movementY: dY } = e;

      if (e.buttons & 1) {
        const r = vec3.distance(eye, target);
        const targetToEye = vec3.normalize(temp, vec3.sub(temp, eye, target));
        const dTheta = -(dX / canvas.clientWidth) * 2;
        const dPhi = -(dY / canvas.clientHeight) * 2;
        const theta = Math.atan2(targetToEye[0], targetToEye[2]) + dTheta;
        let phi = Math.acos(targetToEye[1]) + dPhi;
        phi = Math.min(Math.max(0.001, phi), Math.PI - 0.001);
        targetToEye[0] = Math.sin(phi) * Math.sin(theta);
        targetToEye[1] = Math.cos(phi);
        targetToEye[2] = Math.sin(phi) * Math.cos(theta);
        vec3.scaleAndAdd(eye, target, targetToEye, r);
      } else if (e.buttons & 2) {
        const position = raycastToTargetPlane(temp, x, y);
        const prev = raycastToTargetPlane(temp2, x - dX, y - dY);
        const delta = vec3.subtract(temp3, position, prev);
        const rDelta = -Math.sign(dX || dY) * vec3.length(delta);
        const targetToEye = vec3.sub(temp3, eye, target);
        const r = vec3.length(targetToEye);
        vec3.scaleAndAdd(eye, target, targetToEye, (r + rDelta) / r);
      } else if (e.buttons & 4) {
        const position = raycastToTargetPlane(temp, x, y);
        const prev = raycastToTargetPlane(temp2, x - dX, y - dY);
        const delta = vec3.subtract(temp3, position, prev);
        vec3.sub(target, target, delta);
        vec3.sub(eye, eye, delta);
      }

      updateMatrices();
    };
  })();

  canvas.addEventListener(
    "contextmenu",
    (e) => !e.ctrlKey && e.preventDefault(),
  );
  canvas.addEventListener("pointerdown", onPointerEvent);
  canvas.addEventListener("pointermove", onPointerEvent);
  canvas.addEventListener("pointerup", onPointerEvent);

  return {
    up,
    eye,
    target,
    view,
    projection,
    viewProjection,
    invViewProj,
    near,
    far,
    yfov,
    updateMatrices,
  };
}
