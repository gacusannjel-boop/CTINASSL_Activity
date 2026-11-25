import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFlyingDaisies } from './daydream-flying-daisies.js';
import { groundStart, groundEnd, groundDepth, groundCenter } from './world-ground.js';

const width = 156;
const tileWidth = 12;
const tileDepth = 8;
const windShader = `
  float gustAt(vec2 root, float time) {
    float front = dot(root, vec2(0.42, 0.26)) - time * 1.12;
    float eddy = 0.38 * sin(dot(root, vec2(-0.19, 0.38)) - time * 0.66);
    return smoothstep(-0.42, 0.87, sin(front + eddy));
  }

  vec2 windAt(vec2 root, float time, float gust) {
    float flutter = sin(root.y * 1.43 - root.x * 0.57 + time * 2.6);
    float direction = 0.22 + 0.15 * sin(time * 0.54 - root.x * 0.09);
    return vec2(0.93, 0.37 + direction) * (0.15 + 0.62 * gust + 0.08 * flutter);
  }
`;

const contactShader = `
  uniform vec4 footprints[DISC_FOOTPRINT_COUNT];

  void meadowContact(vec2 point, float padding, out float pressed, out float shade, out vec2 outward) {
    pressed = 0.0;
    shade = 0.0;
    outward = vec2(0.0);
    for (int i = 0; i < DISC_FOOTPRINT_COUNT; i++) {
      vec4 footprint = footprints[i];
      if (footprint.z <= 0.001) continue;

      vec2 delta = point - footprint.xy;
      float distanceSquared = dot(delta, delta);
      float lift = footprint.w;
      float flatRadius = footprint.z + padding;
      float riseRadius = flatRadius + 0.63;
      float compression = 1.0 - smoothstep(flatRadius * flatRadius, riseRadius * riseRadius, distanceSquared);
      compression *= mix(1.0, 0.60, lift);
      if (compression > pressed) {
        pressed = compression;
        outward = delta * inversesqrt(max(distanceSquared, 0.04));
      }

      vec2 shadowDelta = (delta - vec2(0.13 + 0.30 * lift, 0.16 + 0.32 * lift)) / footprint.z;
      float outerShadow = mix(1.32, 1.49, lift);
      float innerShadow = mix(0.92, 0.58, lift);
      float shadow = 1.0 - smoothstep(innerShadow * innerShadow, outerShadow * outerShadow, dot(shadowDelta, shadowDelta));
      shade = max(shade, shadow * mix(0.70, 0.42, lift));
    }
  }
`;

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function bladeGeometry() {
  const positions = [];
  const coordinates = [];
  const indices = [];
  const sections = 3;

  // A folded ribbon catches light along the midrib and tapers to the tip.
  for (let row = 0; row < sections; row++) {
    const height = row / sections;
    const halfWidth = (1 - height ** 2.1) * (.40 + height * .21);
    positions.push(-halfWidth, height, 0, 0, height, halfWidth * .40, halfWidth, height, 0);
    coordinates.push(0, height, .5, height, 1, height);
    if (row === 0) continue;
    const start = (row - 1) * 3;
    indices.push(start, start + 1, start + 3, start + 1, start + 4, start + 3,
      start + 1, start + 2, start + 4, start + 2, start + 5, start + 4);
  }
  const lastRow = (sections - 1) * 3;
  const tip = sections * 3;
  positions.push(0, 1, 0);
  coordinates.push(.5, 1);
  indices.push(lastRow, lastRow + 1, tip, lastRow + 1, lastRow + 2, tip);

  return {
    position: new THREE.Float32BufferAttribute(positions, 3),
    uv: new THREE.Float32BufferAttribute(coordinates, 2),
    index: new THREE.Uint16BufferAttribute(indices, 1),
  };
}

function grassMaterial(footprints) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    defines: { DISC_FOOTPRINT_COUNT: footprints.value.length },
    uniforms: {
      time: { value: 0 },
      cursor: { value: new THREE.Vector2() },
      cursorStrength: { value: 0 },
      footprints,
      shadow: { value: new THREE.Color('#15271a') },
      meadow: { value: new THREE.Color('#557944') },
      sunlight: { value: new THREE.Color('#c6d886') },
    },
    vertexShader: `
      attribute vec4 blade;
      attribute vec3 shape;
      uniform float time;
      uniform vec2 cursor;
      uniform float cursorStrength;
      varying float vHeight;
      varying float vCrease;
      varying float vShade;
      varying float vWave;
      varying float vContactShade;
      varying vec2 vRoot;
      ${contactShader}
      ${windShader}

      void main() {
        vec2 root = blade.xy;
        vec2 axis = shape.xy;
        float height = position.y;
        float gust = gustAt(root, time);
        vec2 wind = windAt(root, time, gust);

        vec2 fromCursor = root - cursor;
        float distanceToCursor = length(fromCursor);
        float reach = 1.0 - smoothstep(0.35, 2.75, distanceToCursor);
        vec2 press = fromCursor / max(distanceToCursor, 0.25) * reach * cursorStrength;
        vec2 lengthwise = vec2(axis.y, -axis.x);
        vec2 foldedLeaf = axis * position.x - lengthwise * position.z;
        vec2 lean = lengthwise * (0.28 + 0.88 * blade.w);
        vec2 bend = lean + wind * mix(0.74, 1.14, blade.w) + press * 1.12;
        float bendLength = max(length(bend), 0.001);
        float arc = clamp(bendLength, 0.001, 2.48);
        float swing = arc * height;
        vec2 offset = foldedLeaf * blade.z
          + bend / bendLength * shape.z * (1.0 - cos(swing)) / arc;
        float bladeHeight = shape.z * sin(swing) / arc;

        float pressed;
        vec2 outward;
        meadowContact(root, -0.18 + 0.30 * blade.w, pressed, vContactShade, outward);
        if (pressed > 0.0) {
          // Bend the whole blade from its root around the disc and keep the raised midrib.
          vec2 away = dot(outward, outward) > 0.001 ? normalize(outward) : lengthwise;
          vec2 across = vec2(-away.y, away.x);
          float spread = 0.38 * sin(dot(root, vec2(3.41, 1.73))) + 0.66 * (blade.w - 0.5);
          away = normalize(away + across * spread);
          across = vec2(-away.y, away.x);
          across *= dot(across, axis) < 0.0 ? -1.0 : 1.0;
          float reach = shape.z * height * (0.74 + 0.20 * height);
          vec2 pressedOffset = away * reach + across * position.x * blade.z;
          float pressedHeight = shape.z * height * (0.27 - 0.21 * height) + position.z * blade.z;
          offset = mix(offset, pressedOffset, pressed);
          bladeHeight = mix(bladeHeight, pressedHeight, pressed);
          axis = normalize(mix(axis, across, pressed));
        }
        vec2 plantPosition = root + offset;
        vec3 bent = vec3(plantPosition.x, bladeHeight, plantPosition.y);

        vHeight = uv.y;
        vCrease = uv.x;
        vRoot = root;
        vShade = 0.58 * blade.w + 0.42 * abs(dot(axis, vec2(0.83, 0.56)));
        vWave = gust;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(bent, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 shadow;
      uniform vec3 meadow;
      uniform vec3 sunlight;
      varying float vHeight;
      varying float vCrease;
      varying float vShade;
      varying float vWave;
      varying float vContactShade;
      varying vec2 vRoot;

      void main() {
        float canopy = 0.52 + 0.27 * sin(vRoot.x * 0.55 + vRoot.y * 0.37)
          + 0.17 * sin(vRoot.y * 1.35 - vRoot.x * 0.69);
        float bright = smoothstep(0.24, 0.98, vHeight) * (0.23 + 0.70 * vShade);
        float rib = 1.0 - abs(2.0 * vCrease - 1.0);
        float sunwardFace = 0.75 + 0.25 * smoothstep(0.47, 0.56, vCrease);
        vec3 color = mix(shadow, meadow, 0.16 + 0.26 * canopy + 0.55 * vHeight);
        color = mix(color, sunlight, bright * (0.15 + 0.38 * canopy));
        color *= (0.55 + 0.61 * vShade + 0.18 * rib + 0.13 * vWave * vHeight) * sunwardFace;
        color *= 1.0 - vContactShade * (1.0 - 0.43 * vHeight);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function grassTile(blade, material, left, top, random, perTile) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setIndex(blade.index);
  geometry.setAttribute('position', blade.position);
  geometry.setAttribute('uv', blade.uv);
  const seeds = new Float32Array(perTile * 4);
  const shapes = new Float32Array(perTile * 3);

  for (let index = 0; index < perTile; index++) {
    let x = left + random() * tileWidth;
    let z = top + random() * tileDepth;
    const clumps = Math.sin(x * 2.7 + z * 1.42) * Math.cos(z * 2.98 - x * 1.21);
    if (clumps < -.4 && random() < .66) {
      x = left + random() * tileWidth;
      z = top + random() * tileDepth;
    }
    const grassType = random();
    const thickness = .041 + .127 * grassType + .048 * random();
    const height = .43 + .76 * random() + .48 * grassType;
    const sweep = .8 * Math.sin(x * .95 + z * .43) + .92 * Math.cos(z * 1.36 - x * .48);
    const angle = sweep + (random() - .5) * Math.PI * 1.8;
    seeds.set([x, z, thickness, random()], index * 4);
    shapes.set([Math.cos(angle), Math.sin(angle), height], index * 3);
  }
  geometry.setAttribute('blade', new THREE.InstancedBufferAttribute(seeds, 4));
  geometry.setAttribute('shape', new THREE.InstancedBufferAttribute(shapes, 3));
  geometry.instanceCount = perTile;
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(left + tileWidth / 2, .45, top + tileDepth / 2),
    Math.hypot(tileWidth / 2 + 3, 1.7, tileDepth / 2 + 3)
  );
  return new THREE.Mesh(geometry, material);
}

function meadowFloor(footprints) {
  const geometry = new THREE.PlaneGeometry(width, groundDepth, 192, Math.ceil(groundDepth / .8));
  geometry.rotateX(-Math.PI / 2).translate(0, 0, groundCenter);
  const material = new THREE.ShaderMaterial({
    defines: { DISC_FOOTPRINT_COUNT: footprints.value.length },
    uniforms: {
      footprints,
      shade: { value: new THREE.Color('#182c1d') },
      clearing: { value: new THREE.Color('#405337') },
    },
    vertexShader: `
      varying vec2 vPoint;
      varying float vContactShade;
      ${contactShader}
      void main() {
        vPoint = position.xz;
        float pressed;
        vec2 outward;
        meadowContact(vPoint, 0.0, pressed, vContactShade, outward);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 shade;
      uniform vec3 clearing;
      varying vec2 vPoint;
      varying float vContactShade;

      float fleck(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        float dapple = 0.37 + 0.20 * sin(vPoint.x * 0.48 + vPoint.y * 0.36)
          + 0.13 * sin(vPoint.x * 1.02 - vPoint.y * 1.16);
        dapple += 0.12 * sin(vPoint.x * 4.7 + vPoint.y * 2.18) * cos(vPoint.y * 3.16);
        dapple += (fleck(floor(vPoint * 41.0)) - 0.5) * 0.12;
        gl_FragColor = vec4(mix(shade, clearing, dapple) * (1.0 - vContactShade), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const floor = new THREE.Mesh(geometry, material);
  floor.position.y = -.015;
  return floor;
}

function animateFlowers(material, uniforms) {
  material.defines.DISC_FOOTPRINT_COUNT = uniforms.footprints.value.length;
  material.onBeforeCompile = shader => {
    shader.uniforms.footprints = uniforms.footprints;
    shader.uniforms.flowerTime = uniforms.time;
    shader.uniforms.flowerCursor = uniforms.cursor;
    shader.uniforms.flowerCursorStrength = uniforms.cursorStrength;
    shader.vertexShader = `
      uniform float flowerTime;
      uniform vec2 flowerCursor;
      uniform float flowerCursorStrength;
      varying float vContactShade;
      ${contactShader}
      ${windShader}
      ${shader.vertexShader}`.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec2 root = instanceMatrix[3].xz;
        vec3 plant = (instanceMatrix * vec4(transformed, 1.0)).xyz;
        float stemHeight = max(0.0, plant.y / instanceMatrix[1].y);
        float flex = stemHeight * stemHeight * instanceMatrix[1].y;
        float gust = gustAt(root, flowerTime);
        vec2 fromCursor = root - flowerCursor;
        float distanceToCursor = length(fromCursor);
        float cursorBend = (1.0 - smoothstep(0.25, 2.50, distanceToCursor)) * flowerCursorStrength;
        vec2 wind = 0.31 * windAt(root, flowerTime, gust);
        vec2 bend = fromCursor / max(distanceToCursor, 0.25) * 0.46 * cursorBend;
        vec2 tip = plant.xz + flex * (wind + bend);
        float pressed;
        vec2 outward;
        meadowContact(tip, 1.42, pressed, vContactShade, outward);
        float height = plant.y - flex * (0.07 * gust + 0.30 * cursorBend);
        height = mix(height, min(height, 0.12), pressed);
        vec3 displacement = vec3(tip.x, height, tip.y) - plant;
        // Convert the movement back through the instance's rotation and nonuniform scale.
        vec3 side = instanceMatrix[0].xyz;
        vec3 up = instanceMatrix[1].xyz;
        vec3 front = instanceMatrix[2].xyz;
        transformed += vec3(dot(displacement, side) / dot(side, side),
          dot(displacement, up) / dot(up, up), dot(displacement, front) / dot(front, front));
      `);
    shader.fragmentShader = `varying float vContactShade;
      ${shader.fragmentShader}`.replace('#include <opaque_fragment>', `
        outgoingLight *= 1.0 - vContactShade;
        #include <opaque_fragment>
      `);
  };
}

function tintGeometry(geometry, shadeAtVertex) {
  const positions = geometry.getAttribute('position');
  const color = new THREE.Color();
  const rgb = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    shadeAtVertex(color, positions.getX(i), positions.getY(i), positions.getZ(i));
    color.toArray(rgb, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return geometry;
}

function flowerLeaf(length, span) {
  const geometry = new THREE.PlaneGeometry(1, 1, 7, 4);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const lengthwise = positions.getX(i) + .5;
    const crosswise = positions.getY(i) * 2;
    const taper = Math.sin(lengthwise * Math.PI) ** .86;
    const x = lengthwise * length;
    const y = .18 * lengthwise - .11 * lengthwise ** 2 + .10 * taper * (1 - crosswise ** 2);
    const z = crosswise * span * taper;
    positions.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  const margin = new THREE.Color('#2e4e2d');
  const rib = new THREE.Color('#8eac54');
  return tintGeometry(geometry, (color, x, y, z) => {
    const strength = Math.exp(-Math.abs(z) * 48) * Math.sin(x / length * Math.PI);
    color.copy(margin).lerp(rib, .18 + strength * .66);
  });
}

function flowerStem(path) {
  const stem = new THREE.TubeGeometry(path, 7, .021, 6, false);
  const shade = new THREE.Color('#3e552e');
  const top = new THREE.Color('#86964c');
  tintGeometry(stem, (color, x, y) => color.copy(shade).lerp(top, y * .9));
  const leaves = [
    { at: .34, turn: .62, length: .42, width: .108 },
    { at: .59, turn: 3.62, length: .36, width: .098 },
  ].map(({ at, turn, length, width }) => {
    const point = path.getPoint(at);
    return flowerLeaf(length, width).rotateY(turn).translate(point.x, point.y, point.z);
  });
  const geometry = mergeGeometries([stem, ...leaves]);
  stem.dispose();
  leaves.forEach(leaf => leaf.dispose());
  return geometry;
}

function flowerCrown(tip) {
  const petalCount = 10;
  const petal = new THREE.SphereGeometry(1, 9, 6);
  const positions = petal.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const stretch = (positions.getX(i) + 1) / 2;
    const side = positions.getZ(i);
    const thickness = positions.getY(i) * (.026 + .019 * stretch);
    const curl = .079 * stretch ** 2 + .024 * side ** 2 - .042 * Math.sin(stretch * Math.PI);
    positions.setXYZ(i, .079 + .365 * stretch, thickness + curl,
      side * (.061 + .055 * stretch) + .019 * stretch ** 2);
  }
  petal.computeVertexNormals();
  const throat = new THREE.Color('#b79875');
  const edge = new THREE.Color('#fffdf7');
  tintGeometry(petal, (color, x) => color.copy(throat).lerp(edge, THREE.MathUtils.smoothstep(x, .075, .31)));
  const petals = Array.from({ length: petalCount }, (_, index) => petal.clone()
    .scale(.91 + .12 * Math.sin(index * 12.1), 1 + .11 * Math.cos(index * 8.47), 1)
    .rotateY(index * 2 * Math.PI / petalCount)
    .translate(tip.x, tip.y, tip.z));
  const geometry = mergeGeometries(petals);
  petals.forEach(mesh => mesh.dispose());
  petal.dispose();
  return geometry;
}

function pollenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#a76227';
  context.fillRect(0, 0, 128, 64);
  const random = seededRandom(4197);
  for (let i = 0; i < 310; i++) {
    const x = random() * 128;
    const y = random() * 64;
    const radius = .65 + 1.95 * random();
    const grain = context.createRadialGradient(x - .25 * radius, y - .3 * radius, 0, x, y, radius);
    grain.addColorStop(0, '#fff1a6');
    grain.addColorStop(.45, i % 3 === 0 ? '#ffdb78' : '#e8a24b');
    grain.addColorStop(1, '#9d5e26');
    context.fillStyle = grain;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function wildflowers(uniforms) {
  const group = new THREE.Group();
  const random = seededRandom(68421);
  const pollen = pollenTexture();
  const flowerMaterial = new THREE.MeshStandardMaterial({ roughness: .61, vertexColors: true });
  const stalkMaterial = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .72, vertexColors: true });
  const pollenMaterial = new THREE.MeshStandardMaterial({ map: pollen, bumpMap: pollen, bumpScale: .085, roughness: .72 });
  const materials = [flowerMaterial, stalkMaterial, pollenMaterial];
  materials.forEach(material => animateFlowers(material, uniforms));
  const tip = new THREE.Vector3(.29, 1, -.09);
  const path = new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(-.06, .33, .03),
    new THREE.Vector3(.04, .76, .12), tip);
  const stem = flowerStem(path);
  const petals = flowerCrown(tip);
  const center = new THREE.SphereGeometry(1, 12, 6).scale(.141, .075, .141).translate(tip.x, tip.y + .06, tip.z);
  const colors = ['#fffdf4', '#fffdf8', '#ffedbe', '#fff9ee', '#f9d4e2'].map(color => new THREE.Color(color));
  const pose = new THREE.Object3D();
  const batchSize = 24;
  const batches = new Map();
  let cluster = 0;
  for (let start = groundStart; start < groundEnd; start += batchSize) {
    const span = Math.min(batchSize, groundEnd - start);
    const clusterCount = Math.round(span * 1.12);
    for (let patch = 0; patch < clusterCount; patch++, cluster++) {
      const patchX = Math.sin(cluster * 2.7) * Math.cos(cluster * .53) * width * .335;
      const patchZ = start + 1 + random() * (span - 2);
      for (let i = 0; i < 5; i++) {
        const x = patchX + (random() - .5) * 2.10;
        const z = patchZ + (random() - .5) * 1.65;
        const height = .88 + random() * .79;
        const spread = .66 + .56 * random();
        pose.position.set(x, 0, z);
        pose.rotation.set(0, random() * Math.PI * 2, 0);
        pose.scale.set(spread, height, spread);
        pose.updateMatrix();
        const key = `${Math.floor(x / batchSize)}:${Math.floor(z / batchSize)}`;
        if (!batches.has(key)) batches.set(key, []);
        const color = colors[(cluster + (i === 0 ? 2 : 0)) % colors.length];
        batches.get(key).push({ matrix: pose.matrix.clone(), color });
      }
    }
  }

  for (const placements of batches.values()) {
    const stems = new THREE.InstancedMesh(stem, stalkMaterial, placements.length);
    const blooms = new THREE.InstancedMesh(petals, flowerMaterial, placements.length);
    const centers = new THREE.InstancedMesh(center, pollenMaterial, placements.length);
    placements.forEach(({ matrix, color }, i) => {
      stems.setMatrixAt(i, matrix);
      blooms.setMatrixAt(i, matrix);
      blooms.setColorAt(i, color);
      centers.setMatrixAt(i, matrix);
    });
    // Allow frustum culling while the flowers bend beyond their rest pose.
    for (const mesh of [stems, blooms, centers]) {
      mesh.computeBoundingSphere();
      mesh.boundingSphere.radius += 1.5;
      group.add(mesh);
    }
  }
  return {
    group,
    dispose() {
      group.children.forEach(mesh => mesh.dispose());
      [stem, petals, center].forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      pollen.dispose();
    }
  };
}

export function createDaydreamMeadow(trackCount = 1) {
  const group = new THREE.Group();
  group.position.z = -17;
  group.rotation.x = 1.28;
  group.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, group.position);
  const localFromWorld = group.matrixWorld.clone().invert();
  const target = new THREE.Vector3();
  const footprints = { value: Array.from({ length: Math.max(1, trackCount) }, () => new THREE.Vector4()) };
  const floor = meadowFloor(footprints);
  const material = grassMaterial(footprints);
  const blade = bladeGeometry();
  const random = seededRandom(43720);
  const tiles = [];
  for (let z = groundStart; z < groundEnd; z += tileDepth) {
    for (let x = -width / 2; x < width / 2; x += tileWidth) {
      const detailed = Math.abs(x + tileWidth / 2) < 33;
      tiles.push(grassTile(blade, material, x, z, random, detailed ? 3450 : 2080));
    }
  }
  const flowers = wildflowers(material.uniforms);
  const flyingDaisies = createFlyingDaisies(footprints);
  group.add(floor, ...tiles, flowers.group, flyingDaisies.group);

  let lastTime;
  return {
    group,
    plane,
    setDiscFootprint(index, position, radius = 0, lift = 0) {
      const footprint = footprints.value[index];
      if (!footprint) return;
      if (position) {
        target.copy(position).applyMatrix4(localFromWorld);
        footprint.set(target.x, target.z, radius, lift);
      } else {
        footprint.z = 0;
      }
    },
    update(time, pointer, reduced) {
      const uniforms = material.uniforms;
      uniforms.time.value = reduced ? 0 : time;
      flyingDaisies.update(time, reduced);
      const elapsed = Math.min(Math.max(0, time - (lastTime ?? time)), .05);
      const shouldBend = pointer && !reduced;
      const damping = 1 - Math.exp(-elapsed * (shouldBend ? 16 : 3.2));
      if (shouldBend) {
        target.copy(pointer).applyMatrix4(localFromWorld);
        const position = uniforms.cursor.value;
        if (uniforms.cursorStrength.value < .05) position.set(target.x, target.z);
        position.x = THREE.MathUtils.lerp(position.x, target.x, damping);
        position.y = THREE.MathUtils.lerp(position.y, target.z, damping);
      }
      uniforms.cursorStrength.value = reduced ? 0 : THREE.MathUtils.lerp(uniforms.cursorStrength.value, shouldBend ? 1 : 0, damping);
      lastTime = time;
    },
    dispose() {
      floor.geometry.dispose();
      floor.material.dispose();
      tiles.forEach(tile => tile.geometry.dispose());
      material.dispose();
      flowers.dispose();
      flyingDaisies.dispose();
    },
  };
}
