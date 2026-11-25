import { useEffect, useRef } from 'react';

let spotifyApi;

function loadSpotifyApi() {
  if (spotifyApi) return spotifyApi;
  spotifyApi = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    const timeout = window.setTimeout(fail, 5000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      delete window.onSpotifyIframeApiReady;
      spotifyApi = undefined;
      reject(new Error('Spotify Embed API unavailable'));
    }
    script.addEventListener('error', fail, { once: true });
    window.onSpotifyIframeApiReady = api => {
      window.clearTimeout(timeout);
      delete window.onSpotifyIframeApiReady;
      resolve(api);
    };
    document.head.appendChild(script);
  });
  return spotifyApi;
}

export default function SpotifyTrack({ id, onController, onPlayback, onError }) {
  const host = useRef(null);

  useEffect(() => {
    const container = host.current;
    const mount = document.createElement('div');
    container.append(mount);
    let controller;
    let active = true;
    const readyTimeout = window.setTimeout(() => {
      if (active) onError?.();
    }, 10000);
    loadSpotifyApi().then(api => {
      if (!active) return;
      api.createController(mount, { uri: `spotify:track:${id}`, width: 320, height: 152 }, player => {
        if (!active) {
          player.destroy();
          return;
        }
        controller = player;
        player.addListener('ready', () => {
          if (!active) return;
          window.clearTimeout(readyTimeout);
          onController?.(player);
          player.play();
        });
        if (onPlayback) player.addListener('playback_update', event => {
          if (active) onPlayback(event.data);
        });
      });
    }).catch(() => {
      window.clearTimeout(readyTimeout);
      if (active) onError?.();
    });
    return () => {
      active = false;
      window.clearTimeout(readyTimeout);
      onController?.(null);
      onPlayback?.(null);
      controller?.destroy();
      container.replaceChildren();
    };
  }, [id, onController, onPlayback, onError]);

  return <div ref={host} className="spotify-playback-host" aria-hidden="true" inert/>;
}
