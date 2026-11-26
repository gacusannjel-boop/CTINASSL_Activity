import AuthPage from './AuthPage.jsx';
import { useCallback, useEffect, useLayoutEffect, useState, useMemo, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import './App.css';
import './HomeSongSearch.css';
import sky from './assets/sky.png';
import flourish from './assets/mood/flourish.webp';
import { JournalPage, ListeningHistory } from './JournalPages.jsx';
import Scene from './Scene.jsx';
import SpotifyTrack from './SpotifyTrack.jsx';
import TrackDetails from './TrackDetails.jsx';
import { artUrl, preloadDiscs } from './disc-art.js';
import { trackMetadata } from './track-metadata.js';
import { journalDateError, todayInManila } from './journal-date.js';
import { worlds, tracks, featured as featuredTracks, spotifySearch, spotifyTrackIds } from './tracks.js';

const moodArtwork = import.meta.glob('./assets/mood/*.webp', { eager: true, query: '?url', import: 'default' });
function Flourishes(){return <div className="atmosphere" aria-hidden="true"><div className="sky-photo"/><div className="floral floral-left"/><div className="floral floral-right"/><svg className="growing-vines" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M-20 480 C 120 410 10 250 150 160 S 420 40 310 142 C 250 220 164 75 245 64 S 357 112 291 122"/><path d="M0 318 C85 310 170 221 111 178 S25 234 76 250 M118 193 C218 179 205 298 157 273 S168 219 177 247"/><path d="M1460 535 C1290 560 1410 740 1220 815 S1020 790 1100 713 C1160 656 1240 740 1172 764 S1099 739 1130 720"/><path d="M1440 692 C1355 672 1270 752 1320 785 S1402 753 1355 735"/></g></svg></div>}
const introTracks = featuredTracks.slice(0, 4);
const closingTracks = featuredTracks.slice(3, 6);

const handoff = gsap.parseEase('sine.inOut');
function sectionReveal(position) {
  return handoff(gsap.utils.clamp(0, 1, (.90 - position) / .58));
}

function useRunway(ref) {
  const [position, setPosition] = useState({ progress: 0, top: 1, bottom: 1 });
  useEffect(() => {
    const stage = ref.current;
    let frame;
    const update = () => {
      const distance = Math.max(1, stage.offsetHeight - stage.firstElementChild.offsetHeight);
      const { top, bottom } = stage.getBoundingClientRect();
      setPosition({ progress: -top / distance, top: top / window.innerHeight, bottom: bottom / window.innerHeight });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [ref]);
  return position;
}

function Opening({ motion, onComplete }) {
  const panel = useRef(null);
  const [progress, setProgress] = useState({ loaded: 0, total: tracks.length + 1 });
  const complete = useRef(onComplete);
  useEffect(() => { complete.current = onComplete; }, [onComplete]);
  useEffect(() => {
    let active = true;
    let reveal;
    const minimum = new Promise(resolve => setTimeout(resolve, motion ? 650 : 0));
    const assets = preloadDiscs([...tracks, viewAllDisc], (loaded, total) => {
      if (active) setProgress({ loaded, total });
    });
    Promise.all([assets, minimum]).then(() => {
      if (!active) return;
      if (!motion) { complete.current(); return; }
      reveal = gsap.to(panel.current, {
        clipPath: 'inset(0% 0% 100% 0%)',
        duration: .95,
        ease: 'power3.inOut',
        onComplete: () => complete.current()
      });
    });
    return () => { active = false; reveal?.kill(); };
  }, [motion]);
  const percent = Math.round(progress.loaded / progress.total * 100);
  return <div className="opening" ref={panel} role="dialog" aria-modal="true" aria-label="Loading Sonara">
    <div className="opening-orbit"><img src={artUrl(introTracks[0])} alt=""/></div>
    <span className="opening-wordmark">sonara<i>.</i></span>
    <progress aria-label="CD artwork loading progress" value={progress.loaded} max={progress.total}/>
    <span className="opening-percent">{percent}%</span>
  </div>;
}

function HomeStage({ onWorld, onBrowse, onSearch, query, scrollTo, lastWorld }) {
  const runway = useRef(null);
  const [selection, setSelection] = useState(() => worlds.findIndex(item => item.name === lastWorld));
  const [preview, setPreview] = useState(-1);
  const { progress: raw, bottom } = useRunway(runway);
  const progress = gsap.utils.clamp(0, 1, raw);
  const inWorlds = progress >= .56;
  const focus = inWorlds ? preview : -1;
  const active = inWorlds ? worlds[selection] : null;
  const introOpacity = 1 - gsap.utils.clamp(0, 1, (progress - .14) / .34);
  const worldsReveal = gsap.utils.clamp(0, 1, (progress - .40) / .22);
  const worldsExit = sectionReveal(bottom);

  function previewWorld(index) {
    if (!inWorlds) return;
    setPreview(index);
    if (index >= 0) setSelection(index);
  }

  function select(item) {
    if (!inWorlds) return;
    const index = worlds.indexOf(item);
    if (index === focus) onWorld(item.name);
    else {
      previewWorld(index);
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('query').trim();
    if (value) onSearch(value);
  }

  return <section className="home-runway" ref={runway} aria-label="Sonara worlds">
    <div className={'home-sticky ' + (inWorlds ? 'show-worlds' : 'show-intro')}
      data-world-selected={worlds[focus]?.name || ''} style={{
        '--worlds-opacity': worldsReveal * (1 - worldsExit),
        '--worlds-travel': `${(1 - worldsReveal) * 18 - worldsExit * 24}px`,
        '--worlds-exit-opacity': 1 - worldsExit
      }}>
      <div className="home-intro" style={{ opacity: introOpacity, '--intro-travel': `${progress * 90}px` }}
        aria-hidden={inWorlds}>
        <h1>Music for <i>every feeling.</i></h1>
        <p>{tracks.length} tracks · Four worlds</p>
      </div>
      {introOpacity > 0 && <form className="home-song-search" role="search" style={{ opacity: introOpacity }}
        onSubmit={submitSearch}>
        <input type="search" name="query" defaultValue={query} aria-label="Search songs or artists" placeholder="Search a song…" maxLength={120} required/>
        <button type="submit" aria-label="Search"><span aria-hidden="true"/></button>
      </form>}
      <div className="world-caption" aria-hidden={!inWorlds}>
        <div className="eyebrow">Worlds</div>
        {worlds.map((world, i) => <div className="world-details" key={world.id}
          data-visible={inWorlds && preview === i} aria-hidden={!inWorlds || preview !== i}
          style={{ '--world-center': `${22.4 + i * 18.4}%` }}>
          <h2>{world.name}</h2>
          <p>{world.description}</p>
          <span className="eyebrow">{world.tracks.length} tracks</span>
        </div>)}
      </div>
      <Scene mode="home" items={worlds} introItems={introTracks} progress={progress} focus={focus}
        onHover={previewWorld} onChoose={select}/>
      <div className="world-labels" inert={!inWorlds}>
        {worlds.map((world, i) => <button key={world.id} aria-pressed={i === focus}
          aria-label={i === focus ? 'Open ' + world.name + ' collection' : 'Focus ' + world.name}
          onPointerEnter={event => {
            if (event.pointerType === 'mouse') previewWorld(i);
          }}
          onPointerLeave={() => setPreview(-1)}
          onFocus={event => {
            if (event.currentTarget.matches(':focus-visible')) previewWorld(i);
          }}
          onBlur={() => setPreview(-1)}
          style={{ flexGrow: focus < 0 ? 1 : i === focus ? 1.6 : .8 }}
          onClick={() => select(world)}>{world.name}</button>)}
      </div>
      <div className="home-actions">
        {active && <button className="plain collection-action" onClick={() => onWorld(active.name)}>
          Open collection <span aria-hidden="true">↗</span>
        </button>}
        {inWorlds ? <button className="plain" onClick={() => onBrowse()}>Browse all tracks</button>
          : <button className="plain collection-action" onClick={() => scrollTo('#worlds')}>Explore the worlds <span aria-hidden="true">↓</span></button>}
      </div>
    </div>
    <div id="worlds" className="scroll-anchor"/>
  </section>;
}

const viewAllDisc = { id: 'featured-view-all', song: 'View All', artist: 'Sonara', world: 'Featured' };
const featuredSequence = [...featuredTracks, viewAllDisc];

function FeaturedRunway({ onChoose, onViewAll, scrollTo }) {
  const runway = useRef(null);
  const { progress: raw, top } = useRunway(runway);
  const progress = gsap.utils.clamp(0, 1, raw / .93);
  const headingReveal = sectionReveal(top);
  const index = Math.round(progress * (featuredSequence.length - 1));
  const open = track => track === viewAllDisc ? onViewAll() : onChoose(track);

  function move(direction) {
    const section = runway.current;
    const next = index + direction;
    const distance = section.offsetHeight - section.querySelector('.featured-sticky').offsetHeight;
    scrollTo(window.scrollY + section.getBoundingClientRect().top +
      distance * .93 * next / (featuredSequence.length - 1));
  }
  return <section id="featured-home" className="featured-runway" ref={runway}
    style={{
      '--featured-length': `${100 + 48 * (featuredSequence.length - 1)}svh`,
      '--featured-opacity': headingReveal,
      '--featured-travel': `${(1 - headingReveal) * 26}px`
    }}>
    <div className="featured-sticky">
      <header className="featured-heading"><h2>Featured</h2></header>
      <Scene mode="featured-scroll" items={featuredSequence} progress={progress} focus={index} onChoose={open}/>
      <div className="featured-scroll-footer">
        <span className="featured-counter">{String(index + 1).padStart(2, '0')} / {String(featuredSequence.length).padStart(2, '0')}</span>
        <button className="plain featured-current" onClick={() => open(featuredSequence[index])}>
          {index === featuredSequence.length - 1 ? 'View all featured' : 'Open featured'}
        </button>
        <div className="featured-navigation">
          <button className="plain" aria-label="Previous featured disc" disabled={index === 0}
            onClick={() => move(-1)}>←</button>
          <button className="plain" aria-label="Next featured disc" disabled={index === featuredSequence.length - 1}
            onClick={() => move(1)}>→</button>
        </div>
      </div>
    </div>
  </section>;
}
function createJournalForm() {
  return { song: '', artist: '', mood: 'Calm', afterMood: 'Calm', note: '', date: todayInManila() };
}

const trackLinksKey = 'sonara-track-links';
const navigationKey = 'sonara-navigation';
const pages = ['Home', 'Discover', 'Featured', 'Journal', 'Entries'];
const initialNavigation = { page: 'Home', world: 'All', query: '' };

// Keep the original playlist order for importing links, including the repeated track.
const originalPlaylistOrder = [
  '4-1', '4-2', '4-3', '2-1', '3-1', '1-1', '1-2', '3-2', '3-3', '1-3',
  '2-2', '2-3', '2-4', '4-4', '1-4', '4-5', '4-6', '4-7', '3-4', '3-5',
  '3-6', '2-10', '1-5', '3-7', '3-8', '3-9', '4-8', '2-5', '1-6', '4-9',
  '2-6', '2-7', '4-9', '1-7', '2-8', '1-9', '1-8', '3-10', '2-9',
];

function readNavigation() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(navigationKey));
    if ([...pages, 'Login', 'Register'].includes(saved?.page)) {
      return {
        page: saved.page,
        world: worlds.some(world => world.name === saved.world) ? saved.world : 'All',
        query: typeof saved.query === 'string' ? saved.query.trim().slice(0, 120) : '',
      };
    }
  } catch {
    // Use the home page if this browser cannot restore the session.
  }
  return initialNavigation;
}

function readTrackLinks() {
  try {
    return JSON.parse(localStorage.getItem(trackLinksKey) || '{}') || {};
  } catch {
    return {};
  }
}

function extractSpotifyTrackIds(value) {
  const trackLink = /(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/g;
  return Array.from(value.matchAll(trackLink), match => match[1]);
}

async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, {
    method,
    signal,
    ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(data?.error || 'Sonara couldn’t complete the request.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function journalRequest({ id, ...options } = {}) {
  return apiRequest(id ? `/api/entries/${encodeURIComponent(id)}` : '/api/entries', options);
}

export default function App(){
  const [navigation, setNavigation] = useState(readNavigation);
  const { page, world, query } = navigation;
  const activeWorld = worlds.find(entry => entry.name === world);
  const [opening, setOpening] = useState(() => page === 'Home');
  const lenisRef=useRef(null);
  const destination = useRef(null);
  const scrollTo=(target,immediate=false)=>{if(lenisRef.current)lenisRef.current.scrollTo(target,{immediate});else if(typeof target==='number')window.scrollTo({top:target,behavior:immediate?'instant':'smooth'});else document.querySelector(target)?.scrollIntoView({behavior:immediate?'instant':'smooth'});};
  useEffect(()=>{document.title='Sonara — Worlds of Sound';},[]);
  useEffect(() => {
    try {
      sessionStorage.setItem(navigationKey, JSON.stringify(navigation));
    } catch {
      // The current view remains usable if storage is unavailable.
    }
  }, [navigation]);
  
  const [menu,setMenu]=useState(false);
  const [motion]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{if(!motion)return;const lenis=new Lenis({autoRaf:false,lerp:.085,smoothWheel:true});lenisRef.current=lenis;const tick=t=>lenis.raf(t*1000);gsap.ticker.add(tick);return()=>{gsap.ticker.remove(tick);lenis.destroy();lenisRef.current=null;};},[motion]);
  useEffect(()=>{if(!motion)return;const el=document.querySelector('.full-menu');if(!el)return;const anim=gsap.fromTo(el.querySelectorAll('button'),{y:45,rotateX:-35,opacity:0,transformPerspective:800},{y:0,rotateX:0,opacity:1,stagger:.055,duration:.65,ease:'power3.out'});return()=>anim.kill();},[menu,motion]);
  useLayoutEffect(() => {
    if (!opening && !menu && page !== 'Discover') return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; };
  }, [opening, menu, page]);
  useLayoutEffect(() => {
    if (page !== 'Home' || opening || menu || !destination.current) return;
    const target = destination.current;
    destination.current = null;
    lenisRef.current?.resize();
    scrollTo(target, true);
  }, [page, menu, opening]);
  function navigate(item) {
    const anchor = { Discover: '#worlds', Featured: '#featured-home' }[item];
    if (anchor) {
      destination.current = anchor;
      if (page === 'Home') setMenu(false);
      else go('Home', false);
    } else go(item);
  }
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerActivated, setPlayerActivated] = useState(false);
  const [playerStarted, setPlayerStarted] = useState(false);
  const [playerUnavailable, setPlayerUnavailable] = useState(false);
  const [controller, setController] = useState(null);
  const [playback, setPlayback] = useState(null);
  const [linkSetup, setLinkSetup] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkStatus, setLinkStatus] = useState('');
  const [trackLinks, setTrackLinks] = useState(readTrackLinks);
  const [selected, setSelected] = useState(featuredTracks[0]);
  const [hoverTrack, setHoverTrack] = useState(null);
  const [detailsTrack, setDetailsTrack] = useState(null);
  const worldCollection = page === 'Discover' && Boolean(activeWorld);
  const hoverCollection = worldCollection || page === 'Featured';
  useEffect(() => {
    if (!hoverCollection || !playerActivated || !hoverTrack || hoverTrack.id === selected.id ||
      detailsTrack || playerOpen || linkSetup || menu) return;

    const timer = window.setTimeout(() => {
      setSelected(hoverTrack);
      setPlayerUnavailable(false);
      setPlayerStarted(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [hoverCollection, playerActivated, hoverTrack, selected.id, detailsTrack, playerOpen, linkSetup, menu]);

  function showTrackDetails(track) {
    setHoverTrack(null);
    setDetailsTrack(track);
  }

  function dismissTrackDetails() {
    setHoverTrack(null);
    setDetailsTrack(null);
  }

  const trackId = trackLinks[selected.id] || spotifyTrackIds[selected.id];
  const detailsTrackId = detailsTrack && (trackLinks[detailsTrack.id] || spotifyTrackIds[detailsTrack.id]);
  function choose(track) {
    if (track.id === selected.id && playback?.isPaused) controller?.resume();
    setHoverTrack(null);
    setSelected(track);
    setPlayerActivated(true);
    setPlayerUnavailable(false);
    setPlayerStarted(true);
    setPlayerOpen(false);
  }

  function openLinkSetup() {
    setHoverTrack(null);
    setLinkText('');
    setLinkStatus('');
    setLinkSetup(true);
  }

  function saveTrackLinks(importPlaylist) {
    const spotifyIds = extractSpotifyTrackIds(linkText);
    let trackIds = [selected.id];

    if (importPlaylist) {
      const orderWithoutDuplicate = [...new Set(originalPlaylistOrder)];
      trackIds = spotifyIds.length === orderWithoutDuplicate.length
        ? orderWithoutDuplicate
        : originalPlaylistOrder;
    }

    if (spotifyIds.length !== trackIds.length) {
      setLinkStatus(importPlaylist
        ? 'Paste 39 track links in original playlist order (or 38 with the duplicate removed).'
        : 'Paste one Spotify track link.');
      return;
    }

    const importedLinks = Object.fromEntries(trackIds.map((id, index) => [id, spotifyIds[index]]));
    const nextLinks = { ...trackLinks, ...importedLinks };
    setTrackLinks(nextLinks);
    localStorage.setItem(trackLinksKey, JSON.stringify(nextLinks));
    setLinkText('');
    setLinkStatus('Track links saved.');
    setLinkSetup(false);
    setPlayerUnavailable(false);
  }

  function togglePlayer() {
    if (!trackId) {
      openLinkSetup();
      return;
    }
    if (controller) {
      controller.togglePlay();
      return;
    }
    setHoverTrack(null);
    setPlayerActivated(true);
    setPlayerUnavailable(false);
    setPlayerStarted(true);
  }

  const handlePlayerError = useCallback(() => {
    setPlayerStarted(false);
    setPlayerUnavailable(true);
  }, []);
  function journalTrack(track) {
    setPlayerOpen(false);
    setEditing(null);
    setForm({
      ...createJournalForm(),
      song: track.song,
      artist: track.artist,
      mood: track.mood,
      afterMood: track.mood,
    });
    go('Journal');
  }
  function browse(name = 'All', query = '') {
    go('Discover', true, { world: name, query });
  }
  useEffect(() => {
    function resetOnEscape(event) {
      if (event.key !== 'Escape' || event.defaultPrevented || detailsTrack) return;
      setHoverTrack(null);
      setMenu(false);
      setPlayerOpen(false);
      setLinkSetup(false);
    }
    window.addEventListener('keydown', resetOnEscape);
    return () => window.removeEventListener('keydown', resetOnEscape);
  }, [detailsTrack]);
  const [user, setUser] = useState(undefined);
  const [authError, setAuthError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [registeringForJournal, setRegisteringForJournal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(createJournalForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [journalReady, setJournalReady] = useState(false);
  const [journalLoadError, setJournalLoadError] = useState('');
  const [journalLoadAttempt, setJournalLoadAttempt] = useState(0);
  const [journalBusy, setJournalBusy] = useState(false);
  const [minimumJournalDate, setMinimumJournalDate] = useState(todayInManila);
  const journalPage = page === 'Journal' || page === 'Entries';
  useEffect(() => {
    if (page !== 'Journal') return;
    let timer;
    function scheduleDateRefresh(now = new Date()) {
      window.clearTimeout(timer);
      const today = todayInManila(now);
      const nextMidnight = Date.parse(`${today}T00:00:00+08:00`) + 24 * 60 * 60 * 1000;
      timer = window.setTimeout(refreshDate, nextMidnight - now.getTime());
    }
    function refreshDate() {
      const now = new Date();
      setMinimumJournalDate(todayInManila(now));
      scheduleDateRefresh(now);
    }
    scheduleDateRefresh();
    window.addEventListener('focus', refreshDate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refreshDate);
    };
  }, [page]);
  useEffect(() => {
    const request = new AbortController();
    apiRequest('/api/auth/me', { signal: request.signal })
      .then(({ user }) => { if (!request.signal.aborted) setUser(user); })
      .catch(() => { if (!request.signal.aborted) setUser(null); });
    return () => request.abort();
  }, []);

  useEffect(() => {
    if (!user || !journalPage || journalReady) return;
    const request = new AbortController();
    journalRequest({ signal: request.signal }).then(data => {
      if (request.signal.aborted) return;
      if (!Array.isArray(data)) throw new Error('The journal server returned an invalid response.');
      setEntries(data);
      setJournalReady(true);
    }).catch(failure => {
      if (request.signal.aborted) return;
      if (failure.status === 401) setUser(null);
      else setJournalLoadError('Couldn’t connect to the journal database.');
    });
    return () => request.abort();
  }, [user, journalPage, journalReady, journalLoadAttempt]);

  function clearJournal() {
    setEntries([]);
    setJournalReady(false);
    setJournalLoadError('');
    setEditing(null);
    setForm(createJournalForm());
  }

  async function authenticate(credentials, registering) {
    const action = registering ? 'register' : 'login';
    const result = await apiRequest(`/api/auth/${action}`, { method: 'POST', body: credentials });
    setUser(result.user);
    setRegisteringForJournal(false);
    if (!journalPage) go('Entries');
  }

  async function logout() {
    if (journalBusy || logoutBusy) return;
    setLogoutBusy(true);
    setAuthError('');
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      clearJournal();
      setUser(null);
      go('Home');
    } catch {
      setAuthError('Couldn’t log out. Try again.');
      setMenu(false);
    } finally {
      setLogoutBusy(false);
    }
  }

  function go(page, resetScroll = true, changes = {}) {
    setHoverTrack(null);
    setMenu(false);
    setNavigation(current => ({ ...current, ...changes, page }));
    setMessage('');
    setError('');
    if (page === 'Journal') setMinimumJournalDate(todayInManila());
    if (page !== 'Journal' && page !== 'Entries') setJournalLoadError('');
    if (resetScroll) scrollTo(0, true);
  }
  function startJournalEntry() {
    setEditing(null);
    setForm(createJournalForm());
    go('Journal');
  }

  function editJournalEntry(entry) {
    const { _id, song, artist, date, mood, afterMood, note } = entry;
    setEditing({ id: _id, date });
    setForm({ song, artist, date, mood, afterMood, note: note ?? '' });
    go('Journal');
  }

  async function changeJournal(options, update, success) {
    if (journalBusy || logoutBusy) return;
    setError('');
    setMessage('');
    setJournalBusy(true);
    try {
      const result = await journalRequest(options);
      setEntries(current => update(current, result));
      success();
    } catch (failure) {
      if (failure.status === 401) {
        clearJournal();
        setUser(null);
      }
      setError(failure.message);
    } finally {
      setJournalBusy(false);
    }
  }

  async function saveJournalEntry(event) {
    event.preventDefault();
    if (!journalReady || journalBusy || logoutBusy) return;
    const values = { ...form, song: form.song.trim(), artist: form.artist.trim(), note: form.note.trim() };
    if (!values.song || !values.artist) {
      setError('Enter a song and artist.');
      return;
    }
    const dateError = values.date === editing?.date ? '' : journalDateError(values.date);
    if (dateError) {
      setMinimumJournalDate(todayInManila());
      setError(dateError);
      return;
    }
    await changeJournal(
      { method: editing ? 'PUT' : 'POST', id: editing?.id, body: values },
      (current, entry) => editing ? current.map(item => item._id === entry._id ? entry : item) : [entry, ...current],
      () => {
        setEditing(null);
        setForm(createJournalForm());
        go('Entries');
        setMessage(editing ? 'Listening entry updated.' : 'Listening entry saved.');
      },
    );
  }

  function toggleFavorite(entry) {
    const favorite = entry.favorite !== true;
    return changeJournal(
      { method: 'PATCH', id: entry._id, body: { favorite } },
      (current, saved) => current.map(item => item._id === saved._id ? saved : item),
      () => setMessage(favorite ? 'Added to favorites.' : 'Removed from favorites.'),
    );
  }

  function deleteJournalEntry(id) {
    if (journalBusy || logoutBusy || !window.confirm('Delete this listening entry?')) return;
    return changeJournal(
      { method: 'DELETE', id },
      current => current.filter(entry => entry._id !== id),
      () => setMessage('Entry deleted.'),
    );
  }
  const collection = useMemo(() => world === 'All' ? tracks : tracks.filter(track => track.world === world), [world]);
  const results = useMemo(() => {
    if (!query) return null;
    const terms = query.toLowerCase().split(/\s+/);
    return collection.filter(track => {
      const text = `${track.song} ${track.artist} ${track.world} ${track.mood}`.toLowerCase();
      return terms.every(term => text.includes(term));
    });
  }, [collection, query]);
  const galleryTitle = query ? 'Search results' : activeWorld?.name || 'All worlds';
  const trackCount = results?.length ?? collection.length;
  const authPage = page === 'Login' || page === 'Register';
  const registering = page === 'Register' || (journalPage && registeringForJournal);
  const showAuth = authPage || (journalPage && user === null);
  return <div className={motion?"site":"site quiet-motion"} style={{'--flourish':`url(${flourish})`,'--sky-photo':`url(${sky})`}}><Flourishes/>
    {opening && <Opening motion={motion} onComplete={() => setOpening(false)}/>}
    <div className="site-content" inert={opening ? true : undefined}>
    <header className="nav"><button className="logo" onClick={()=>go('Home')} aria-label="Sonara home">sonara<span>.</span></button><button className={'menu-icon '+(menu?'open':'')} onClick={()=>{setHoverTrack(null);setMenu(v=>!v);}} aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu}><span/><span/><span/></button></header>
    {menu && <nav className="full-menu" aria-label="Main navigation" data-lenis-prevent>
      {pages.map(item =>
        <button key={item} onClick={() => navigate(item)}>{item === 'Discover' ? 'Worlds' : item === 'Entries' ? 'Listening history' : item}</button>
      )}
      {user
        ? <button disabled={journalBusy || logoutBusy} onClick={logout}>Log out</button>
        : <button onClick={() => go('Login')}>Log in</button>}
    </nav>}

    {authError && <div role="alert" className="alert error">{authError}{' '}
      <button onClick={() => setAuthError('')}>Dismiss</button>
    </div>}

    {journalPage && journalLoadError && <div role="alert" className="alert error">{journalLoadError}{' '}
      <button onClick={() => { setJournalLoadError(''); setJournalLoadAttempt(attempt => attempt + 1); }}>Retry</button>
    </div>}
    {journalPage && error && <div role="alert" className="alert error">{error} <button onClick={()=>setError('')}>Dismiss</button></div>}
    {journalPage && message && <div role="status" className="alert">{message}</div>}
    <main className={page === 'Home' ? 'home-page' : undefined} inert={menu ? true : undefined}>
    {page==='Home'&&<>
      <HomeStage lastWorld={world} onWorld={browse} onBrowse={browse}
        onSearch={query => browse('All', query)} query={query} scrollTo={scrollTo}/>
      <FeaturedRunway scrollTo={scrollTo} onChoose={choose} onViewAll={() => go('Featured')}/>
      <section className="closing">
        <Scene mode="ambient" items={closingTracks} onChoose={choose}/>
        <h2>Every feeling has a frequency.</h2>
        <p>Make a little note of the music that stays with you.</p>
        <button className="pill" onClick={startJournalEntry}>Open your journal ↗</button>
      </section>
    </>}
    {page === 'Discover' && (
      <section className="gallery-page" data-environment={activeWorld?.id} style={{
        '--tint': activeWorld?.color || '#f0bfd9',
        '--world-art': activeWorld ? `url(${moodArtwork[`./assets/mood/${activeWorld.art}.webp`]})` : 'none',
      }}>
        <div className="sky" data-lenis-prevent>
          <Scene key={world} items={collection} results={results} onChoose={choose}
            onHover={worldCollection && !detailsTrack ? (_, track) => setHoverTrack(track ?? null) : undefined}
            worldId={activeWorld?.id} mode="gallery"
            onDetails={showTrackDetails} detailsOpen={Boolean(detailsTrack)}/>
        </div>
        <div className="gallery-head">
          <button className="plain gallery-back" onClick={query ? () => go('Home') : () => navigate('Discover')}>
            {query ? '← Search' : '← Open collection'}
          </button>
          <div>
            <div className="eyebrow">{trackCount} {trackCount === 1 ? 'track' : 'tracks'}{activeWorld && ` · ${activeWorld.mood}`}</div>
            <h2>{galleryTitle}</h2>
            {query && <p className="gallery-query">“{query}”</p>}
          </div>
        </div>
        {trackCount === 0 && <p className="no-results">No matching tracks.</p>}
      </section>
    )}
    {page === 'Featured' && (
      <section className="gallery-page" data-environment="featured">
        <div className="sky" data-lenis-prevent>
          <Scene worldId="featured" items={featuredTracks} onChoose={choose}
            onHover={!detailsTrack ? (_, track) => setHoverTrack(track ?? null) : undefined}
            onDetails={showTrackDetails} detailsOpen={Boolean(detailsTrack)}/>
        </div>
        <div className="gallery-head">
          <button className="plain gallery-back" onClick={() => navigate('Featured')}>← Back</button>
          <div>
            <div className="eyebrow">{featuredTracks.length} tracks</div>
            <h2>Featured</h2>
          </div>
        </div>
      </section>
    )}
    {journalPage && user === undefined && <section className="section subpage"><p role="status">Checking session…</p></section>}
    {showAuth && <AuthPage key={registering ? 'register' : 'login'} registering={registering}
      onSubmit={credentials => authenticate(credentials, registering)}
      onSwitch={() => journalPage ? setRegisteringForJournal(!registering) : go(registering ? 'Login' : 'Register')}
    />}
    {page === 'Journal' && user && (
      <JournalPage
        form={form}
        setForm={setForm}
        editing={Boolean(editing)}
        minimumDate={form.date === editing?.date && form.date < minimumJournalDate ? form.date : minimumJournalDate}
        canSave={journalReady && !journalBusy && !logoutBusy}
        onSave={saveJournalEntry}
        onCancel={() => { setEditing(null); setForm(createJournalForm()); go('Entries'); }}
        onChooseTrack={choose}
      />
    )}
    {page === 'Entries' && user && (
      <ListeningHistory
        entries={entries}
        ready={journalReady}
        busy={journalBusy || logoutBusy}
        loadingError={journalLoadError}
        onNewEntry={startJournalEntry}
        onToggleFavorite={toggleFavorite}
        onEdit={editJournalEntry}
        onDelete={deleteJournalEntry}
      />
    )}
    </main>
    {playerActivated && <div className="bottom-player" role="region" aria-label="Music player">
      <progress className="player-progress" aria-label="Track progress" max={playback?.duration || 1}
        value={playback?.position || 0}/>
      <button className="player-song" aria-label={`Track options for ${selected.song}`}
        aria-expanded={playerOpen} aria-controls="track-options" onClick={() => setPlayerOpen(open => !open)}>
        <img src={artUrl(selected)} alt=""/><span><strong>{selected.song}</strong><small>{selected.artist}</small></span>
      </button>
      <button className="player-transport" aria-label={playback?.isPaused === false ? 'Pause' : 'Play'}
        onClick={togglePlayer}>
        <span aria-hidden="true">{playback?.isPaused === false ? 'Ⅱ' : '▶'}</span>
      </button>
      <a className={playerUnavailable ? 'playback-fallback' : undefined}
        href={trackId ? `https://open.spotify.com/track/${trackId}` : spotifySearch(selected)}
        target="_blank" rel="noreferrer">
        {playerUnavailable ? 'Playback unavailable · Open in Spotify ↗' : 'Spotify ↗'}
      </a>
      <div className="track-options" id="track-options" hidden={!playerOpen}>
        <button className="plain" onClick={() => journalTrack(selected)}>Journal this song ↗</button>
        <button className="plain" onClick={openLinkSetup}>{trackId ? 'Change track link' : 'Link this song'}</button>
      </div>
    </div>}
    {playerStarted && trackId && <SpotifyTrack key={trackId} id={trackId}
      onController={setController} onPlayback={setPlayback} onError={handlePlayerError}/>}
    {detailsTrack && <TrackDetails
      track={detailsTrack}
      featured={page === 'Featured'}
      metadata={trackMetadata[detailsTrack.id]}
      spotifyUrl={detailsTrackId ? `https://open.spotify.com/track/${detailsTrackId}` : spotifySearch(detailsTrack)}
      playing={detailsTrack.id === selected.id && playback?.isPaused === false}
      onToggle={detailsTrackId ? () => detailsTrack.id === selected.id ? togglePlayer() : choose(detailsTrack) : undefined}
      onJournal={() => { dismissTrackDetails(); journalTrack(detailsTrack); }}
      onDismiss={dismissTrackDetails}
    />}
    {linkSetup && (
      <div className="modal-shade" data-lenis-prevent>
        <section className="link-dialog" role="dialog" aria-modal="true" aria-label="Connect Spotify tracks">
          <button className="plain" onClick={() => setLinkSetup(false)}>Close ×</button>
          <h2>Connect your songs.</h2>
          <p>Paste one link for {selected.song}, or copy all tracks in the original playlist order and paste them together.</p>
          <textarea
            rows={6}
            value={linkText}
            onChange={event => setLinkText(event.target.value)}
            placeholder="https://open.spotify.com/track/…"
          />
          <div className="actions">
            <button className="primary" onClick={() => saveTrackLinks(false)}>Save selected song</button>
            <button className="primary" onClick={() => saveTrackLinks(true)}>Import all songs</button>
          </div>
          <p role="status">{linkStatus}</p>
        </section>
      </div>
    )}
    </div>
  </div>;
}
