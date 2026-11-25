import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundDepth, groundStart } from './world-ground.js';

const blossomCount = 124;
const period = 2 * Math.PI;

function paint(geometry, colorAt) {
  const points = geometry.getAttribute('position');
  const colors = new Float32Array(points.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < points.count; i++) {
    colorAt(color, points.getX(i), points.getY(i), points.getZ(i));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function daisyGeometry() {
  const petal = new THREE.SphereGeometry(1, 10, 6);
  const points = petal.getAttribute('position');
  for (let i = 0; i < points.count; i++) {
    const length = (points.getX(i) + 1) / 2;
    const side = points.getZ(i);
    const crest = .060 * length ** 2 + .013 * (1 - side * side) * Math.sin(length * Math.PI);
    points.setXYZ(i, .070 + .284 * length, crest + points.getY(i) * .021, side * .061 + .019 * length ** 2);
  }
  petal.computeVertexNormals();
  const cream = new THREE.Color('#dcc88f');
  const white = new THREE.Color('#fffdf3');
  paint(petal, (color, x) => color.copy(cream).lerp(white, THREE.MathUtils.smoothstep(x, .070, .248)));
  const petals = Array.from({ length: 11 }, (_, i) => petal.clone()
    .scale(.95 + Math.sin(i * 8.17) * .08, 1, 1.02 + Math.cos(i * 4.36) * .15)
    .rotateY(i * period / 11));
  petal.dispose();

  const center = new THREE.SphereGeometry(1, 12, 7)
    .scale(.129, .048, .129)
    .translate(0, .034, 0);
  const gold = new THREE.Color('#a76524');
  const pollen = new THREE.Color('#ffd24d');
  paint(center, (color, x, y) => color.copy(gold).lerp(pollen, THREE.MathUtils.smoothstep(y, .01, .078)));
  const pollenGrain = paint(
    new THREE.SphereGeometry(1, 6, 4).scale(.014, .011, .014),
    (color, x, y) => color.copy(gold).lerp(pollen, THREE.MathUtils.smoothstep(y, -.009, .009))
  );
  const grains = Array.from({ length: 25 }, (_, i) => {
    const angle = i * 2.399963;
    const radius = .114 * Math.sqrt(i / 24);
    return pollenGrain.clone().translate(Math.cos(angle) * radius, .081 - .021 * (i / 24), Math.sin(angle) * radius);
  });
  pollenGrain.dispose();
  const pieces = [...petals, center, ...grains];
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  return geometry;
}

function flightSeeds() {
  let state = 321740;
  function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }
  return Array.from({ length: blossomCount }, (_, i) => {
    const width = i % 4 === 0 ? 122 : 76;
    const depth = (i + random()) * (groundDepth - 4) / blossomCount;
    return {
      x: (random() - .5) * width - 1.6,
      z: groundStart + depth,
      size: .59 + random() ** .7 * .87,
      height: .58 + random() * 1.2,
      drift: 2.4 + random() * 3.6,
      phase: random() * period,
      spin: 2.8 + random() * 4.4,
    };
  });
}

function distanceFromDiscs(x, z, size, footprints) {
  let room = 1;
  for (const footprint of footprints.value) {
    if (footprint.z <= .001) continue;
    const radius = footprint.z + size * .36 + .40;
    const dx = x - footprint.x;
    const dz = z - footprint.y;
    const minimum = radius * radius;
    room = Math.min(room, THREE.MathUtils.smoothstep(dx * dx + dz * dz, minimum, (radius + .78) ** 2));
  }
  return room;
}

export function createFlyingDaisies(footprints = { value: [] }) {
  const geometry = daisyGeometry();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: .61,
    emissive: '#ffd68d',
    emissiveIntensity: .06,
  });
  const group = new THREE.InstancedMesh(geometry, material, blossomCount);
  group.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.frustumCulled = false;
  group.count = 0;
  const seeds = flightSeeds();
  const pose = new THREE.Object3D();

  return {
    group,
    update(time, reduced) {
      group.visible = !reduced;
      if (reduced) return;

      let count = 0;
      for (const seed of seeds) {
        // Takeoff, momentum, and landing are staggered along the wind direction.
        const wave = time * .92 - seed.x * .46 - seed.z * .29 + 2.5 + .75 * Math.sin(seed.phase);
        const flight = THREE.MathUtils.euclideanModulo(wave, period) / period;
        const strength = .70 + .30 * Math.sin(time * .49 - seed.x * .075 - seed.z * .081);
        const rise = Math.sin(flight * Math.PI) ** 1.13;
        const exposure = THREE.MathUtils.smoothstep(flight, .02, .20)
          * (1 - THREE.MathUtils.smoothstep(flight, .68, .95));
        const flutter = seed.phase + flight * 17;
        const carried = flight * seed.drift + .66 * THREE.MathUtils.smoothstep(flight, .09, .40);
        const x = seed.x + carried + Math.sin(flutter * .65) * .28 * rise;
        const z = seed.z + carried * .47 + Math.cos(flutter * .89) * .39 * rise;
        const size = seed.size * exposure * strength * distanceFromDiscs(x, z, seed.size, footprints);
        if (size <= .08) continue;

        const lift = .59 + rise * (seed.height * (1 + strength) + Math.cos(flutter) * .16);
        pose.position.set(x, lift, z);
        pose.rotation.set(.24 + Math.sin(flutter) * .77, seed.phase + seed.spin * flight,
          .18 + Math.sin(flutter * .82 + .6) * .55);
        pose.scale.setScalar(size);
        pose.updateMatrix();
        group.setMatrixAt(count, pose.matrix);
        count++;
      }
      group.count = count;
      group.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      group.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
