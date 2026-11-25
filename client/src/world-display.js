import * as THREE from 'three';

const fullTurn = Math.PI * 2;
const goldenAngle = 2.399963;
const floorY = -.034;
const palette = [
  { base: '#233c35', trim: '#a8ba76', light: '#dddda2' },
  { base: '#323e58', trim: '#87bfd7', light: '#bcf0ff' },
  { base: '#4d263f', trim: '#d177a0', light: '#ffa6d8' },
  { base: '#52392f', trim: '#c69c62', light: '#ffd49c' },
];

const profile = (points, segments = 96) => new THREE.LatheGeometry(
  points.map(([radius, height]) => new THREE.Vector2(radius, height)), segments
);

const pedestal = profile([[0, -.2], [1.24, -.2], [1.31, -.185], [1.36, -.132], [1.365, -.092], [1.33, -.047], [1.28, floorY], [0, floorY]]);
const outerTrim = new THREE.TorusGeometry(1.346, .012, 12, 128);
const fineRing = new THREE.TorusGeometry(1, .007, 10, 128);
const tick = new THREE.BoxGeometry(.05, .008, .011);
const pearl = new THREE.SphereGeometry(1, 12, 8);
const stem = new THREE.CylinderGeometry(.008, .011, 1, 7);
const crystal = profile([[0, 0], [.40, 0], [.54, .2], [.44, .73], [.08, .98], [0, 1.04]], 6);
const crystalPebble = new THREE.IcosahedronGeometry(1, 0);
const post = profile([[0, 0], [.095, 0], [.112, .04], [.107, .91], [.094, .985], [.072, 1], [0, 1]], 16);

function createBladeGeometry() {
  const positions = [];
  const indices = [];
  for (let step = 0; step <= 8; step++) {
    const t = step / 8;
    const width = .06 * Math.pow(1 - t, .85) + .001;
    const bend = t * t * .33;
    positions.push(-width, t, bend, 0, t, bend + width * .31, width, t, bend);
    if (step === 0) continue;
    const a = (step - 1) * 3;
    indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3,
      a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const grassBlade = createBladeGeometry();

function scatter(group, geometry, material, count, placement) {
  const batch = new THREE.InstancedMesh(geometry, material, count);
  const pose = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    pose.position.set(0, 0, 0);
    pose.rotation.set(0, 0, 0);
    pose.scale.setScalar(1);
    const color = placement(pose, i);
    pose.updateMatrix();
    batch.setMatrixAt(i, pose.matrix);
    batch.setColorAt(i, color);
  }
  group.add(batch);
}

function atRadius(object, angle, radius, y) {
  object.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
}

function circularTrim(group, geometry, material, y, scale = 1) {
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = y;
  ring.scale.setScalar(scale);
  group.add(ring);
}

function growGarden(group, makeMaterial) {
  const greens = ['#779056', '#44653d', '#879d58', '#a3ac6d', '#4c7650'].map(color => new THREE.Color(color));
  const leaves = makeMaterial({ roughness: .56, side: THREE.DoubleSide });
  scatter(group, grassBlade, leaves, 210, (blade, i) => {
    const clump = Math.floor(i / 5);
    const angle = clump * goldenAngle + Math.sin(i * 4.8) * .045;
    const radius = 1.16 + (clump % 7) * .023 + Math.cos(i * 2.5) * .034;
    const height = .10 + .28 * Math.pow(.5 + .5 * Math.sin(i * 4.1), 1.7);
    atRadius(blade, angle, radius, floorY);
    blade.rotation.set(.04, -angle + Math.sin(i) * .9, Math.sin(i * 3.8) * .42);
    blade.scale.set(.22 + (i % 5) * .07, height, height);
    return greens[i % greens.length];
  });

  const flowers = 13;
  const stems = makeMaterial({ roughness: .54 });
  const petals = makeMaterial({ roughness: .43, metalness: .04, clearcoat: .18 });
  const blossomColors = ['#ffd5e2', '#ffe6bd', '#efb0c7'].map(color => new THREE.Color(color));
  const nectar = new THREE.Color('#e9bc68');
  const flowerAngle = i => i * goldenAngle + .31;
  const flowerRadius = i => 1.165 + (i % 5) * .038;
  const flowerHeight = i => .115 + (i % 4) * .029;
  scatter(group, stem, stems, flowers, (object, i) => {
    const height = flowerHeight(i);
    atRadius(object, flowerAngle(i), flowerRadius(i), floorY + height / 2);
    object.scale.y = height;
    return greens[1];
  });
  scatter(group, pearl, petals, flowers * 5, (object, i) => {
    const blossom = Math.floor(i / 5);
    const turn = (i % 5) * fullTurn / 5 + blossom;
    atRadius(object, flowerAngle(blossom), flowerRadius(blossom), floorY + flowerHeight(blossom));
    object.position.x += Math.cos(turn) * .028;
    object.position.y += .012;
    object.position.z += Math.sin(turn) * .028;
    object.rotation.set(.21, -turn, 0);
    object.scale.set(.033, .011, .018);
    return blossomColors[blossom % blossomColors.length];
  });
  scatter(group, pearl, petals, flowers, (object, i) => {
    atRadius(object, flowerAngle(i), flowerRadius(i), floorY + flowerHeight(i) + .019);
    object.scale.set(.020, .014, .020);
    return nectar;
  });
}

function growCrystals(group, makeMaterial) {
  const colors = ['#d2e9fa', '#808ccc', '#93d9e2', '#b7a8de', '#e0e9ff'].map(color => new THREE.Color(color));
  const ice = makeMaterial({ roughness: .22, metalness: .18, clearcoat: 1, clearcoatRoughness: .12, flatShading: true });
  scatter(group, crystal, ice, 42, (object, i) => {
    const cluster = Math.floor(i / 3);
    const angle = cluster * goldenAngle + (i % 3 - 1) * .054;
    const radius = 1.19 + (i % 3 - 1) * .060;
    const height = (.155 + .32 * Math.pow(.5 + .5 * Math.sin(cluster * 2.6), 2)) * (i % 3 === 1 ? 1 : .62);
    atRadius(object, angle, radius, floorY - .006);
    object.rotation.set(Math.cos(i * 1.3) * .36, angle, Math.sin(i * 1.6) * .43);
    object.scale.set(.115 + height * .22, height, .115 + height * .18);
    return colors[i % colors.length];
  });
  scatter(group, crystalPebble, ice, 46, (object, i) => {
    const radius = 1.13 + (i % 6) * .035;
    const size = .026 + (i % 5) * .014;
    atRadius(object, i * goldenAngle, radius, floorY + size * .32);
    object.rotation.set(i, i * .7, i * .31);
    object.scale.set(size * 1.4, size, size * .86);
    return colors[i % colors.length];
  });
}

function buildWaveform(group, makeMaterial) {
  const colors = ['#ab54a6', '#ff9ab7', '#c88de1', '#f39b76', '#783dac'].map(color => new THREE.Color(color));
  const crowns = ['#ff9cce', '#ffc5dc', '#d1abff', '#ffca9a', '#c699ff'].map(color => new THREE.Color(color));
  const metal = makeMaterial({ roughness: .25, metalness: .53, clearcoat: .65 });
  const caps = makeMaterial({ roughness: .16, metalness: .24, clearcoat: 1 });
  const count = 30;
  const height = i => .05 + .34 * Math.pow(.5 + .5 * Math.sin(i * .86 + .65 * Math.cos(i * .38)), 2);
  scatter(group, post, metal, count, (object, i) => {
    atRadius(object, i * fullTurn / count, 1.224, floorY);
    object.scale.set(.81, height(i), .81);
    return colors[i % colors.length];
  });
  scatter(group, pearl, caps, count, (object, i) => {
    atRadius(object, i * fullTurn / count, 1.224, floorY + height(i));
    object.scale.set(.052, .013, .052);
    return crowns[i % crowns.length];
  });
}

function engraveRings(group, trim, makeMaterial) {
  for (let i = 0; i < 5; i++) circularTrim(group, fineRing, trim, floorY + .003, 1.103 + i * .043);
  const stamps = makeMaterial({ roughness: .28, metalness: .63 });
  const brass = new THREE.Color('#f2c184');
  const bronze = new THREE.Color('#9e744e');
  scatter(group, tick, stamps, 72, (object, i) => {
    const angle = i * fullTurn / 72;
    atRadius(object, angle, 1.238, floorY + .016);
    object.rotation.y = -angle;
    object.scale.x = i % 6 === 0 ? 2.05 : .72;
    return i % 6 === 0 ? brass : bronze;
  });
}

function createMoteTexture() {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const distance = Math.hypot((i % size - 15.5) / 15.5, (Math.floor(i / size) - 15.5) / 15.5);
    const alpha = Math.pow(Math.max(0, 1 - distance), 2.3);
    data.set([255, 255, 255, Math.round(255 * alpha)], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

const moteTexture = createMoteTexture();

export function createWorldDisplay(index) {
  const group = new THREE.Group();
  const materials = [];
  const makeMaterial = options => {
    const material = new THREE.MeshPhysicalMaterial(options);
    materials.push(material);
    return material;
  };
  const { base, trim, light } = palette[index];
  const platform = new THREE.Mesh(pedestal, makeMaterial({ color: base, metalness: .42, roughness: .3, clearcoat: .38 }));
  group.add(platform);

  const accent = makeMaterial({
    color: trim, metalness: .59, roughness: .25, emissive: light, emissiveIntensity: .07, clearcoat: .65,
  });
  circularTrim(group, outerTrim, accent, -.108);
  circularTrim(group, fineRing, accent, -.14, 1.343);
  if (index === 0) growGarden(group, makeMaterial);
  if (index === 1) growCrystals(group, makeMaterial);
  if (index === 2) buildWaveform(group, makeMaterial);
  if (index === 3) engraveRings(group, accent, makeMaterial);

  const moteGeometry = new THREE.BufferGeometry();
  const motePositions = new Float32Array((index === 1 ? 66 : 39) * 3);
  for (let i = 0; i < motePositions.length / 3; i++) {
    const angle = i * goldenAngle;
    const radius = .60 + (i % 11) * .094;
    const height = ((i * .271) % 1) ** 1.65 * (index === 1 ? 2.65 : 2.05);
    motePositions.set([Math.cos(angle) * radius, height, Math.sin(angle) * radius], i * 3);
  }
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMaterial = new THREE.PointsMaterial({
    map: moteTexture, color: light, size: index === 1 ? .074 : .062,
    transparent: true, opacity: .18, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(moteGeometry, moteMaterial);
  group.add(motes);

  return {
    group,
    update(active, time, damping) {
      accent.emissiveIntensity = THREE.MathUtils.lerp(accent.emissiveIntensity, active ? .32 : .08, damping);
      moteMaterial.opacity = THREE.MathUtils.lerp(moteMaterial.opacity, active ? .82 : .30, damping);
      motes.position.y = Math.sin(time * .70 + index) * .095;
      motes.rotation.y = .25 * Math.sin(time * .27 + index);
    },
    dispose() {
      group.traverse(child => {
        if (child.isInstancedMesh) child.dispose();
      });
      materials.forEach(material => material.dispose());
      moteGeometry.dispose();
      moteMaterial.dispose();
    },
  };
}
