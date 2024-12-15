#version 300 es
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
