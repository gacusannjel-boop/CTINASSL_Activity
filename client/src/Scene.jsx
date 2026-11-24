import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const art = import.meta.glob('./assets/discs/*.svg', { eager: true, query: '?url', import: 'default' });
export const artUrl = item => art[`./assets/discs/${item.tracks ? 'world-' + item.id : item.id}.svg`];
const textures = new Map();
const loader = new THREE.TextureLoader();

function loadDisc(item) {
  const url = artUrl(item);
  if (!textures.has(url)) {
    const texture = new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const ready = loader.loadAsync(url).then(source => {
      texture.image = source.image;
      texture.needsUpdate = true;
      source.dispose();
    }).catch(error => console.warn('Could not load CD artwork', item.id, error));
    textures.set(url, { texture, ready });
  }
  return textures.get(url);
}

export function preloadDiscs(items, report) {
  let loaded = 0;
  report(0, items.length);
  return Promise.all(items.map(item => loadDisc(item).ready.then(() => report(++loaded, items.length))));
}

const rimGeometry = new THREE.TorusGeometry(.987, .019, 8, 64);
const hubGeometry = new THREE.TorusGeometry(.118, .012, 6, 40);
const faceGeometry = new THREE.RingGeometry(.113, .988, 64);
const metallicBack = new THREE.MeshStandardMaterial({ color: '#dcc6e4', metalness: .48, roughness: .28 });
const rimMaterial = new THREE.MeshStandardMaterial({ color: '#e5cfde', metalness: .42, roughness: .28 });
const materials = new Map();
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

function createDisc(track) {
  if (!materials.has(track.id)) {
    materials.set(track.id, new THREE.MeshBasicMaterial({
      map: loadDisc(track).texture, alphaTest: .2, side: THREE.FrontSide
    }));
  }
  const disc = new THREE.Group();
  const face = new THREE.Mesh(faceGeometry, materials.get(track.id));
  face.position.z = .021;
  const back = new THREE.Mesh(faceGeometry, metallicBack);
  back.position.z = -.021;
  back.rotation.y = Math.PI;
  disc.add(face, back, new THREE.Mesh(rimGeometry, rimMaterial), new THREE.Mesh(hubGeometry, rimMaterial));
  return disc;
}

function gallerySlots(count, width, height, aligned) {
  if (!count) return [];
  const usableWidth = width * .90;
  const usableHeight = height * .94;
  let columns = 1;
  let best = 0;
  for (let c = 1; c <= count; c++) {
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
      y: ((rows - 1) / 2 - row) * rowHeight + (aligned ? 0 : Math.cos(index * 3.13) * best * .12),
      radius: Math.min(best * (aligned ? .32 : .31), aligned ? 104 : 119) * variation,
      z: aligned ? 0 : .95 - (index % 7) * .84
    };
  });
}

function worldSlot(index, focus, width, height) {
  const weight = i => focus < 0 ? 1 : i === focus ? 1.6 : .8;
  let start = 0;
  for (let i = 0; i < index; i++) start += weight(i);
  const lane = width * .92 / 4;
  return {
    x: -width * .46 + (start + weight(index) / 2) * lane,
    radius: Math.min(lane * weight(index) * .33, height * (index === focus ? .40 : .30), index === focus ? 142 : 106)
  };
}

export default function Scene({ items, introItems, onChoose, mode = 'gallery', progress = 0, focus = -1, onHover, results = null }) {
  const host = useRef(null);
  const state = useRef(null);
  const controls = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { state.current = { onChoose, progress, focus, onHover, results }; }, [onChoose, progress, focus, onHover, results]);

  useEffect(() => {
    const el = host.current;
    const canNavigate = mode === 'gallery' || mode === 'results';
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      setFailed(true);
      return;
    }
    const canvas = renderer.domElement;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    el.appendChild(canvas);
    canvas.tabIndex = mode === 'home' ? -1 : 0;
    canvas.setAttribute('aria-label', canNavigate ? '3D music gallery. Use WASD to move and plus or minus to zoom.' : 'Sonara 3D CDs');
    if (canNavigate) canvas.setAttribute('data-lenis-prevent', '');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 90);
    const rig = new THREE.Group();
    camera.position.z = 12;
    const light = new THREE.DirectionalLight('#f3d6ff', 2.3);
    light.position.set(3, 4, 7);
    scene.add(rig, light, new THREE.HemisphereLight('#fff3fa', '#523c72', 2.2));

    function assemble(item, tracks, index, introduction = false) {
      const group = new THREE.Group();
      const members = tracks.map((track, j) => {
        const disc = createDisc(track);
        disc.position.set(-j * .26, j * .12, -j * .25);
        disc.rotation.y = j * -.12;
        disc.rotation.z = j * -.08;
        group.add(disc);
        return disc;
      });
      group.scale.setScalar(.001);
      group.userData = { item, index, members, introduction };
      rig.add(group);
      return group;
    }

    const objects = items.map((item, i) => assemble(item, item.tracks?.slice(0, 3) || [item], i));
    const introduction = introItems?.map((track, i) => assemble(track, [track], i, true)) ?? [];
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointers = new Map();
    let width = 1, height = 1, slots = new Map();
    let lastResults, sizeChanged = true, visible = false, frame = 0;
    let hovered = null, gesture = null, panX = 0, panY = 0, targetZ = 12;
    let pointerX = 0, pointerY = 0;
    let scroll = state.current.progress;
    let last = performance.now();
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const resize = new ResizeObserver(() => { sizeChanged = true; });
    resize.observe(el);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) frame = requestAnimationFrame(animate);
    });
    observer.observe(el);

    function hit(x, y) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
      if (mode === 'home' && state.current.progress < .56) return null;
      pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      const intersections = ray.intersectObjects(objects.filter(object => object.visible && object.userData.selectable), true);
      let object = intersections[0]?.object;
      while (object && !object.userData.item) object = object.parent;
      return object ?? null;
    }

    function updateHover(object) {
      if (hovered === object) return;
      hovered = object;
      state.current.onHover?.(object?.userData.index ?? -1);
    }

    function zoom(amount) { targetZ = clamp(targetZ + amount, 3.9, 30); }
    function reset() { panX = panY = 0; targetZ = 12; }
    controls.current = { zoom, reset };

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
        } else if (canNavigate && gesture.moved && !gesture.pinched) {
          const units = 2 * camera.position.z * tan / height;
          panX = clamp(gesture.px + (event.clientX - gesture.x) * units, -24, 24);
          panY = clamp(gesture.py - (event.clientY - gesture.y) * units, -18, 18);
        }
      }
      updateHover(gesture?.moved ? null : hit(event.clientX, event.clientY));
      canvas.style.cursor = hovered ? 'pointer' : canNavigate ? (gesture?.moved ? 'grabbing' : 'grab') : 'default';
    }

    function end(event, activate) {
      if (activate && gesture && !gesture.moved && pointers.has(event.pointerId)) {
        const object = hit(event.clientX, event.clientY);
        if (object) state.current.onChoose(object.userData.item);
      }
      pointers.delete(event.pointerId);
      if (!pointers.size) gesture = null;
      else if (gesture) gesture.pinched = true;
    }

    function key(event) {
      if (mode === 'home') return; // Native label buttons provide keyboard access for Worlds.
      const name = event.key.toLowerCase();
      const current = state.current;
      if (name === 'enter' || name === ' ') {
        const object = hovered?.userData.selectable ? hovered : objects[Math.max(0, current.focus)];
        const item = hovered?.userData.selectable ? hovered.userData.item : current.results ? current.results[0] : object?.userData.item;
        if (item) { event.preventDefault(); current.onChoose(item); }
        return;
      }
      if (!canNavigate) return;
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
    canvas.addEventListener('pointerleave', event => {
      updateHover(null);
      pointerX = pointerY = 0;
      if (!canNavigate) end(event, false);
    });
    canvas.addEventListener('keydown', key);
    if (canNavigate) canvas.addEventListener('wheel', event => {
      event.preventDefault();
      zoom(event.deltaY * (event.deltaMode === 1 ? .25 : .012));
    }, { passive: false });

    function animate(now) {
      if (!visible) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(.05, (now - last) / 1000);
      last = now;
      const current = state.current;
      const reduced = el.closest('.quiet-motion') !== null;
      const damping = reduced ? 1 : 1 - Math.exp(-dt * 8);
      const time = reduced ? 0 : now / 1000;
      if (sizeChanged) {
        width = el.clientWidth || 1;
        height = el.clientHeight || 1;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      if (canNavigate && (lastResults !== current.results || sizeChanged)) {
        const matching = current.results || items;
        const layout = gallerySlots(matching.length, width, height, Boolean(current.results) || mode === 'results');
        slots = new Map(matching.map((item, i) => [item.id, layout[i]]));
        if (lastResults !== current.results) {
          reset();
          updateHover(null);
        }
        lastResults = current.results;
      }
      sizeChanged = false;
      scroll = lerp(scroll, current.progress, damping);
      camera.position.z = lerp(camera.position.z, targetZ, damping);
      rig.position.x = lerp(rig.position.x, panX, damping);
      rig.position.y = lerp(rig.position.y, panY, damping);

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
      const screenUnit = z => 2 * (12 - z) * tan / height;
      function onScreen(group, x, y, z, radius, pitch, yaw, roll) {
        const unit = screenUnit(z);
        place(group, x * unit, y * unit, z, radius * unit, pitch, yaw, roll);
      }

      if (mode === 'home') {
        const peel = THREE.MathUtils.smoothstep(scroll, .05, .60);
        const unfold = THREE.MathUtils.smoothstep(scroll, .29, .60);
        const r = Math.min(width * .215, height * .44, 174);
        introduction.forEach((group, i) => {
          const layer = i - 1.5;
          onScreen(group,
            layer * r * (.37 + peel * .49) + peel * width * .24,
            layer * r * .14 + peel * height * .27 + Math.sin(time * .73 + i) * 4,
            2 - i * .59 - peel * 5,
            r * (1 - i * .055) * (1 - unfold),
            .12 + Math.sin(time * .47 + i) * .13 + peel * .35,
            -.23 + i * .16 + Math.sin(time * .6 + i) * .20 + peel * 1.64,
            layer * .18 - peel * .43);
        });
        objects.forEach((group, i) => {
          const lane = worldSlot(i, current.focus, width, height);
          const selected = i === current.focus;
          group.userData.selectable = current.progress >= .56;
          onScreen(group, lerp(0, lane.x, unfold), lerp(-height * .37, 0, unfold),
            lerp(-5, selected ? 1.2 : -.8, unfold), lane.radius * unfold,
            selected ? -.10 : .04, (1 - unfold) * -1.3 + (selected ? -.28 + Math.sin(time * .63) * .22 : Math.sin(time * .49 + i) * .13),
            selected ? -.11 : .05 * Math.sin(i + time * .52));
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
              return;
            }
            const depth = slot.z + (aligning ? 0 : Math.sin(time * .58 + i * 1.7) * .24);
            const unit = screenUnit(slot.z);
            place(group, slot.x * unit + (aligning ? 0 : Math.sin(time * .44 + i) * .08),
              slot.y * unit + (aligning ? 0 : Math.sin(time * .71 + i) * .10),
              depth + (isHovered ? .42 : 0), slot.radius * unit * (isHovered ? 1.07 : 1),
              aligning ? 0 : Math.sin(time * .4 + i) * .17 - pointerY * .05,
              aligning ? 0 : Math.sin(time * .53 + i) * .26 + pointerX * .08,
              aligning ? 0 : Math.sin(time * .34 + i) * .10);
          } else if (mode === 'featured-scroll') {
            const offset = i - scroll * (objects.length - 1);
            const distance = Math.abs(offset);
            const radius = Math.min(width * .22, height * .42, 186);
            const step = Math.max(radius * 2.35, width * .28);
            const depth = 2.2 - Math.min(distance, 5) * 2.6;
            const unit = screenUnit(0);
            place(group, offset * step * unit, Math.sin(time + i) * .04 - distance * .12,
              depth, radius * unit * (isHovered ? 1.04 : 1),
              .08 + distance * .08, clamp(offset * -.87, -1.28, 1.28), offset * -.22);
          } else {
            onScreen(group, (i % 2 ? 1 : -1) * width * .22, Math.sin(time * .6 + i) * height * .08,
              -1 - i * .3, Math.min(width * .18, height * .35, 115), .12, Math.sin(time * .47 + i) * .34, .09 * i);
          }
        });
      }
      renderer.render(scene, camera);
    }
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      controls.current = null;
      renderer.dispose();
      canvas.remove();
    };
  }, [items, introItems, mode]);

  return <div className={'scene ' + mode}>
    <div className="scene-canvas" ref={host}/>
    {failed && <div className="fallback">
      {(results || items).map(item => <button key={item.id} onClick={() => onChoose(item)}>
        <img src={artUrl(item.tracks?.[0] || item)} alt={item.song || item.name}/>
      </button>)}
    </div>}
    {['gallery', 'results'].includes(mode) && !failed && <div className="scene-tools">
      <button onClick={() => controls.current?.zoom(-2)} aria-label="Zoom in">+</button>
      <button onClick={() => controls.current?.zoom(2)} aria-label="Zoom out">−</button>
      <button onClick={() => controls.current?.reset()}>Reset view</button>
    </div>}
  </div>;
}
