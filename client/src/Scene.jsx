import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { createWorldDisplay } from './world-display.js';
import { createDaydreamMeadow } from './daydream-meadow.js';
import { createBlueHourSnow } from './blue-hour-snow.js';
import { createEuphoriaCrystals } from './euphoria-crystals.js';
import { createRewindGold } from './rewind-gold.js';
import { createFeaturedStars } from './featured-stars.js';
import { artUrl, loadDisc } from './disc-art.js';

const worldEnvironments = {
  1: createDaydreamMeadow,
  2: createBlueHourSnow,
  3: createEuphoriaCrystals,
  4: createRewindGold,
  featured: createFeaturedStars,
};

const rimGeometry = new THREE.TorusGeometry(.985, .031, 12, 128);
const featuredRimGeometry = new THREE.TorusGeometry(.985, .041, 16, 128);
const hubGeometry = new THREE.TorusGeometry(.118, .012, 8, 64);
const faceGeometry = new THREE.RingGeometry(.113, .988, 128);
const rimMaterial = new THREE.MeshPhysicalMaterial({
  color: '#e0c9da', metalness: .8, roughness: .2, clearcoat: .52, iridescence: .24
});
const plinthGeometry = new THREE.CylinderGeometry(1.10, 1.14, .13, 96);
const trimGeometry = new THREE.CylinderGeometry(1.08, 1.10, .025, 96);
const plinthRingGeometry = new THREE.TorusGeometry(1.04, .009, 10, 96);
const plinthMaterial = new THREE.MeshStandardMaterial({ color: '#3e324c', roughness: .33, metalness: .48 });
const contactGeometry = new THREE.PlaneGeometry(1.95, 1.35);
const worldHitGeometry = new THREE.SphereGeometry(1.14, 24, 16);
const discHitGeometry = new THREE.CircleGeometry(1.1, 64);
const worldHitMaterial = new THREE.MeshBasicMaterial({ visible: false });
const worldTurnSpeed = Math.PI * 2 / 4.6;
const materials = new Map();
const discTime = { value: 0 };
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

let discBacking;
let studioMap;
let contactMaterial;

function getStudioMap() {
  if (studioMap) return studioMap;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#382b43';
  ctx.fillRect(0, 0, 512, 256);
  const softboxes = [
    [112, 75, 78, 48, '#fff3ed'],
    [332, 116, 40, 78, '#bbd9ff'],
    [455, 80, 51, 27, '#ffc1dd'],
    [201, 188, 74, 22, '#836bae'],
  ];
  for (const [x, y, width, height, color] of softboxes) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(width, height);
    const gradient = ctx.createRadialGradient(0, 0, .16, 0, 0, 1);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  studioMap = new THREE.CanvasTexture(canvas);
  studioMap.colorSpace = THREE.SRGBColorSpace;
  studioMap.mapping = THREE.EquirectangularReflectionMapping;
  return studioMap;
}

function getContactMaterial() {
  if (contactMaterial) return contactMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, '#1c0d27ac');
  gradient.addColorStop(.38, '#1c0d2754');
  gradient.addColorStop(1, '#1c0d2700');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  contactMaterial = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  return contactMaterial;
}

function getDiscBacking() {
  if (discBacking) return discBacking;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 768;
  const ctx = canvas.getContext('2d');
  ctx.translate(384, 384);
  const foil = ctx.createConicGradient(-.65, 0, 0);
  [
    [0, '#bcb5cc'], [.12, '#edf4ff'], [.22, '#c0b8e8'], [.31, '#d8c7cc'],
    [.38, '#ffe9b6'], [.43, '#e6fad3'], [.5, '#b6e3ec'], [.59, '#a9b2ca'],
    [.72, '#eef3ff'], [.79, '#dfb9db'], [.86, '#b2e3ef'], [1, '#bcb5cc'],
  ].forEach(([offset, color]) => foil.addColorStop(offset, color));
  ctx.fillStyle = foil;
  ctx.fillRect(-384, -384, 768, 768);

  const ring = (radius, width, color) => {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  for (let radius = 106; radius < 370; radius += 2) {
    ring(radius, 1, radius % 6 === 0 ? '#4034521a' : '#ffffff39');
  }
  ring(361, 1.5, '#51476150');
  ring(375, 4, '#fff9');
  ring(81, 43, '#bcc2d6');
  ring(105, 3, '#554b6c65');
  ring(58, 4, '#fff9');
  for (let bar = 0; bar < 84; bar++) {
    const start = bar * .019 - 2.36;
    ctx.beginPath();
    ctx.moveTo(83 * Math.cos(start), 83 * Math.sin(start));
    const end = bar % 3 === 0 ? 98 : 93;
    ctx.lineTo(end * Math.cos(start), end * Math.sin(start));
    ctx.strokeStyle = '#49465c80';
    ctx.lineWidth = bar % 4 === 0 ? 1.4 : .65;
    ctx.stroke();
  }
  ctx.fillStyle = '#49465c';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SONARA · DISC MASTER', 0, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  discBacking = new THREE.MeshPhysicalMaterial({
    map: texture, emissive: '#aca4be', emissiveMap: texture, emissiveIntensity: .24,
    metalness: .61, roughness: .24, clearcoat: .7, clearcoatRoughness: .18,
    iridescence: .42, iridescenceThicknessRange: [140, 365], envMapIntensity: 1.35
  });
  return discBacking;
}

function addDiscReflection(shader) {
  shader.uniforms.discTime = discTime;
  shader.vertexShader = `varying vec2 vDiscFace;
    ${shader.vertexShader}`.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vDiscFace = position.xy;
    `);
  shader.fragmentShader = `uniform float discTime;
    varying vec2 vDiscFace;
    ${shader.fragmentShader}`.replace('#include <opaque_fragment>', `
      // A narrow reflection travels across the foil as the disc and camera move.
      vec2 eye = normalize(vViewPosition).xy;
      vec2 axis = normalize(vec2(0.72, -0.69) + normal.xy * 0.23);
      float sweep = dot(vDiscFace, axis) + dot(normal.xy, axis) * 0.72
        + dot(eye, axis) * 0.55 + 0.50 * sin(discTime * 0.65);
      float glint = exp(-110.25 * sweep * sweep);
      float softEdge = sweep + 0.09;
      float reflection = exp(-10.89 * softEdge * softEdge);
      float hue = smoothstep(-0.8, 0.9, dot(vDiscFace, vec2(0.45, 0.9)));
      vec3 foil = mix(vec3(0.71, 0.83, 1.0), vec3(1.0, 0.77, 0.90), hue);
      // Roll off the studio-light highlights so they leave the printed titles legible.
      vec3 printed = totalDiffuse + totalEmissiveRadiance;
      vec3 shine = max(outgoingLight - printed, vec3(0.0));
      float peak = max(max(shine.r, shine.g), shine.b);
      outgoingLight = printed + shine / (1.0 + 9.0 * peak)
        + foil * (reflection * 0.031 + glint * 0.069);
      #include <opaque_fragment>
    `);
}

function createDisc(track, { featured, onGround, detailed, raisedRim }) {
  const { texture } = loadDisc(track, detailed, featured);
  const variant = featured ? 'featured' : onGround ? 'gallery' : 'pastel';
  const key = `${variant}:${track.id}`;
  if (!materials.has(key)) {
    const material = new THREE.MeshPhysicalMaterial({
      map: texture,
      alphaTest: .2,
      emissive: '#fff8fb',
      emissiveMap: texture,
      ...(featured ? {
        emissiveIntensity: .39, roughness: .36, metalness: .30, clearcoat: .8,
        clearcoatRoughness: .21, iridescence: .25, envMapIntensity: .92,
      } : {
        emissiveIntensity: onGround ? .21 : .36, roughness: onGround ? .62 : .43,
        metalness: .16, clearcoat: onGround ? .14 : .49, clearcoatRoughness: .25,
        envMapIntensity: onGround ? .55 : .8,
      }),
    });
    if (featured) material.onBeforeCompile = addDiscReflection;
    materials.set(key, material);
  }
  const disc = new THREE.Group();
  const face = new THREE.Mesh(faceGeometry, materials.get(key));
  face.position.z = raisedRim ? .039 : .021;
  const back = new THREE.Mesh(faceGeometry, getDiscBacking());
  back.position.z = -face.position.z;
  back.rotation.y = Math.PI;
  const hub = new THREE.Mesh(hubGeometry, rimMaterial);
  if (raisedRim) hub.scale.z = 3.3;
  disc.add(face, back, new THREE.Mesh(raisedRim ? featuredRimGeometry : rimGeometry, rimMaterial), hub);
  return disc;
}

function gallerySlots(count, width, height, aligned) {
  if (!count) return [];
  const usableWidth = Math.min(width * .88, height * 1.95);
  const usableHeight = height * .86;
  let columns = 1;
  let best = 0;
  for (let c = 1; c <= Math.min(count, aligned ? 8 : width < 600 ? 2 : 3); c++) {
    const rows = Math.ceil(count / c);
    const cell = Math.min(usableWidth / c, usableHeight / rows);
    const score = cell * (1 - .025 * (c * rows - count) / count);
    if (score > best) { best = score; columns = c; }
  }
  const rows = Math.ceil(count / columns);
  const columnWidth = usableWidth / columns;
  const rowHeight = usableHeight / rows;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const columnsInRow = Math.min(columns, count - row * columns);
    const variation = aligned ? 1 : .77 + .23 * ((index * 7) % 5) / 4;
    return {
      x: (col - (columnsInRow - 1) / 2) * columnWidth + (aligned ? 0 : Math.sin(index * 2.39) * best * .13),
      y: ((rows - 1) / 2 - row) * rowHeight + (aligned ? 0 : Math.cos(index * 3.13) * best * .075),
      radius: Math.min(best * (aligned ? .34 : .40), aligned ? 116 : 135) * variation,
      z: aligned ? 0 : .95 - (index % 7) * .84
    };
  });
}

function worldGalleryLayout(count, width, height) {
  const columns = Math.min(count, width < 680 ? 2 : 3);
  if (!columns) return { slots: [], firstY: 0, extraHeight: 0 };
  const rows = Math.ceil(count / columns);
  const top = width < 680 ? 180 : height < 560 ? 122 : 165;
  const bottom = width < 680 ? 160 : 125;
  const columnWidth = Math.min(width * .82 / columns, 470);
  const radius = Math.min(columnWidth * .39, height * .215, 204,
    rows === 1 ? Math.max(38, (height - top - bottom) * .4) : Infinity);
  const rowHeight = radius * 2.55;
  const contentHeight = top + rows * rowHeight + bottom;
  const firstY = rows === 1
    ? (height + top - bottom) / 2
    : top + rowHeight / 2;
  const slots = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const columnsInRow = Math.min(columns, count - row * columns);
    return {
      x: (column - (columnsInRow - 1) / 2) * columnWidth,
      down: row * rowHeight,
      radius,
    };
  });
  return { slots, firstY, extraHeight: rows === 1 ? 0 : Math.max(0, contentHeight - height) };
}

function worldSlot(index, focus, width, height) {
  const weight = i => focus < 0 ? 1 : i === focus ? 1.6 : .8;
  let start = 0;
  for (let i = 0; i < index; i++) start += weight(i);
  const lane = width * .92 / 4;
  return {
    x: -width * .46 + (start + weight(index) / 2) * lane,
    // Leave room inside each lane for the rotated stack and the wider pedestal.
    radius: Math.min(lane * weight(index) * .28,
      height * (index === focus ? .28 : .24), index === focus ? 220 : 160)
  };
}

export default function Scene({ items, introItems, onChoose, mode = 'gallery', progress = 0, focus = -1, onHover, results = null, worldId, onDetails, detailsOpen = false }) {
  const createGround = worldEnvironments[worldId];
  const immersive = Boolean(createGround);
  const featured = mode === 'featured-scroll' || worldId === 'featured';
  const host = useRef(null);
  const crosshair = useRef(null);
  const scroller = useRef(null);
  const scrollSpace = useRef(null);
  const state = useRef(null);
  const [failed, setFailed] = useState(false);
  const hasTrackDetails = (mode === 'gallery' || mode === 'results') && Boolean(onDetails);
  useEffect(() => { state.current = { onChoose, onDetails, detailsOpen, progress, focus, onHover, results }; },
    [onChoose, onDetails, detailsOpen, progress, focus, onHover, results]);

  useEffect(() => {
    const el = host.current;
    const canNavigate = mode === 'gallery' || mode === 'results';
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true, antialias: true, powerPreference: mode === 'ambient' ? 'low-power' : 'high-performance'
      });
    } catch {
      const fallback = requestAnimationFrame(() => setFailed(true));
      return () => cancelAnimationFrame(fallback);
    }
    const canvas = renderer.domElement;
    el.appendChild(canvas);
    canvas.tabIndex = mode === 'home' ? -1 : 0;
    const keys = state.current.onDetails
      ? 'Enter opens song info. Space plays the focused CD.'
      : 'Enter or Space plays the focused CD.';
    canvas.setAttribute('aria-label', immersive
      ? `Collection CDs. Use arrow keys to browse. ${keys}`
      : canNavigate ? `3D music gallery. Use WASD to move and plus or minus to zoom. ${keys}`
        : 'Sonara 3D CDs');
    if (canNavigate) canvas.setAttribute('data-lenis-prevent', '');

    const scene = new THREE.Scene();
    const ground = createGround?.(items.length);
    if (ground) scene.add(ground.group);
    scene.environment = getStudioMap();
    scene.environmentIntensity = 1.15;
    const home = mode === 'home';
    const fieldOfView = 42;
    const camera = home
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 90)
      : new THREE.PerspectiveCamera(fieldOfView, 1, .1, 90);
    const rig = new THREE.Group();
    camera.position.z = 12;
    const light = new THREE.DirectionalLight('#fff0ea', immersive ? 1.55 : 2.45);
    light.position.set(-3, 5, 6);
    const rimLight = new THREE.DirectionalLight('#b6c3ff', 2.3);
    rimLight.position.set(4, 3, -4);
    const fill = new THREE.DirectionalLight('#efb2dd', immersive ? .43 : .61);
    fill.position.set(5, -.5, 3);
    scene.add(rig, light, rimLight, fill, new THREE.HemisphereLight('#fff4ff', '#4c2a59', immersive ? 1.08 : 1.45));

    const displayMaterials = [];
    const worldDisplays = [];
    const discStyle = {
      featured,
      onGround: immersive,
      detailed: immersive || home || featured,
      raisedRim: mode === 'featured-scroll',
    };

    function assemble(item, tracks, index, introduction = false) {
      const group = new THREE.Group();
      const stack = new THREE.Group();
      group.add(stack);
      const members = tracks.map((track, j) => {
        const disc = createDisc(track, discStyle);
        disc.position.set(j * (introduction ? .52 : -.26), j * .10, -j * .25);
        disc.rotation.y = 0;
        disc.rotation.z = j * -.08;
        stack.add(disc);
        return disc;
      });
      let hitTarget;
      if (mode === 'home' && !introduction) {
        // Keep the pointer target steady when the discs turn edge-on.
        hitTarget = new THREE.Mesh(worldHitGeometry, worldHitMaterial);
        hitTarget.position.set(-.14, .04, -.12);
        group.add(hitTarget);
      } else if (immersive) {
        hitTarget = new THREE.Mesh(discHitGeometry, worldHitMaterial);
        hitTarget.userData.owner = group;
        hitTarget.userData.lift = 0;
        hitTarget.scale.setScalar(.001);
        rig.add(hitTarget);
      }
      let displayTrim, environment;
      if (item.tracks) {
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(item.color).multiplyScalar(.22),
          emissive: item.color, emissiveIntensity: .08, roughness: .37, metalness: .36
        });
        displayMaterials.push(material);
        displayTrim = material;
        const display = new THREE.Group();
        display.position.set(-.15, -1.13, -.18);
        display.scale.z = .66;
        display.rotation.x = .10;
        const base = new THREE.Mesh(plinthGeometry, plinthMaterial);
        const trim = new THREE.Mesh(trimGeometry, material);
        trim.position.y = .075;
        const lightRing = new THREE.Mesh(plinthRingGeometry, material);
        lightRing.rotation.x = Math.PI / 2;
        lightRing.position.y = .091;
        display.add(base, trim, lightRing);
        if (mode === 'home') {
          const contact = new THREE.Mesh(contactGeometry, getContactMaterial());
          contact.rotation.x = -Math.PI / 2;
          contact.position.set(-.12, .094, -.03);
          display.add(contact);
          environment = createWorldDisplay(index);
          display.add(environment.group);
          worldDisplays.push(environment);
        }
        group.add(display);
      }
      group.scale.setScalar(.001);
      group.userData = { item, index, members, displayTrim, stack, hitTarget, environment };
      rig.add(group);
      return group;
    }

    const objects = items.map((item, i) => assemble(item, item.tracks?.slice(0, 3) || [item], i));
    const introduction = introItems?.length
      ? assemble({ ...introItems[0] }, [...introItems], 0, true)
      : null;
    const ray = new THREE.Raycaster();
    const restRay = new THREE.Ray(new THREE.Vector3(0, 0, 12));
    const discGround = new THREE.Vector3();
    const groundNormal = ground?.plane.normal;
    const groundDown = ground && new THREE.Vector3(0, 0, 1).transformDirection(ground.group.matrixWorld);
    const groundPitch = groundNormal ? -Math.atan2(groundNormal.y, groundNormal.z) : 0;
    const pointerOnGround = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const aim = crosshair.current;
    const scrollArea = scroller.current;
    const spacer = scrollSpace.current;
    const pointer = new THREE.Vector2();
    const pointers = new Map();
    let width = 1, height = 1, pixelRatio = 0, slots = new Map();
    let lastResults, sizeChanged = true, visible = false, frame = 0;
    let hovered = null, gesture = null, panX = 0, panY = 0, targetZ = 12;
    let offsetX = 0, offsetY = 0, zoomZ = 12, browsePosition = 0, scrollUnit = 0;
    let pointerX = 0, pointerY = 0;
    let aimPosition = null, lastAimCheck = 0;
    let scroll = state.current.progress;
    let last = performance.now();
    const tan = Math.tan(THREE.MathUtils.degToRad(fieldOfView / 2));
    const resize = new ResizeObserver(() => { sizeChanged = true; });
    resize.observe(el);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) {
        last = performance.now();
        frame = requestAnimationFrame(animate);
      }
    });
    observer.observe(el);

    function hit(x, y) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
      if (mode === 'home' && state.current.progress < .56) return null;
      pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const selectable = objects.filter(object => object.visible && object.userData.selectable);
      const intersections = home || immersive
        ? ray.intersectObjects(selectable.map(object => object.userData.hitTarget), false)
        : ray.intersectObjects(selectable, true);
      let object = intersections[0]?.object;
      if (object?.userData.owner) return object.userData.owner;
      while (object && !object.userData.item) object = object.parent;
      return object ?? null;
    }

    function updateHover(object) {
      if (hovered === object) return;
      hovered = object;
      if (aim) aim.classList.toggle('on-disc', Boolean(object));
      state.current.onHover?.(object?.userData.index ?? -1, object?.userData.item);
    }

    function zoom(amount) { targetZ = clamp(targetZ + amount, immersive ? -.5 : 3.9, 12); }
    function reset() {
      panX = panY = 0;
      targetZ = 12;
      if (immersive) scrollArea.scrollTop = 0;
    }

    function down(event) {
      if (event.button !== 0) return;
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pointers.size === 1) gesture = {
        x: event.clientX, y: event.clientY, px: panX, py: panY, moved: false
      };
      else if (gesture) gesture.moved = true;
      if (canNavigate) canvas.setPointerCapture(event.pointerId);
    }

    function move(event) {
      const rect = canvas.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / width * 2 - 1;
      pointerY = (event.clientY - rect.top) / height * 2 - 1;
      if (pointers.has(event.pointerId) && gesture) {
        const previous = pointers.get(event.pointerId);
        const distance = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
        if (distance > 7) gesture.moved = true;
        pointers.set(event.pointerId, [event.clientX, event.clientY]);
        if (canNavigate && pointers.size === 2) {
          const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)[1];
          zoom((Math.hypot(previous[0] - other[0], previous[1] - other[1]) -
            Math.hypot(event.clientX - other[0], event.clientY - other[1])) * .045);
        } else if (canNavigate && gesture.moved && !gesture.pinched && (!immersive || event.pointerType === 'mouse')) {
          const distanceToTracks = zoomZ - (ground?.group.position.z ?? 0);
          const units = 2 * distanceToTracks * tan / height;
          panX = clamp(gesture.px + (event.clientX - gesture.x) * units, -24, 24);
          panY = clamp(gesture.py - (event.clientY - gesture.y) * units, -18, 18);
        }
      }
      const mouse = event.pointerType === 'mouse';
      if (aim) aimPosition = [event.clientX, event.clientY];
      if (aim && mouse) {
        aim.hidden = false;
        aim.style.transform = `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px)`;
      }
      updateHover(gesture?.moved || !mouse ? null : hit(event.clientX, event.clientY));
      canvas.style.cursor = aim && mouse ? 'none'
        : hovered ? (home ? 'crosshair' : 'pointer')
          : canNavigate ? (gesture?.moved ? 'grabbing' : 'grab') : 'default';
    }

    function end(event, activate) {
      if (activate && gesture && !gesture.moved && pointers.has(event.pointerId)) {
        const object = hit(event.clientX, event.clientY);
        if (object) {
          const item = object.userData.item;
          state.current.onChoose(item);
          if (canNavigate && event.pointerType !== 'mouse') state.current.onDetails?.(item);
        }
      }
      pointers.delete(event.pointerId);
      if (event.pointerType !== 'mouse') aimPosition = null;
      if (!pointers.size) gesture = null;
      else if (gesture) gesture.pinched = true;
    }

    function key(event) {
      if (mode === 'home') return; // Native label buttons provide keyboard access for Worlds.
      const name = event.key.toLowerCase();
      const current = state.current;
      if (name === 'enter' || name === ' ') {
        const object = hovered?.userData.selectable ? hovered : objects[Math.max(0, current.focus)];
        let item = hovered?.userData.selectable ? hovered.userData.item : current.results ? current.results[0] : object?.userData.item;
        if (canNavigate && !hovered) {
          let closest = Infinity;
          item = null;
          for (const disc of objects) {
            if (!disc.visible || !disc.userData.selectable) continue;
            disc.getWorldPosition(projected).project(camera);
            const distance = Math.hypot(projected.x, projected.y);
            if (Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && distance < closest) {
              closest = distance;
              item = disc.userData.item;
            }
          }
        }
        if (item) {
          event.preventDefault();
          if (canNavigate && name === 'enter' && current.onDetails) current.onDetails(item);
          else current.onChoose(item);
        }
        return;
      }
      if (!canNavigate) return;
      if (immersive && ['arrowup', 'arrowdown', 'pageup', 'pagedown', 'home', 'end'].includes(name)) {
        event.preventDefault();
        if (name === 'home' || name === 'end') scrollArea.scrollTop = name === 'home' ? 0 : scrollArea.scrollHeight;
        else scrollArea.scrollBy(0, (name.endsWith('up') ? -1 : 1) * height * (name.startsWith('page') ? .8 : .18));
        return;
      }
      const directions = {
        w: [0, -.7], s: [0, .7], a: [.7, 0], d: [-.7, 0],
        arrowup: [0, -.7], arrowdown: [0, .7], arrowleft: [.7, 0], arrowright: [-.7, 0]
      };
      const movement = directions[name];
      if (movement) {
        panX = clamp(panX + movement[0], -24, 24);
        panY = clamp(panY + movement[1], -18, 18);
      } else if (['+', '=', '-'].includes(name)) zoom(name === '-' ? 1.3 : -1.3);
      else return;
      event.preventDefault();
    }

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', event => end(event, true));
    canvas.addEventListener('pointercancel', event => end(event, false));
    if (canNavigate) canvas.addEventListener('dblclick', event => {
      const object = hit(event.clientX, event.clientY);
      if (object) state.current.onDetails?.(object.userData.item);
    });
    if (canNavigate) canvas.addEventListener('contextmenu', event => {
      if (!state.current.onDetails) return;
      const object = hit(event.clientX, event.clientY);
      if (!object) return;
      event.preventDefault();
      state.current.onDetails(object.userData.item);
    });
    canvas.addEventListener('pointerleave', event => {
      updateHover(null);
      aimPosition = null;
      if (aim) aim.hidden = true;
      canvas.style.cursor = '';
      pointerX = pointerY = 0;
      if (!canNavigate) end(event, false);
    });
    canvas.addEventListener('keydown', key);
    if (canNavigate) canvas.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoom(event.deltaY * (event.deltaMode === 1 ? .25 : .012));
    }, { passive: false });

    function animate(now) {
      if (!visible) return;
      frame = requestAnimationFrame(animate);
      const elapsed = Math.max(0, (now - last) / 1000);
      const dt = Math.min(.05, elapsed);
      last = now;
      const current = state.current;
      const reduced = el.closest('.quiet-motion') !== null;
      const damping = reduced ? 1 : 1 - Math.exp(-dt * 8);
      const time = reduced ? 0 : now / 1000;
      const nativeRatio = window.devicePixelRatio || 1;
      if (sizeChanged || nativeRatio !== pixelRatio) {
        width = el.clientWidth || 1;
        height = el.clientHeight || 1;
        pixelRatio = nativeRatio;
        const maxPixels = mode === 'ambient' ? 2000000 : 8300000;
        const resolution = Math.min(nativeRatio, width < 760 ? 2 : 2.5, Math.sqrt(maxPixels / (width * height)));
        renderer.setPixelRatio(resolution);
        renderer.setSize(width, height);
        const aspect = width / height;
        if (home) {
          camera.top = 12 * tan;
          camera.bottom = -camera.top;
          camera.right = camera.top * aspect;
          camera.left = -camera.right;
        } else {
          camera.aspect = aspect;
        }
        camera.updateProjectionMatrix();
      }
      if (canNavigate && (lastResults !== current.results || sizeChanged)) {
        const matching = current.results || items;
        let layout;
        if (ground) {
          const { slots: positions, firstY, extraHeight } = worldGalleryLayout(matching.length, width, height);
          const rayUnits = 2 * 12 * tan / height;
          restRay.direction.set(0, (height / 2 - firstY) * rayUnits, -12).normalize();
          restRay.intersectPlane(ground.plane, discGround);
          const unit = 2 * (12 - discGround.z) * tan / height;
          scrollUnit = unit / groundNormal.z;
          layout = positions.map(({ x, down, radius }) => {
            const position = discGround.clone()
              .addScaledVector(groundDown, down * scrollUnit)
              .addScaledVector(groundNormal, .47);
            position.x += x * unit;
            return { position, radius: radius * unit };
          });
          spacer.style.height = `${extraHeight}px`;
        } else {
          layout = gallerySlots(matching.length, width, height, Boolean(current.results) || mode === 'results');
        }
        slots = new Map(matching.map((item, i) => [item.id, layout[i]]));
        if (lastResults !== current.results) {
          reset();
          updateHover(null);
        }
        lastResults = current.results;
      }
      sizeChanged = false;
      scroll = lerp(scroll, current.progress, damping);
      zoomZ = lerp(zoomZ, targetZ, damping);
      offsetX = lerp(offsetX, panX, damping);
      offsetY = lerp(offsetY, panY, damping);
      if (ground) {
        // Scroll and drag move the camera along the ground, keeping CDs and scenery anchored.
        browsePosition = lerp(browsePosition, scrollArea.scrollTop * scrollUnit, damping);
        camera.position.copy(groundDown).multiplyScalar(browsePosition + offsetY / groundNormal.z);
        camera.position.x = -offsetX;
        camera.position.z += zoomZ;
      } else {
        camera.position.z = zoomZ;
        rig.position.x = offsetX;
        rig.position.y = offsetY;
      }

      function place(group, x, y, z, radius, pitch, yaw, roll) {
        group.position.x = lerp(group.position.x, x, damping);
        group.position.y = lerp(group.position.y, y, damping);
        group.position.z = lerp(group.position.z, z, damping);
        group.scale.setScalar(lerp(group.scale.x, radius, damping));
        group.rotation.x = lerp(group.rotation.x, pitch, damping);
        group.rotation.y = lerp(group.rotation.y, yaw, damping);
        group.rotation.z = lerp(group.rotation.z, roll, damping);
        group.visible = group.scale.x > .008;
      }
      const screenUnit = z => 2 * (home ? 12 : 12 - z) * tan / height;
      function onScreen(group, x, y, z, radius, pitch, yaw, roll) {
        const unit = screenUnit(z);
        place(group, x * unit, y * unit, z, radius * unit, pitch, yaw, roll);
      }

      if (mode === 'home') {
        const peel = THREE.MathUtils.smoothstep(scroll, .05, .60);
        const unfold = THREE.MathUtils.smoothstep(scroll, .29, .60);
        if (introduction) {
          const radius = Math.min(width * .22, height * .35, 246);
          onScreen(introduction, -.70 * radius * (1 - peel) + peel * width * .22,
            -.20 * radius * (1 - peel) + Math.sin(time * .73) * 4 + peel * height * .12,
            2 - peel * 5, radius * (1 - unfold),
            .12 + Math.sin(time * .47) * .09,
            -.23 + Math.sin(time * .6) * .17 + peel * 1.50,
            -.12 - peel * .27);
        }
        objects.forEach((group, i) => {
          const lane = worldSlot(i, current.focus, width, height);
          const selected = i === current.focus;
          const { members, displayTrim, stack, environment } = group.userData;
          const spinning = !reduced && current.progress >= .56 && hovered === group;
          if (reduced) {
            stack.rotation.y = 0;
          } else if (spinning) {
            stack.rotation.y = THREE.MathUtils.euclideanModulo(
              stack.rotation.y + elapsed * worldTurnSpeed + Math.PI, Math.PI * 2
            ) - Math.PI;
          } else {
            const remaining = stack.rotation.y * Math.exp(-elapsed * 8);
            stack.rotation.y = Math.abs(remaining) < .002 ? 0 : remaining;
          }
          const turning = spinning || Math.abs(stack.rotation.y) > .08;
          members.forEach((disc, layer) => {
            disc.position.x = lerp(disc.position.x, -layer * (selected ? .29 : .20), damping);
            disc.position.y = lerp(disc.position.y, layer * (turning ? .085 : .10), damping);
            disc.position.z = lerp(disc.position.z, -layer * (turning ? .16 : .27), damping);
            disc.rotation.y = lerp(disc.rotation.y, layer * (turning ? -.10 : 0), damping);
          });
          environment.update(selected, time, damping);
          displayTrim.emissiveIntensity = lerp(
            displayTrim.emissiveIntensity, selected || hovered === group ? .27 : .06, damping
          );
          group.userData.selectable = current.progress >= .56;
          const parallax = selected && !reduced ? 1 : 0;
          onScreen(group, lerp(0, lane.x, unfold), lerp(-height * .37, height * (selected ? .07 : .025), unfold),
            lerp(-5, selected ? 1.65 : -.8, unfold), lane.radius * unfold,
            selected ? .12 - pointerY * .14 * parallax : .04,
            (1 - unfold) * -1.3 + (selected ? -.25 + pointerX * .16 * parallax : Math.sin(time * .49 + i) * .09),
            selected ? -.035 : .025 * Math.sin(i + time * .52));
        });
      } else {
        objects.forEach((group, i) => {
          const isHovered = group === hovered;
          group.userData.selectable = true;
          if (canNavigate) {
            const slot = slots.get(group.userData.item.id);
            const aligning = Boolean(current.results) || mode === 'results';
            if (!slot) {
              group.userData.selectable = false;
              place(group, group.position.x, group.position.y, -7, 0, 0, -.9, 0);
              ground?.setDiscFootprint(i, null);
              return;
            }
            if (ground) {
              const { hitTarget } = group.userData;
              const { position: { x, y, z }, radius } = slot;
              const lift = isHovered && !reduced;
              hitTarget.userData.lift = lerp(hitTarget.userData.lift, lift ? 1 : 0, damping);
              const roll = .12 * Math.sin(i * 2.19);
              place(hitTarget, x, y, z, radius, groundPitch, 0, roll);
              ground.setDiscFootprint(i, slot.position, radius, hitTarget.userData.lift);
              place(group, x, y + (lift ? .30 : 0),
                z + (lift ? 1.35 : 0), radius, groundPitch + (lift ? .22 : 0),
                lift ? pointerX * .12 : 0, roll);
              return;
            }
            const depth = slot.z + (aligning ? 0 : Math.sin(time * .58 + i * 1.7) * .24);
            onScreen(group, slot.x + (aligning ? 0 : Math.sin(time * .44 + i) * 3),
              slot.y + (aligning ? 0 : Math.sin(time * .71 + i) * 4),
              depth + (isHovered ? .48 : 0), slot.radius * (isHovered ? 1.08 : 1),
              aligning || isHovered ? 0 : Math.sin(time * .4 + i) * .14 - pointerY * .05,
              aligning || isHovered ? 0 : Math.sin(time * .53 + i) * .22 + pointerX * .08,
              aligning ? 0 : Math.sin(time * .34 + i) * .10);
          } else if (mode === 'featured-scroll') {
            const offset = i - scroll * (objects.length - 1);
            const distance = Math.abs(offset);
            const radius = Math.min(width * .22, height * .37, 248);
            const step = Math.max(radius * 2.5, width * .27);
            const depth = 1.5 - Math.min(distance, 5) * 3.3;
            const unit = screenUnit(0);
            const tilt = isHovered && !reduced ? 1 : 0;
            place(group, offset * step * unit,
              Math.sin(time + i) * .05 - distance * .13,
              depth + tilt * .65, radius * unit * (1 + tilt * .035),
              .14 + distance * .07 - pointerY * tilt * .36,
              clamp(offset * -.84, -1.24, 1.24) + pointerX * tilt * .49,
              clamp(offset * -.15, -.45, .45));
          } else {
            const spacing = Math.min(width * .88 / objects.length, 276);
            const radius = Math.min(width * .18, spacing * .42, height * .35, 115);
            const x = (i - (objects.length - 1) / 2) * spacing;
            const y = reduced ? 0 : Math.sin(time * .6 + i) * radius * .18;
            onScreen(group, x, y, -1 - i * .3, radius, .12, Math.sin(time * .47 + i) * .34, .09 * i);
          }
        });
      }
      if (ground) {
        if (current.detailsOpen && aimPosition) {
          aimPosition = null;
          aim.hidden = true;
          updateHover(null);
        }
        camera.updateMatrixWorld();
        pointer.set(pointerX, -pointerY);
        ray.setFromCamera(pointer, camera);
        const groundPoint = aimPosition ? ray.ray.intersectPlane(ground.plane, pointerOnGround) : null;
        ground.update(time, groundPoint, reduced);
        if (aimPosition && !aim.hidden && !gesture?.moved && now - lastAimCheck > 80) {
          scene.updateMatrixWorld();
          updateHover(hit(...aimPosition));
          lastAimCheck = now;
        }
      }
      if (featured) discTime.value = time;
      renderer.render(scene, camera);
    }
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      ground?.dispose();
      worldDisplays.forEach(display => display.dispose());
      displayMaterials.forEach(material => material.dispose());
      renderer.dispose();
      canvas.remove();
    };
  }, [items, introItems, mode, immersive, createGround, featured]);

  return <div className={`scene ${mode}${immersive ? ' world-gallery-scene' : ''}`} ref={scroller}>
    <div className="scene-canvas" ref={host}>
      {immersive && <span className="world-crosshair" ref={crosshair} aria-hidden="true" hidden/>}
    </div>
    {immersive && <div ref={scrollSpace} aria-hidden="true"/>}
    {failed && <div className="fallback">
      {(results || items).map(item => <button key={item.id}
        onClick={event => {
          onChoose(item);
          if (hasTrackDetails && ['touch', 'pen'].includes(event.nativeEvent.pointerType)) onDetails(item);
        }}
        onDoubleClick={hasTrackDetails ? () => onDetails(item) : undefined}
        onContextMenu={hasTrackDetails ? event => {
          event.preventDefault();
          onDetails(item);
        } : undefined}
        onKeyDown={hasTrackDetails ? event => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onDetails(item);
        } : undefined}>
        <img src={artUrl(item.tracks?.[0] || item, featured)} alt={item.song || item.name}/>
      </button>)}
    </div>}
  </div>;
}
