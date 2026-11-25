import * as THREE from 'three';
import { groundCenter, groundDepth, groundStart } from './world-ground.js';

const width = 156;
const interactionGLSL = `
  uniform vec4 footprints[DISC_FOOTPRINT_COUNT];
  uniform vec2 cursor;
  uniform float cursorStrength;

  vec2 discContact(vec2 point, float padding) {
    vec2 contact = vec2(0.0);
    for (int i = 0; i < DISC_FOOTPRINT_COUNT; i++) {
      vec4 disc = footprints[i];
      if (disc.z <= 0.001) continue;

      vec2 delta = point - disc.xy;
      float radius = disc.z + padding;
      contact.x = max(contact.x, 1.0 - smoothstep(radius - 0.25, radius + 0.58, length(delta)));

      float lift = disc.w;
      vec2 offset = vec2(0.16, 0.20) + lift * vec2(0.28, 0.26);
      float distanceToShadow = length((delta - offset) / disc.z);
      float shadow = 1.0 - smoothstep(mix(0.82, 0.53, lift), mix(1.31, 1.56, lift), distanceToShadow);
      contact.y = max(contact.y, shadow * mix(0.76, 0.51, lift));
    }
    return contact;
  }

  float cursorLight(vec2 point) {
    vec2 distanceToCursor = point - cursor;
    return exp(-dot(distanceToCursor, distanceToCursor) * 0.16) * cursorStrength;
  }
`;

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function crystalGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const coordinates = [];
  const tiers = [
    { height: 0, radius: .66, lean: 0 },
    { height: .11, radius: 1, lean: .06 },
    { height: .69, radius: .89, lean: .19 },
    { height: 1, radius: .02, lean: .36 },
  ];
  const sides = 6;
  const angleOf = index => index * Math.PI * 2 / sides;
  function vertex(side, row, u) {
    const angle = angleOf(side);
    const { radius, height, lean } = tiers[row];
    positions.push(Math.cos(angle) * radius + lean, height, Math.sin(angle) * radius);
    coordinates.push(u, height);
  }
  for (let side = 0; side < sides; side++) {
    for (let row = 1; row < tiers.length; row++) {
      vertex(side, row - 1, 0);
      vertex(side, row, 0);
      vertex(side + 1, row, 1);
      vertex(side, row - 1, 0);
      vertex(side + 1, row, 1);
      vertex(side + 1, row - 1, 1);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function crystalFloor(uniforms) {
  const geometry = new THREE.PlaneGeometry(width, groundDepth, 240, Math.ceil(groundDepth * 104 / 68))
    .rotateX(-Math.PI / 2)
    .translate(0, 0, groundCenter);
  const material = new THREE.ShaderMaterial({
    defines: { DISC_FOOTPRINT_COUNT: uniforms.footprints.value.length },
    uniforms: {
      ...uniforms,
      basalt: { value: new THREE.Color('#1a1026') },
      sediment: { value: new THREE.Color('#5c294d') },
      quartz: { value: new THREE.Color('#f47eb5') },
    },
    vertexShader: `
      varying vec2 vGround;
      varying float vShadow;
      ${interactionGLSL}

      void main() {
        vGround = position.xz;
        vShadow = discContact(vGround, 0.0).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 basalt;
      uniform vec3 sediment;
      uniform vec3 quartz;
      varying vec2 vGround;
      varying float vShadow;
      ${interactionGLSL}

      vec2 hashCell(vec2 value) {
        vec3 p = fract(value.xyx * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yzx + 33.33);
        return fract((p.xx + p.yz) * p.zy);
      }

      float fracture(vec2 point) {
        vec2 cell = floor(point);
        vec2 center = fract(point);
        float nearest = 8.0;
        float next = 8.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 difference = offset + hashCell(cell + offset) * 0.78 + 0.11 - center;
            float squared = dot(difference, difference);
            next = min(next, max(nearest, squared));
            nearest = min(nearest, squared);
          }
        }
        return next - nearest;
      }

      void main() {
        vec2 point = vGround;
        float firstBand = sin(point.x * 0.47 + point.y * 0.31 + sin(point.y * 0.42));
        float secondBand = sin(point.x * 1.25 - point.y * 0.78);
        float strata = 0.37 + firstBand * 0.16 + secondBand * 0.11;
        vec2 grain = hashCell(floor(point * 51.0));
        float fleck = smoothstep(0.96, 1.0, grain.x) * grain.y;
        float seam = fracture(point * vec2(0.54, 0.67));
        float hairline = 1.0 - smoothstep(0.008, 0.032, seam);
        float lightLeak = 1.0 - smoothstep(0.023, 0.18, seam);
        float glow = cursorLight(point);
        float deposits = smoothstep(-0.88, 0.76, firstBand + secondBand * 0.41);

        vec3 color = mix(basalt, sediment, strata + (grain.y - 0.5) * 0.11);
        color += quartz * (hairline * (0.10 + deposits * 0.18) + lightLeak * 0.06 + fleck * 0.17);
        color += quartz * glow * (0.09 + lightLeak * 0.28 + hairline * 0.50);
        color *= 1.0 - vShadow;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const floor = new THREE.Mesh(geometry, material);
  floor.position.y = -.025;
  return floor;
}

function crystalClusters(uniforms) {
  const random = seededRandom(59103);
  const scatterDepth = groundDepth - 3;
  const centralCount = Math.round(150 * scatterDepth / 40);
  const outerCount = Math.round(90 * scatterDepth / 65);
  const clusters = Array.from({ length: centralCount + outerCount }, (_, index) => {
    const central = index < centralCount;
    return {
      x: (random() - .5) * (central ? 76 : width - 3),
      z: groundStart + 1.5 + random() * scatterDepth,
      size: .36 + random() ** 1.7 * 1.5,
      count: 3 + Math.floor(random() * 5),
      shade: Math.floor(random() * 5),
    };
  });
  const geometry = crystalGeometry();
  const material = new THREE.MeshPhysicalMaterial({
    color: '#fff4fd',
    roughness: .33,
    metalness: .25,
    clearcoat: .95,
    clearcoatRoughness: .17,
    iridescence: .27,
    envMapIntensity: 1.22,
  });
  material.defines.DISC_FOOTPRINT_COUNT = uniforms.footprints.value.length;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `
      varying vec4 vQuartz;
      ${interactionGLSL}
      ${shader.vertexShader}
    `.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec2 root = instanceMatrix[3].xz;
      vec2 contact = discContact(root, 0.87);
      transformed.y *= 1.0 - contact.x;
      transformed.y -= 0.14 * contact.x / max(instanceMatrix[1].y, 0.05);
      vQuartz = vec4(uv.xy, contact.y, cursorLight(root));
    `);
    shader.fragmentShader = `
      varying vec4 vQuartz;
      ${shader.fragmentShader}
    `.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      float facet = 1.0 - smoothstep(0.026, 0.085, min(vQuartz.x, 1.0 - vQuartz.x));
      float tip = smoothstep(0.70, 0.99, vQuartz.y);
      float mineralBand = sin(vQuartz.y * 83.0 + vQuartz.x * 7.0) * 0.035;
      diffuseColor.rgb *= 0.63 + vQuartz.y * 0.48 + mineralBand;
      totalEmissiveRadiance += diffuseColor.rgb * (0.22 + tip * 0.46 + facet * 0.24 + vQuartz.w * 0.89);
    `).replace('#include <opaque_fragment>', `
      outgoingLight *= 1.0 - vQuartz.z * 0.79;
      #include <opaque_fragment>
    `);
  };
  const count = clusters.reduce((total, cluster) => total + cluster.count, 0);
  const crystals = new THREE.InstancedMesh(geometry, material, count);
  const colors = ['#e764ad', '#af68d5', '#fc8bb7', '#a94c87', '#e3a5dd']
    .map(value => new THREE.Color(value));
  const glow = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      defines: { DISC_FOOTPRINT_COUNT: uniforms.footprints.value.length },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: `
        varying vec2 vHalo;
        varying vec3 vTint;
        varying float vPresence;
        ${interactionGLSL}
        void main() {
          vHalo = uv * 2.0 - 1.0;
          vTint = instanceColor;
          vec2 root = instanceMatrix[3].xz;
          vPresence = (1.0 - discContact(root, 0.2).x) * (0.32 + 0.34 * cursorLight(root));
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vHalo;
        varying vec3 vTint;
        varying float vPresence;
        void main() {
          float spread = dot(vHalo, vHalo);
          float light = exp(-spread * 5.3) * (1.0 - smoothstep(0.58, 1.0, spread));
          gl_FragColor = vec4(vTint, light * vPresence);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
    clusters.length
  );
  const dummy = new THREE.Object3D();
  let piece = 0;
  clusters.forEach((cluster, index) => {
    const { x, z, size, count, shade } = cluster;
    for (let crystal = 0; crystal < count; crystal++) {
      const core = crystal === 0;
      const angle = crystal * 2.39996 + index;
      const spacing = core ? 0 : (.26 + random() * .68) * size;
      const radius = (.10 + random() * .16) * size;
      const height = size * (core ? .8 + random() * .47 : .22 + random() * .53);
      dummy.position.set(x + Math.cos(angle) * spacing, -.08, z + Math.sin(angle) * spacing);
      dummy.rotation.set(Math.sin(angle) * .32, angle, Math.cos(angle) * .32);
      dummy.scale.set(radius, height, radius * (.66 + random() * .59));
      dummy.updateMatrix();
      crystals.setMatrixAt(piece, dummy.matrix);
      crystals.setColorAt(piece, colors[(shade + (core ? 0 : crystal % 3)) % colors.length]);
      piece++;
    }

    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, index * 0.61, 0);
    dummy.scale.set(3.34 * size, 1, 2.52 * size);
    dummy.updateMatrix();
    glow.setMatrixAt(index, dummy.matrix);
    glow.setColorAt(index, colors[shade]);
  });
  crystals.computeBoundingSphere();
  glow.computeBoundingSphere();
  return [crystals, glow];
}

function crystalDust(uniforms) {
  const random = seededRandom(20477);
  const count = Math.round(580 * groundDepth / 53);
  const positions = new Float32Array(count * 3);
  const flecks = new Float32Array(count * 2);
  for (let index = 0; index < count; index++) {
    positions.set([
      (random() - .5) * 105,
      .12 + random() ** 2 * 3.7,
      groundStart + random() * groundDepth,
    ], index * 3);
    flecks.set([random() * Math.PI * 2, .47 + random() ** 3 * 1.83], index * 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('fleck', new THREE.BufferAttribute(flecks, 2));
  const material = new THREE.ShaderMaterial({
    defines: { DISC_FOOTPRINT_COUNT: uniforms.footprints.value.length },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      ...uniforms,
      pixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      pink: { value: new THREE.Color('#f89ed2') },
      pearl: { value: new THREE.Color('#ffedf8') },
    },
    vertexShader: `
      uniform float time;
      uniform float pixelRatio;
      attribute vec2 fleck;
      varying float vShimmer;
      varying float vLight;
      ${interactionGLSL}

      void main() {
        vec3 point = position;
        float phase = fleck.x + time * 0.57;
        point.xz += vec2(cos(phase), sin(phase * 1.12)) * 0.38;
        point.y += sin(phase * 1.8) * 0.1;
        vLight = cursorLight(point.xz);
        vShimmer = (0.49 + sin(phase * 2.4) * 0.32) * (1.0 - discContact(point.xz, -0.35).x * 0.87);
        vec4 view = modelViewMatrix * vec4(point, 1.0);
        gl_PointSize = min(7.5, (fleck.y + vLight * 0.85) * max(0.58, 27.0 / -view.z) * pixelRatio);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform vec3 pink;
      uniform vec3 pearl;
      varying float vShimmer;
      varying float vLight;

      void main() {
        vec2 point = gl_PointCoord * 2.0 - 1.0;
        float spot = exp(-dot(point, point) * 4.4);
        gl_FragColor = vec4(mix(pink, pearl, min(1.0, vShimmer + vLight)), spot * (vShimmer + vLight * 0.6));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return new THREE.Points(geometry, material);
}

export function createEuphoriaCrystals(trackCount = 1) {
  const group = new THREE.Group();
  group.position.z = -17;
  group.rotation.x = 1.28;
  group.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, group.position);
  const localFromWorld = group.matrixWorld.clone().invert();
  const target = new THREE.Vector3();
  const uniforms = {
    footprints: { value: Array.from({ length: Math.max(1, trackCount) }, () => new THREE.Vector4()) },
    cursor: { value: new THREE.Vector2() },
    cursorStrength: { value: 0 },
    time: { value: 0 },
  };
  group.add(crystalFloor(uniforms), ...crystalClusters(uniforms), crystalDust(uniforms));

  let lastTime;
  return {
    group,
    plane,
    setDiscFootprint(index, position, radius = 0, lift = 0) {
      const footprint = uniforms.footprints.value[index];
      if (!footprint) return;
      if (position) {
        target.copy(position).applyMatrix4(localFromWorld);
        footprint.set(target.x, target.z, radius, lift);
      } else {
        footprint.z = 0;
      }
    },
    update(time, pointer, reduced) {
      uniforms.time.value = reduced ? 0 : time;
      const elapsed = Math.min(Math.max(0, time - (lastTime ?? time)), .05);
      const active = pointer && !reduced;
      const damping = 1 - Math.exp(-elapsed * (active ? 17 : 5));
      if (active) {
        target.copy(pointer).applyMatrix4(localFromWorld);
        const cursor = uniforms.cursor.value;
        if (uniforms.cursorStrength.value < .04) cursor.set(target.x, target.z);
        cursor.x = THREE.MathUtils.lerp(cursor.x, target.x, damping);
        cursor.y = THREE.MathUtils.lerp(cursor.y, target.z, damping);
      }
      uniforms.cursorStrength.value = reduced ? 0 : THREE.MathUtils.lerp(uniforms.cursorStrength.value, active ? 1 : 0, damping);
      lastTime = time;
    },
    dispose() {
      group.children.forEach(mesh => {
        mesh.dispose?.();
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
    },
  };
}
