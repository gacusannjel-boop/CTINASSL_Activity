import * as THREE from 'three';
import { groundCenter, groundDepth, groundStart } from './world-ground.js';

const width = 156;
const groundHeight = `
  float snowHeight(vec2 point) {
    float bank = sin(point.x * 0.34 + point.y * 0.27 + 1.58 * sin(point.y * 0.31));
    float drift = sin(point.y * 0.83 - point.x * 0.17 + 0.84 * sin(point.x * 0.43 - point.y * 0.22));
    return 0.042 + 0.092 * bank + 0.041 * drift;
  }
`;

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function snowSurface(footprints) {
  const geometry = new THREE.PlaneGeometry(width, groundDepth, 152, Math.ceil(groundDepth * 64 / 56))
    .rotateX(-Math.PI / 2)
    .translate(0, 0, groundCenter);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      footprints,
      shade: { value: new THREE.Color('#788faa') },
      frost: { value: new THREE.Color('#b1c5de') },
      edge: { value: new THREE.Color('#eff5fa') },
    },
    vertexShader: `
      varying vec2 vGround;
      ${groundHeight}

      void main() {
        vGround = position.xz;
        vec3 bank = vec3(position.x, snowHeight(vGround), position.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(bank, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 shade;
      uniform vec3 frost;
      uniform vec3 edge;
      uniform vec4 footprints[${footprints.value.length}];
      varying vec2 vGround;
      ${groundHeight}

      float grain(vec2 grid) {
        vec3 hash = fract(vec3(grid.xyx) * 0.1031);
        hash += dot(hash, hash.yzx + 33.33);
        return fract((hash.x + hash.y) * hash.z);
      }

      float contactShade(vec2 point) {
        float darkness = 0.0;
        for (int i = 0; i < ${footprints.value.length}; i++) {
          vec4 footprint = footprints[i];
          if (footprint.z < 0.001) continue;
          float lift = footprint.w;
          vec2 shift = vec2(0.15 + 0.34 * lift, 0.18 + 0.36 * lift);
          vec2 offset = point - footprint.xy - shift;
          float falloff = footprint.z * mix(1.30, 1.53, lift);
          float distance2 = dot(offset, offset);
          if (distance2 >= falloff * falloff) continue;
          float rim = footprint.z * mix(0.91, 0.57, lift);
          float shadow = 1.0 - smoothstep(rim * rim, falloff * falloff, distance2);
          darkness = max(darkness, shadow * mix(0.65, 0.40, lift));
        }
        return darkness;
      }

      void main() {
        vec2 point = vGround;
        float swell = snowHeight(point);
        float gradient = (snowHeight(point + vec2(0.19, -0.36)) - swell) * 24.0;
        float ripple = sin(point.x * 0.59 - point.y * 1.78 + 0.6 * sin(point.x * 0.68 + point.y * 0.33));
        float deep = smoothstep(-0.12, 0.18, swell + 0.065 * sin(point.x * 0.19 + point.y * 0.22));
        vec3 color = mix(shade, frost, 0.40 + 0.44 * deep);
        color = mix(color, edge, smoothstep(-0.42, 0.57, gradient + 0.08 * ripple) * (0.26 + 0.38 * deep));

        vec2 iceGrid = point * 24.0;
        float crisp = 1.0 - smoothstep(0.27, 1.16, length(fwidth(iceGrid)));
        float sparkle = smoothstep(0.96, 1.0, grain(floor(iceGrid)));
        float dust = (grain(floor(iceGrid * 1.62)) - 0.5) * crisp;
        color += vec3(0.13 * sparkle * crisp + dust * 0.045);
        color *= 1.0 - contactShade(point);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

function pawTrail(clock) {
  const count = 56;
  const footprint = new THREE.PlaneGeometry(1.33, 1.33, 4, 4).rotateX(-Math.PI / 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.copy(footprint);
  footprint.dispose();
  geometry.instanceCount = count;
  const marks = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < count; i++) marks.setW(i, -1000);
  geometry.setAttribute('mark', marks);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: clock,
      ink: { value: new THREE.Color('#284668') },
      snow: { value: new THREE.Color('#f4faff') },
    },
    vertexShader: `
      attribute vec4 mark;
      uniform float time;
      varying vec2 vPaw;
      varying float vFade;
      ${groundHeight}

      void main() {
        vPaw = uv - 0.5;
        float age = time - mark.w;
        vFade = 1.0 - smoothstep(3.0, 14.0, age);
        if (vFade <= 0.0) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          return;
        }
        float cosine = cos(mark.z);
        float sine = sin(mark.z);
        vec2 rotated = mat2(cosine, -sine, sine, cosine) * position.xz;
        vec2 point = mark.xy + rotated;
        gl_Position = projectionMatrix * modelViewMatrix
          * vec4(point.x, snowHeight(point) + 0.025, point.y, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 ink;
      uniform vec3 snow;
      varying vec2 vPaw;
      varying float vFade;

      float pad(vec2 p, vec2 center, vec2 radii, float tilt) {
        vec2 q = p - center;
        float cosine = cos(tilt);
        float sine = sin(tilt);
        q = mat2(cosine, -sine, sine, cosine) * q;
        return (length(q / radii) - 1.0) * min(radii.x, radii.y);
      }

      float paw(vec2 p) {
        float center = pad(p, vec2(0.0, -0.12), vec2(0.190, 0.129), 0.0);
        center = min(center, pad(p, vec2(-0.083, -0.160), vec2(0.101, 0.100), 0.28));
        center = min(center, pad(p, vec2(0.083, -0.160), vec2(0.101, 0.100), -0.28));
        float toes = min(
          pad(p, vec2(-0.210, 0.072), vec2(0.061, 0.100), -0.36),
          pad(p, vec2(0.210, 0.072), vec2(0.061, 0.100), 0.36)
        );
        toes = min(toes, pad(p, vec2(-0.079, 0.204), vec2(0.066, 0.106), -0.14));
        toes = min(toes, pad(p, vec2(0.079, 0.204), vec2(0.066, 0.106), 0.14));
        return min(center, toes);
      }

      void main() {
        float surface = paw(vPaw);
        float aa = max(0.004, 0.78 * fwidth(surface));
        float indent = 1.0 - smoothstep(-aa, aa, surface);
        float litSurface = paw(vPaw + vec2(0.018, -0.023));
        float rim = (1.0 - smoothstep(0.0, 0.035, abs(surface))) * smoothstep(0.002, 0.028, litSurface - surface);
        float hollow = smoothstep(-0.12, -0.008, surface);
        vec3 color = mix(ink, snow, (1.0 - indent) * rim * 0.74);
        float alpha = max(indent * (0.57 + 0.18 * hollow), rim * 0.53) * vFade;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  let anchored = false;
  let distanceSincePrint = 0;
  let next = 0;
  let side = 1;
  const previous = new THREE.Vector2();
  const step = 1.0;

  return {
    mesh,
    update(time, point) {
      if (!point) {
        anchored = false;
        return;
      }
      const dx = point.x - previous.x;
      const dz = point.z - previous.y;
      const distance = Math.hypot(dx, dz);
      if (!anchored || distance > 18) {
        previous.set(point.x, point.z);
        distanceSincePrint = 0;
        anchored = true;
        return;
      }
      if (distance < 0.006) return;

      const heading = Math.atan2(-dx, -dz);
      if (distanceSincePrint + distance >= step) {
        for (let along = step - distanceSincePrint; along <= distance; along += step) {
          const x = previous.x + (dx * along - dz * side * 0.14) / distance;
          const z = previous.y + (dz * along + dx * side * 0.14) / distance;
          marks.setXYZW(next, x, z, heading + side * 0.16, time);
          next = (next + 1) % count;
          side *= -1;
        }
        marks.needsUpdate = true;
      }
      distanceSincePrint = (distanceSincePrint + distance) % step;
      previous.set(point.x, point.z);
    },
  };
}

function windFlakes(clock) {
  const geometry = new THREE.BufferGeometry();
  const flakeWidth = 110;
  const count = Math.round(1120 * flakeWidth * groundDepth / (91 * 48));
  const random = seededRandom(20195);
  const positions = new Float32Array(count * 3);
  const grain = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions.set([
      (random() - .5) * flakeWidth,
      0.37 + random() * 3.7,
      groundStart + random() * groundDepth,
    ], i * 3);
    grain[i] = random();
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('grain', new THREE.BufferAttribute(grain, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: clock,
      pixels: { value: 1 },
      flakeBounds: { value: new THREE.Vector3(flakeWidth, groundStart, groundDepth) },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float grain;
      uniform float time;
      uniform float pixels;
      uniform vec3 flakeBounds;
      varying float vOpacity;

      void main() {
        float phase = grain * 6.2831853 + position.z * 0.58;
        float breeze = sin(time * 0.44 + phase);
        vec3 flake = position;
        float halfWidth = flakeBounds.x * 0.5;
        flake.x = mod(flake.x + halfWidth + time * (0.82 + grain * 0.72) + breeze * 0.76, flakeBounds.x) - halfWidth;
        flake.z = mod(flake.z - flakeBounds.y + time * (0.39 + grain * 0.45) + breeze * 0.42, flakeBounds.z) + flakeBounds.y;
        flake.y = 0.35 + mod(flake.y + 40.0 - time * (0.17 + grain * 0.28), 3.7);
        vec4 view = modelViewMatrix * vec4(flake, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((0.048 + 0.18 * grain * grain) * pixels / max(1.0, -view.z), 1.0, 17.0);
        vOpacity = (0.30 + 0.48 * grain) * (0.76 + 0.24 * breeze);
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      void main() {
        float distanceToCore = length(gl_PointCoord - 0.5) * 2.0;
        float opacity = 1.0 - smoothstep(0.19, 0.96, distanceToCore);
        gl_FragColor = vec4(0.94, 0.97, 1.0, opacity * vOpacity);
        #include <colorspace_fragment>
      }
    `,
  });
  const flakes = new THREE.Points(geometry, material);
  flakes.frustumCulled = false;
  flakes.renderOrder = 2;
  const bufferSize = new THREE.Vector2();
  flakes.onBeforeRender = renderer => {
    material.uniforms.pixels.value = renderer.getDrawingBufferSize(bufferSize).y;
  };
  return flakes;
}

export function createBlueHourSnow(trackCount = 1) {
  const group = new THREE.Group();
  group.position.z = -17;
  group.rotation.x = 1.28;
  group.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, group.position);
  const localFromWorld = group.matrixWorld.clone().invert();
  const point = new THREE.Vector3();

  const footprints = { value: Array.from({ length: Math.max(1, trackCount) }, () => new THREE.Vector4()) };
  const clock = { value: 0 };
  const floor = snowSurface(footprints);
  const trail = pawTrail(clock);
  group.add(floor, trail.mesh, windFlakes(clock));

  return {
    group,
    plane,
    setDiscFootprint(index, position, radius = 0, lift = 0) {
      const footprint = footprints.value[index];
      if (!footprint) return;
      if (position) {
        point.copy(position).applyMatrix4(localFromWorld);
        footprint.set(point.x, point.z, radius, lift);
      } else {
        footprint.z = 0;
      }
    },
    update(time, pointer, reduced) {
      clock.value = reduced ? 0 : time;
      trail.update(clock.value, pointer ? point.copy(pointer).applyMatrix4(localFromWorld) : null);
    },
    dispose() {
      group.traverse(child => {
        child.geometry?.dispose();
        child.material?.dispose();
      });
    },
  };
}
