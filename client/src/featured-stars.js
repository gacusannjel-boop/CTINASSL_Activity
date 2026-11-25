import * as THREE from 'three';
import { groundCenter, groundDepth, groundStart } from './world-ground.js';

const width = 156;

function makeNebula(uniforms) {
  const geometry = new THREE.PlaneGeometry(width, groundDepth)
    .rotateX(-Math.PI / 2)
    .translate(0, -6, groundCenter);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      voidColor: { value: new THREE.Color('#090711') },
      violet: { value: new THREE.Color('#563087') },
      indigo: { value: new THREE.Color('#25245d') },
      pink: { value: new THREE.Color('#aa61b3') },
    },
    vertexShader: `
      varying vec2 vSky;

      void main() {
        vSky = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec2 cursor;
      uniform float cursorStrength;
      uniform vec3 voidColor;
      uniform vec3 violet;
      uniform vec3 indigo;
      uniform vec3 pink;
      varying vec2 vSky;

      float hash(vec2 point) {
        vec3 seed = fract(vec3(point.xyx) * 0.1031);
        seed += dot(seed, seed.yzx + 33.33);
        return fract((seed.x + seed.y) * seed.z);
      }

      float noise(vec2 point) {
        vec2 cell = floor(point);
        vec2 offset = fract(point);
        vec2 weight = offset * offset * (3.0 - 2.0 * offset);
        float lower = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), weight.x);
        float upper = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + 1.0), weight.x);
        return mix(lower, upper, weight.y);
      }

      float cloud(vec2 point) {
        mat2 turn = mat2(0.83, -0.56, 0.56, 0.83);
        float first = 0.54 * noise(point);
        point = turn * point * 2.02 + 5.4;
        float second = 0.27 * noise(point);
        point = turn * point * 2.10;
        return first + second + 0.13 * noise(point) + 0.06 * noise(point * 2.07);
      }

      void main() {
        vec2 point = vSky * vec2(0.066, 0.078);
        vec2 drift = vec2(cloud(point + 11.2), cloud(point - 7.9));
        vec2 warped = point + 2.7 * (drift - 0.5);
        float vapor = cloud(warped * vec2(1.3, 0.85));
        float filament = 1.0 - abs(2.0 * noise(warped * vec2(2.6, 1.2)) - 1.0);
        float turbulence = 0.61 * noise(warped * vec2(14.0, 7.0))
          + 0.39 * noise(warped * vec2(27.0, 17.0));
        float bend = 0.66 * warped.x + 0.82 * warped.y + 0.69 * sin(warped.y * 0.83);
        float lane = 1.0 - smoothstep(0.14, 1.0, abs(sin(bend)));
        float halo = smoothstep(0.28, 0.74, vapor) * (0.31 + 0.69 * lane);
        float clouds = smoothstep(0.39, 0.79, vapor + lane * 0.11 + (turbulence - 0.5) * 0.13);
        float edge = smoothstep(0.62, 0.94, vapor + filament * 0.26) * halo;
        vec2 fromCursor = vSky - cursor;
        float cursorGlow = cursorStrength * exp(-dot(fromCursor, fromCursor) * 0.036);

        vec3 color = voidColor + indigo * halo * 0.72;
        color += violet * clouds * clouds * (0.53 + 0.31 * filament);
        color += pink * edge * (0.27 + turbulence * 0.29 + cursorGlow * 0.10);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

function makeStars(uniforms) {
  const farCount = 8200;
  const nearCount = 4400;
  const count = farCount + nearCount;
  const positions = new Float32Array(count * 3);
  const shapes = new Float32Array(count * 4);
  let seed = 41813;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < count; index++) {
    const depth = index < farCount ? -4.9 : -1.7;
    const burst = index % 52 === 0;
    positions.set([(random() - 0.5) * width, depth, groundStart + random() * groundDepth], index * 3);
    shapes.set([
      burst ? 8.8 + random() * 4.8 : 2.2 + random() ** 2.5 * 1.95,
      0.42 + random() ** 2 * 0.68,
      random(),
      burst ? 1 : 0,
    ], index * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('shape', new THREE.BufferAttribute(shapes, 4));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      pixelRatio: { value: 1 },
      blue: { value: new THREE.Color('#b1baff') },
      pearl: { value: new THREE.Color('#fff5ff') },
      rose: { value: new THREE.Color('#e295f3') },
    },
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    vertexShader: `
      uniform float time;
      uniform float pixelRatio;
      uniform vec2 cursor;
      uniform float cursorStrength;
      attribute vec4 shape;
      varying vec3 vStar;

      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        float phase = shape.z * 97.3;
        float twinkle = 0.88 + sin(phase + time * (0.7 + shape.z)) * 0.12;
        vec2 fromCursor = position.xz - cursor;
        float nearby = cursorStrength * exp(-dot(fromCursor, fromCursor) * 0.13);
        vStar = vec3(shape.y * twinkle + nearby * 0.24, shape.z, shape.w);
        gl_PointSize = clamp(shape.x * 29.0 / max(9.0, -view.z) * pixelRatio, 1.0, 17.0);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform vec3 blue;
      uniform vec3 pearl;
      uniform vec3 rose;
      varying vec3 vStar;

      void main() {
        vec2 point = abs(gl_PointCoord * 2.0 - 1.0);
        float diameter = dot(point, point);
        float halo = exp(-diameter * 4.8);
        float core = exp(-diameter * 11.0);
        float spikes = max(exp(-68.0 * point.x - 3.6 * point.y), exp(-68.0 * point.y - 3.6 * point.x));
        float footprint = (halo * 0.34 + core * 0.77 + 0.62 * spikes * vStar.z)
          * (1.0 - smoothstep(0.84, 1.0, diameter));
        vec3 color = mix(blue, rose, vStar.y);
        color = mix(color, pearl, min(1.0, core * 0.82 + vStar.z * 0.39));
        gl_FragColor = vec4(color, footprint * vStar.x);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const stars = new THREE.Points(geometry, material);
  stars.onBeforeRender = renderer => { material.uniforms.pixelRatio.value = renderer.getPixelRatio(); };
  return stars;
}

export function createFeaturedStars() {
  const group = new THREE.Group();
  group.position.z = -17;
  group.rotation.x = 1.28;
  group.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, group.position);
  const localFromWorld = group.matrixWorld.clone().invert();
  const target = new THREE.Vector3();
  const uniforms = {
    time: { value: 0 },
    cursor: { value: new THREE.Vector2() },
    cursorStrength: { value: 0 },
  };
  group.add(makeNebula(uniforms), makeStars(uniforms));

  let lastTime;
  return {
    group,
    plane,
    update(time, pointer, reduced) {
      uniforms.time.value = reduced ? 0 : time;
      const elapsed = Math.min(Math.max(0, time - (lastTime ?? time)), 0.05);
      const active = Boolean(pointer && !reduced);
      const response = 1 - Math.exp(-elapsed * 12);
      if (active) {
        target.copy(pointer).applyMatrix4(localFromWorld);
        uniforms.cursor.value.set(target.x, target.z);
      }
      uniforms.cursorStrength.value = reduced ? 0 : THREE.MathUtils.lerp(uniforms.cursorStrength.value, Number(active), response);
      lastTime = time;
    },
    // The star layers are behind the disc plane, so they never cover its artwork.
    setDiscFootprint() {},
    dispose() {
      group.children.forEach(mesh => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
    },
  };
}
