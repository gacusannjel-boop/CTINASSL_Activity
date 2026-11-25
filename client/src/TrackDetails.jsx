import { useLayoutEffect, useRef, useState } from 'react';
import { artUrl } from './disc-art.js';
import './TrackDetails.css';

const releaseDateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' });

export default function TrackDetails({ track, featured, metadata, spotifyUrl, playing, onToggle, onJournal, onDismiss }) {
  const dialog = useRef(null);
  // The tap that opens the dialog can finish with a click on its backdrop.
  const backdropPressed = useRef(false);
  const [copyStatus, setCopyStatus] = useState('');
  const releaseDate = metadata?.releaseDate;
  const duration = metadata?.duration;
  const durationLabel = Number.isFinite(duration) ?
    `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : null;
  const release = releaseDate && (
    <time dateTime={releaseDate}>
      {releaseDate.length === 4 ? releaseDate : releaseDateFormat.format(new Date(`${releaseDate}T00:00:00Z`))}
    </time>
  );

  useLayoutEffect(() => {
    const popup = dialog.current;
    popup.showModal();
    return () => popup.close();
  }, []);

  async function copySpotifyLink() {
    try {
      await navigator.clipboard.writeText(spotifyUrl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <dialog
      className="track-details"
      ref={dialog}
      aria-labelledby="track-details-title"
      aria-describedby="track-details-artist"
      data-lenis-prevent
      onCancel={event => {
        event.preventDefault();
        onDismiss();
      }}
      onPointerDown={event => {
        backdropPressed.current = event.target === event.currentTarget;
      }}
      onClick={event => {
        const pressedBackdrop = backdropPressed.current;
        backdropPressed.current = false;
        if (pressedBackdrop && event.target === event.currentTarget) onDismiss();
      }}
    >
      <section className="track-details-card">
        <button type="button" className="plain track-details-close" onClick={onDismiss} aria-label="Close song info">
          ×
        </button>
        <img className="track-details-art" src={artUrl(track, featured)} alt="" />
        <div className="track-details-content">
          <div className="eyebrow">{track.world} · {track.mood}</div>
          <h2 id="track-details-title">{track.song}</h2>
          <p id="track-details-artist">{track.artist}</p>
          {(release || durationLabel || metadata?.vibe) && <dl className="track-details-metadata">
            {release && <>
              <dt>Spotify release</dt>
              <dd>{metadata.source ?
                <a href={metadata.source} target="_blank" rel="noreferrer">{release}</a> : release}</dd>
            </>}
            {durationLabel && <>
              <dt>Duration</dt>
              <dd>{durationLabel}</dd>
            </>}
            {metadata?.vibe && <>
              <dt>Vibe</dt>
              <dd>{metadata.vibe}</dd>
            </>}
          </dl>}
          <div className="track-details-actions">
            {onToggle && <button type="button" className="primary" onClick={onToggle}>{playing ? 'Pause' : 'Play'}</button>}
            <a className="plain" href={spotifyUrl} target="_blank" rel="noreferrer">Spotify ↗</a>
            <button type="button" className="plain" onClick={copySpotifyLink} aria-label="Copy Spotify link">
              {copyStatus === 'copied' ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
          <div role="status" className={copyStatus === 'failed' ? 'track-details-copy-error' : 'sr-only'}>
            {copyStatus === 'copied' && 'Spotify link copied.'}
            {copyStatus === 'failed' && 'Couldn’t copy the Spotify link.'}
          </div>
          <button type="button" className="plain track-details-journal" onClick={onJournal}>Journal this song ↗</button>
        </div>
      </section>
    </dialog>
  );
}
