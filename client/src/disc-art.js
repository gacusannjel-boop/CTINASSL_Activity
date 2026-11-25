import * as THREE from 'three';

const art = import.meta.glob('./assets/discs/*.svg', { eager: true, query: '?url', import: 'default' });
export function artUrl(item, featured = false) {
  const id = item.tracks ? `world-${item.id}` : item.id;
  const featuredArt = featured ? art[`./assets/discs/featured-${id}.svg`] : undefined;
  return featuredArt ?? art[`./assets/discs/${id}.svg`];
}
const textures = new Map();
const loader = new THREE.ImageLoader();

async function loadDetailedArtwork(url, resolution) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Disc artwork request failed (${response.status})`);

  // Rasterize the vector source at the desired size so the text and fine grooves
  // remain sharp without scaling up an already-decoded image.
  const source = await response.text();
  const svg = source.replace(/<svg\b[^>]*>/, tag =>
    tag.replace(/\b(width|height)="\d+"/g, `$1="${resolution}"`));
  const imageUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    return await loader.loadAsync(imageUrl);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function loadDisc(item, detailed = false, featured = false) {
  const url = artUrl(item, featured);
  let entry = textures.get(url);
  if (!entry) {
    const texture = new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    entry = { texture, resolution: 0 };
    textures.set(url, entry);
  }

  const resolution = detailed ? 1024 : 512;
  if (resolution > entry.resolution) {
    entry.resolution = resolution;
    const request = detailed
      ? loadDetailedArtwork(url, resolution).catch(() => loader.loadAsync(url))
      : loader.loadAsync(url);
    entry.ready = request.then(image => {
      if (entry.texture.image?.width >= image.width) return;
      entry.texture.image = image;
      entry.texture.needsUpdate = true;
    }).catch(error => console.warn('Could not load CD artwork', item.id, error));
  }
  return entry;
}

export function preloadDiscs(items, report) {
  let loaded = 0;
  report(0, items.length);
  return Promise.all(items.map(item => loadDisc(item).ready.then(() => report(++loaded, items.length))));
}
