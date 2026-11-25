import * as THREE from 'three';
import { groundCenter, groundDepth } from './world-ground.js';

const wakeCount = 6;
const wakeLifetime = 2.05;

const goldVertex = /* glsl */ `
  uniform float time;
  uniform mat4 worldToGold;
  uniform vec4 footprints[DISC_FOOTPRINT_COUNT];
  uniform vec4 wakes[${wakeCount}];

  varying vec2 vSurface;
  varying vec2 vSlope;
  varying vec3 vEye;
  varying float vHeight;
  varying float vContactShadow;

  vec3 swell(vec2 point, vec2 trend, vec2 warp, float speed, float amplitude, float crest) {
    float bend = dot(point, warp) + time * 0.29;
    float phase = dot(point, trend) + 0.86 * sin(bend) - time * speed;
    float shape = sin(phase);
    float height = amplitude * (shape + crest * shape * shape * shape);
    float derivative = amplitude * cos(phase) * (1.0 + 3.0 * crest * shape * shape);
    return vec3(height, derivative * (trend + 0.86 * cos(bend) * warp));
  }

  vec3 pointerWake(vec2 point) {
    vec3 wake = vec3(0.0);
    for (int index = 0; index < ${wakeCount}; index++) {
      vec4 ring = wakes[index];
      if (ring.w <= 0.0) continue;
      float age = time - ring.z;
      float remaining = max(0.0, 1.0 - age / ${wakeLifetime.toFixed(2)});
      vec2 offset = point - ring.xy;
      float distance = length(offset);
      float front = distance - age * 2.9;
      float envelope = ring.w * remaining * remaining * exp(-1.25 * abs(front));
      float phase = front * 5.5;
      wake.x += envelope * sin(phase);
      wake.yz += envelope * (5.5 * cos(phase) - 1.25 * sign(front) * sin(phase))
        * offset / max(0.08, distance);
    }
    return wake;
  }

  vec2 discContact(vec2 point) {
    float sheltered = 0.0;
    float shade = 0.0;
    for (int index = 0; index < DISC_FOOTPRINT_COUNT; index++) {
      vec4 footprint = footprints[index];
      if (footprint.z < 0.001) continue;
      vec2 offset = (point - footprint.xy) / footprint.z;
      float lift = footprint.w;
      sheltered = max(sheltered, (1.0 - smoothstep(0.96, 1.48, dot(offset, offset))) * 0.85);
      vec2 castOffset = offset - vec2(0.13 + 0.20 * lift, 0.18 + 0.15 * lift);
      float shadowRadius = mix(1.56, 2.32, lift);
      float shadowCore = mix(0.70, 0.33, lift);
      float castShade = 1.0 - smoothstep(shadowCore, shadowRadius, dot(castOffset, castOffset));
      shade = max(shade, castShade * mix(0.73, 0.48, lift));
    }
    return vec2(sheltered, shade);
  }

  void main() {
    vSurface = position.xz;
    vec3 waves = swell(vSurface, vec2(0.43, 0.72), vec2(0.25, -0.16), 0.77, 0.255, 0.18);
    waves += swell(vSurface, vec2(-0.78, 0.84), vec2(0.18, 0.35), -0.89, 0.145, 0.13);
    waves += swell(vSurface, vec2(1.48, 1.83), vec2(0.31, -0.43), 1.11, 0.034, 0.11);
    waves += pointerWake(vSurface);

    vec2 contact = discContact(vSurface);
    float exposure = 1.0 - contact.x;
    vHeight = waves.x * exposure - 0.058 * contact.x;
    vSlope = waves.yz * exposure;
    vContactShadow = contact.y;

    vec3 displaced = position + vec3(0.0, vHeight, 0.0);
    vEye = (worldToGold * vec4(cameraPosition, 1.0)).xyz - displaced;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const goldFragment = /* glsl */ `
  uniform float time;
  uniform vec3 shadowGold;
  uniform vec3 baseGold;
  uniform vec3 amber;
  uniform vec3 richGold;
  uniform vec3 glow;

  varying vec2 vSurface;
  varying vec2 vSlope;
  varying vec3 vEye;
  varying float vHeight;
  varying float vContactShadow;

  float reflectedStrip(vec3 reflection, float offset, float width, float lengthScale) {
    vec2 curve = vec2((reflection.x + 0.15) * lengthScale,
      (reflection.z + offset + 0.13 * reflection.x) / width);
    return exp(-dot(curve, curve)) * smoothstep(0.24, 0.83, reflection.y);
  }

  void main() {
    float extent = max(length(dFdx(vSurface)), length(dFdy(vSurface)));
    float fineDetail = 1.0 - smoothstep(0.036, 0.16, extent);
    float grain = dot(vSurface, vec2(5.9, 8.2)) + 1.2 * sin(vSurface.x * 1.11 + vSurface.y * 0.32 - time * 0.59);
    float crossing = dot(vSurface, vec2(-5.3, 3.2)) - time * 1.6;
    vec2 microSlope = vec2(cos(grain) + 0.42 * cos(crossing), 1.25 * cos(grain) - 0.25 * cos(crossing));
    vec2 slope = vSlope + microSlope * fineDetail * mix(0.028, 0.011, vContactShadow);
    vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
    vec3 viewer = normalize(vEye);
    vec3 reflection = reflect(-viewer, normal);

    float copper = smoothstep(-0.36, 0.29, vHeight)
      * (0.50 + 0.50 * smoothstep(-0.80, 0.45, reflection.z));
    float edgeLight = pow(1.0 - max(0.0, dot(viewer, normal)), 3.0);
    vec3 radiance = mix(shadowGold, baseGold, smoothstep(0.06, 0.94, reflection.y) * 0.72);
    radiance = mix(radiance, amber, copper * 0.65);

    float key = reflectedStrip(reflection, 0.35, 0.24, 0.79);
    float rim = reflectedStrip(reflection, -0.24, 0.18, 1.29);
    float peak = reflectedStrip(reflection, 0.38, 0.092, 1.42);
    float seam = reflectedStrip(reflection, -0.46, 0.10, 1.08);
    radiance += richGold * (0.77 * key + 0.42 * rim + 0.19 * seam + 0.27 * edgeLight);
    radiance += glow * (0.61 * peak + 0.13 * rim * rim);

    float drift = sin(vSurface.x * 0.19 + vSurface.y * 0.23) * cos(vSurface.y * 0.18 - time * 0.31);
    float pool = 1.0 - smoothstep(-0.32, -0.07, vHeight);
    radiance *= 0.91 + 0.09 * drift - 0.18 * pool;
    radiance *= 1.0 - vContactShadow;
    gl_FragColor = vec4(radiance, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createRewindGold(trackCount = 1) {
  const group = new THREE.Group();
  group.position.z = -17;
  group.rotation.x = 1.28;
  group.updateMatrixWorld(true);

  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, group.position);
  const localFromWorld = group.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  const footprints = Array.from({ length: Math.max(1, trackCount) }, () => new THREE.Vector4());
  const wakes = Array.from({ length: wakeCount }, () => new THREE.Vector4(0, 0, 0, 0));
  const geometry = new THREE.PlaneGeometry(156, groundDepth, 288, Math.ceil(groundDepth * 152 / 66))
    .rotateX(-Math.PI / 2)
    .translate(0, 0, groundCenter);
  const material = new THREE.ShaderMaterial({
    defines: { DISC_FOOTPRINT_COUNT: footprints.length },
    uniforms: {
      time: { value: 0 },
      worldToGold: { value: localFromWorld },
      footprints: { value: footprints },
      wakes: { value: wakes },
      shadowGold: { value: new THREE.Color('#301608') },
      baseGold: { value: new THREE.Color('#a76020') },
      amber: { value: new THREE.Color('#c88728') },
      richGold: { value: new THREE.Color('#ffbd53') },
      glow: { value: new THREE.Color('#ffe9b7') },
    },
    vertexShader: goldVertex,
    fragmentShader: goldFragment,
  });
  group.add(new THREE.Mesh(geometry, material));

  const lastRipple = new THREE.Vector2();
  let lastEmission = -Infinity;
  let nextWake = 0;

  return {
    group,
    plane,
    setDiscFootprint(index, position, radius = 0, lift = 0) {
      const footprint = footprints[index];
      if (!footprint) return;
      if (!position) {
        footprint.z = 0;
        return;
      }
      point.copy(position).applyMatrix4(localFromWorld);
      footprint.set(point.x, point.z, radius, lift);
    },
    update(time, pointer, reduced) {
      material.uniforms.time.value = reduced ? 0 : time;
      if (reduced) {
        wakes.forEach(wake => { wake.w = 0; });
        lastEmission = -Infinity;
        return;
      }
      for (const wake of wakes) {
        if (time - wake.z > wakeLifetime) wake.w = 0;
      }
      if (!pointer) return;
      point.copy(pointer).applyMatrix4(localFromWorld);
      const moved = Math.hypot(point.x - lastRipple.x, point.z - lastRipple.y);
      if (time - lastEmission < (moved > 0.38 ? 0.16 : 0.42)) return;

      wakes[nextWake].set(point.x, point.z, time, moved > 0.38 ? 0.078 : 0.056);
      nextWake = (nextWake + 1) % wakes.length;
      lastRipple.set(point.x, point.z);
      lastEmission = time;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
