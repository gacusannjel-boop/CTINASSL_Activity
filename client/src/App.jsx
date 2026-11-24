import { useEffect, useState, useMemo, useRef } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import './App.css';
import sky from './assets/sky.png';
import flourish from './assets/mood/flourish.webp';
import { API } from './mood-config.js';

const moods = ['Calm', 'Happy', 'Sad', 'Energetic', 'Nostalgic', 'Stressed'];
import Scene, {artUrl, preloadDiscs} from './Scene.jsx';
import {worlds, tracks, featured as featuredTracks, playlist, spotifySearch} from './tracks.js';
function Flourishes(){return <div className="atmosphere" aria-hidden="true"><div className="sky-photo"/><div className="floral floral-left"/><div className="floral floral-right"/><svg className="growing-vines" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M-20 480 C 120 410 10 250 150 160 S 420 40 310 142 C 250 220 164 75 245 64 S 357 112 291 122"/><path d="M0 318 C85 310 170 221 111 178 S25 234 76 250 M118 193 C218 179 205 298 157 273 S168 219 177 247"/><path d="M1460 535 C1290 560 1410 740 1220 815 S1020 790 1100 713 C1160 656 1240 740 1172 764 S1099 739 1130 720"/><path d="M1440 692 C1355 672 1270 752 1320 785 S1402 753 1355 735"/></g></svg></div>}
const introTracks = featuredTracks.slice(0, 4);
const closingTracks = featuredTracks.slice(3);
const journalDiscs = featuredTracks.slice(0, 2);

function useRunway(ref) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const stage = ref.current;
    let frame;
    const update = () => {
      const distance = Math.max(1, stage.offsetHeight - stage.firstElementChild.offsetHeight);
      setProgress(Math.max(0, Math.min(1, -stage.getBoundingClientRect().top / distance)));
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
  return progress;
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

function HomeStage({ onWorld, onBrowse, scrollTo }) {
  const runway = useRef(null);
  const copy = useRef(null);
  const [selection, setSelection] = useState(-1);
  const [hover, setHover] = useState(-1);
  const progress = useRunway(runway);
  const inWorlds = progress >= .56;
  const focus = inWorlds ? selection : -1;
  const active = worlds[focus];
  const introOpacity = 1 - Math.min(1, Math.max(0, (progress - .14) / .34));

  useEffect(() => {
    const heading = copy.current;
    if (!heading || heading.closest('.quiet-motion')) return;
    const tween = gsap.fromTo(heading, { y: 14, rotateX: -18, clipPath: 'inset(0 0 100% 0)' }, {
      y: 0, rotateX: 0, clipPath: 'inset(0 0 0% 0)', duration: .48, ease: 'power3.out'
    });
    return () => tween.kill();
  }, [active]);

  function select(item) {
    if (!inWorlds) return;
    const index = worlds.indexOf(item);
    if (index === focus) onWorld(item.name);
    else setSelection(index);
  }

  return <section className="home-runway" ref={runway} aria-label="Sonara worlds">
    <div className={'home-sticky ' + (inWorlds ? 'show-worlds' : 'show-intro')}
      data-world-selected={active?.name || ''} data-open-collection={active && hover === focus ? 'true' : undefined}>
      <div className="home-intro" style={{ opacity: introOpacity, '--intro-travel': progress * 90 + 'px' }}
        aria-hidden={inWorlds}>
        <h1>Music for <i>every feeling.</i></h1>
        <p>{tracks.length} tracks · Four worlds</p>
      </div>
      {inWorlds && <div className="world-caption">
        <div className="eyebrow">Worlds</div>
        {active && <div ref={copy} className="world-details" key={active.id}>
          <h2>{active.name}</h2>
          <p>{active.description}</p>
          <span className="eyebrow">{active.tracks.length} tracks</span>
        </div>}
      </div>}
      <Scene mode="home" items={worlds} introItems={introTracks} progress={progress} focus={focus}
        onHover={setHover} onChoose={select}/>
      {inWorlds && <div className="world-labels">
        {worlds.map((world, i) => <button key={world.id} aria-pressed={i === focus}
          aria-label={i === focus ? 'Open ' + world.name + ' collection' : 'Focus ' + world.name}
          onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(-1)}
          style={{ flexGrow: focus < 0 ? 1 : i === focus ? 1.6 : .8 }}
          onClick={() => select(world)}>{world.name}</button>)}
      </div>}
      <div className="home-actions">
        {inWorlds ? <button className="plain" onClick={() => onBrowse()}>Browse all tracks</button>
          : <button className="plain" onClick={() => scrollTo('#worlds')}>Explore the worlds</button>}
        <span className="eyebrow">{inWorlds ? 'Select a collection' : 'Scroll to explore'}</span>
      </div>
    </div>
    <div id="worlds" className="scroll-anchor"/>
  </section>;
}

const viewAllDisc = { id: 'featured-view-all', song: 'View All', artist: 'Sonara', world: 'Featured' };
const featuredSequence = [...featuredTracks, viewAllDisc];

function FeaturedRunway({ onChoose, onViewAll }) {
  const runway = useRef(null);
  const raw = useRunway(runway);
  const progress = Math.min(1, raw / .93);
  const index = Math.round(progress * (featuredSequence.length - 1));
  const open = track => track === viewAllDisc ? onViewAll() : onChoose(track);
  return <section id="featured-home" className="featured-runway" ref={runway}
    style={{ '--featured-length': `${100 + 48 * (featuredSequence.length - 1)}svh` }}>
    <div className="featured-sticky">
      <header className="featured-heading"><div className="eyebrow">Featured</div><h2>Sounds worth staying for.</h2></header>
      <Scene mode="featured-scroll" items={featuredSequence} progress={progress} focus={index} onChoose={open}/>
      <div className="featured-scroll-footer">
        <span className="featured-counter">{String(index + 1).padStart(2, '0')} / {String(featuredSequence.length).padStart(2, '0')}</span>
        <button className="plain featured-current" onClick={() => open(featuredSequence[index])}>
          {index === featuredSequence.length - 1 ? 'View all featured' : 'Listen to this disc'}
        </button>
        <span className="featured-scroll-hint">Scroll to continue</span>
      </div>
    </div>
  </section>;
}

function Cursor() {
  const node = useRef(null);
  useEffect(() => {
    function move(event) {
      const cursor = node.current;
      cursor.style.translate = event.clientX + 'px ' + event.clientY + 'px';
      cursor.dataset.visible = event.pointerType === 'mouse' && !event.target.closest('.opening, .modal-shade, .listen-panel') ? 'true' : 'false';
    }
    function hide() { node.current.dataset.visible = 'false'; }
    document.addEventListener('pointermove', move);
    document.documentElement.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);
  return <div className="sonara-cursor" ref={node} aria-hidden="true"><span>Open Collection</span></div>;
}

const blank = () => ({song:'',artist:'',mood:'Calm',afterMood:'Calm',note:'',date:new Date().toISOString().slice(0,10)});
const readLocal = () => { try { return JSON.parse(localStorage.getItem('sonara-mood-entries') || '[]'); } catch { return []; } };
async function request(path='', method='GET', body) {
  const r = await fetch(`${API}/api/entries${path}`, {method, headers:{'Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {})});
  const data = await r.json(); if(!r.ok) throw new Error(data.error || 'Request failed'); return data;
}
export default function App(){
  const [page,setPage]=useState('Home');
  const [opening, setOpening] = useState(true);
  const [indexOpen,setIndexOpen]=useState(false);
  const lenisRef=useRef(null);
  const destination = useRef(null);
  const scrollTo=(target,immediate=false)=>{if(lenisRef.current)lenisRef.current.scrollTo(target,{immediate});else if(typeof target==='number')window.scrollTo({top:target,behavior:immediate?'instant':'smooth'});else document.querySelector(target)?.scrollIntoView({behavior:immediate?'instant':'smooth'});};
  useEffect(()=>{document.title='Sonara — Worlds of Sound';},[]);
  
  const [world,setWorld]=useState('All');
  const [featured,setFeatured]=useState(null);
  const [menu,setMenu]=useState(false);
  const [motion,setMotion]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{if(!motion)return;const lenis=new Lenis({autoRaf:false,lerp:.085,smoothWheel:true});lenisRef.current=lenis;const tick=t=>lenis.raf(t*1000);gsap.ticker.add(tick);return()=>{gsap.ticker.remove(tick);lenis.destroy();lenisRef.current=null;};},[motion]);
  useEffect(()=>{if(!motion)return;const el=document.querySelector('.full-menu');if(!el)return;const anim=gsap.fromTo(el.querySelectorAll('button'),{y:45,rotateX:-35,opacity:0,transformPerspective:800},{y:0,rotateX:0,opacity:1,stagger:.055,duration:.65,ease:'power3.out'});return()=>anim.kill();},[menu,motion]);
  useEffect(() => {
    if (!opening && !menu && page !== 'Discover') return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; };
  }, [opening, menu, page]);
  useEffect(() => {
    if (page !== 'Home' || menu || !destination.current) return;
    const target = destination.current;
    destination.current = null;
    scrollTo(target);
  }, [page, menu]);
  function navigate(item) {
    const anchor = { Discover: '#worlds', Featured: '#featured-home' }[item];
    if (anchor) {
      destination.current = anchor;
      if (page === 'Home') setMenu(false);
      else go('Home');
    } else go(item);
  }
  const [playerOpen,setPlayerOpen]=useState(false);
  const [linkSetup,setLinkSetup]=useState(false);
  const [linkText,setLinkText]=useState('');
  const [linkStatus,setLinkStatus]=useState('');
  const [trackLinks,setTrackLinks]=useState(()=>{try{return JSON.parse(localStorage.getItem('sonara-track-links')||'{}')}catch{return {}}});
  const knownLinks={'3-1':'1f5dsqdM1SVsgWSy3R4eZG'};
  const playlistOrder=['4-1','4-2','4-3','2-1','3-1','1-1','1-2','3-2','3-3','1-3','2-2','2-3','2-4','4-4','1-4','4-5','4-6','4-7','3-4','3-5','3-6','2-10','1-5','3-7','3-8','3-9','4-8','2-5','1-6','4-9','2-6','2-7','4-9','1-7','2-8','1-9','1-8','3-10','2-9'];
  function extractIds(value){return Array.from(value.matchAll(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/g),m=>m[1]);}
  function saveLinks(all=false){const ids=extractIds(linkText);let order=playlistOrder;if(all&&ids.length===38)order=playlistOrder.filter((x,i)=>playlistOrder.indexOf(x)===i);if((all&&ids.length!==order.length)||(!all&&ids.length!==1)){setLinkStatus(all?'Paste 39 track links in original playlist order (or 38 with the duplicate removed).':'Paste one Spotify track link.');return;}const additions=all?Object.fromEntries(order.map((x,i)=>[x,ids[i]])):{[selected.id]:ids[0]};const next={...trackLinks,...additions};setTrackLinks(next);localStorage.setItem('sonara-track-links',JSON.stringify(next));setLinkText('');setLinkStatus('Track links saved.');setLinkSetup(false);setPlayerOpen(true);}
  
  const [selected,setSelected]=useState(featuredTracks[0]);
  const trackId=trackLinks[selected.id]||knownLinks[selected.id];
  function choose(t){setSelected(t);setFeatured(t);setPlayerOpen(true);}
  function journalTrack(t){setForm({...blank(),song:t.song,artist:t.artist,mood:t.mood,afterMood:t.mood});setEditing(null);setFeatured(null);go('Journal');}
  function browse(name='All'){setWorld(name);setSearch('');setIndexOpen(false);go('Discover');}
  const [search,setSearch]=useState('');
  useEffect(()=>{const key=e=>{if(e.key==='Escape'){setMenu(false);setFeatured(null);setPlayerOpen(false);setLinkSetup(false);setSearch('');}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const [entries,setEntries]=useState(()=>API?[]:readLocal());
  const [form,setForm]=useState(blank);
  const [editing,setEditing]=useState(null);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(!API);
  useEffect(()=>{if(API){request().then(setEntries).then(()=>setLoaded(true)).catch(e=>setError(e.message+' — check the server connection.'));}},[]);
  useEffect(()=>{if(!API)localStorage.setItem('sonara-mood-entries',JSON.stringify(entries));},[entries]);
  function go(p){setMenu(false);setPage(p);setMessage('');scrollTo(0,true);}
  function start(mood='Calm'){setForm({...blank(),mood,afterMood:mood});setEditing(null);go('Journal');}
  function edit(entry){const {_id,...values}=entry;setForm({...blank(),...values});setEditing(_id);go('Journal');}
  async function save(e){e.preventDefault();setBusy(true);setError('');try{
    const values={...form,song:form.song.trim(),artist:form.artist.trim(),note:form.note.trim()};
    if(!values.song || !values.artist)throw new Error('Enter a song and artist.');
    const item=API?await request(editing?`/${editing}`:'',editing?'PUT':'POST',values):{...values,_id:editing||crypto.randomUUID()};
    setEntries(old=>editing?old.map(x=>x._id===editing?item:x):[item,...old]);
    setEditing(null);setForm(blank());setPage('Entries');setMessage('Listening entry saved.');scrollTo(0,true);
  }catch(e){setError(e.message);}finally{setBusy(false);}}
  async function remove(id){if(!window.confirm('Delete this listening entry?'))return;setBusy(true);setError('');try{if(API)await request(`/${id}`,'DELETE');setEntries(old=>old.filter(x=>x._id!==id));setMessage('Entry deleted.');}catch(e){setError(e.message);}finally{setBusy(false);}}
  const visible=useMemo(()=>tracks.filter(t=>(world==='All'||t.world===world)&&search.trim().toLowerCase().split(/\s+/).every(q=>`${t.song} ${t.artist} ${t.world} ${t.mood} ${worlds.find(w=>w.name===t.world)?.description||''}`.toLowerCase().includes(q))),[world,search]);
  const activeWorld=worlds.find(w=>w.name===world);
  const collection = useMemo(() => world === 'All' ? tracks : tracks.filter(track => track.world === world), [world]);
  return <div className={motion?"site":"site quiet-motion"} style={{'--flourish':`url(${flourish})`,'--sky-photo':`url(${sky})`}}><Flourishes/><Cursor/>
    {opening && <Opening motion={motion} onComplete={() => setOpening(false)}/>}
    <div className="site-content" inert={opening ? true : undefined}>
    <header className="nav"><button className="logo" onClick={()=>go('Home')} aria-label="Sonara home">sonara<span>.</span></button><button className={'menu-icon '+(menu?'open':'')} onClick={()=>setMenu(v=>!v)} aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu}><span/><span/><span/></button></header>
    {menu&&<div className="full-menu" data-lenis-prevent>{['Home','Discover','Featured','Journal','Entries'].map(p=><button key={p} onClick={()=>navigate(p)}>{p==='Discover'?'Worlds':p==='Entries'?'Listening history':p}</button>)}<div className="menu-worlds">{['All',...worlds.map(w=>w.name)].map(w=><button key={w} onClick={()=>browse(w)}>{w==='All'?'All tracks':w}</button>)}</div><button className="plain motion-choice" onClick={()=>{setMenu(false);setLinkText('');setLinkStatus('');setLinkSetup(true);}}>Connect song links</button><button className="plain motion-choice" onClick={()=>setMotion(v=>!v)}>{motion?'Pause motion':'Resume motion'}</button></div>}

    {error&&<div role="alert" className="alert error">{error} <button onClick={()=>setError('')}>Dismiss</button></div>}
    {message&&<div role="status" className="alert">{message}</div>}
    <main inert={menu ? true : undefined}>
    {page==='Home'&&<>
      <HomeStage onWorld={browse} onBrowse={browse} scrollTo={scrollTo}/>
      <FeaturedRunway onChoose={choose} onViewAll={()=>go('Featured')}/>
      <section className="closing"><Scene mode="ambient" items={closingTracks} onChoose={choose}/><h2>Every feeling has a frequency.</h2><p>Make a little note of the music that stays with you.</p><button className="pill" onClick={()=>start()}>Open your journal ↗</button></section>
    </>}
    {page==='Discover'&&<section className="gallery-page" style={{'--tint':activeWorld?.color||'#f0bfd9'}}><div className="sky" data-lenis-prevent><Scene key={world} items={collection} results={search.trim() ? visible : null} onChoose={choose} mode="gallery"/></div><div className="gallery-head"><div><div className="eyebrow">{visible.length} {visible.length === 1 ? 'track' : 'tracks'}</div><h2>{world==='All'?'All worlds.':world+'.'}</h2></div><div className="gallery-search"><input aria-label="Search songs" placeholder="Search a song, artist or mood…" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button className="plain" onClick={()=>setSearch('')}>Clear ×</button>}</div></div><div className="gallery-hint">DRAG · SCROLL OR PINCH TO ZOOM · WASD</div><button className="plain gallery-index" onClick={()=>setIndexOpen(v=>!v)}>{indexOpen?'Hide track index':'Track index ↗'}</button>{indexOpen&&<div className="gallery-index-panel" data-lenis-prevent><button className="plain" onClick={()=>setIndexOpen(false)}>Close ×</button><div className="track-list">{visible.map(t=><button key={t.id} onClick={()=>{setIndexOpen(false);choose(t);}}><img src={artUrl(t)} alt=""/><span className="sr-only">{t.song} — {t.artist}</span></button>)}</div></div>}{!visible.length&&<p className="no-results">No matching tracks.</p>}</section>}
    {page==='Featured'&&<section className="featured-full"><button className="plain back-featured" onClick={()=>go('Home')}>← Back</button><div className="eyebrow">HANDPICKED / ON REPEAT</div><h2>Featured.</h2><Scene mode="results" items={featuredTracks} onChoose={choose}/><button className="plain" onClick={()=>setIndexOpen(v=>!v)}>{indexOpen?'Hide track index':'Track index'}</button>{indexOpen&&<div className="track-list">{featuredTracks.map(t=><button key={t.id} onClick={()=>choose(t)}><img src={artUrl(t)} alt=""/><span className="sr-only">{t.song} — {t.artist}</span></button>)}</div>}</section>}
    {page==='Journal'&&<section className="section subpage"><div className="eyebrow">02 / LISTENING JOURNAL</div><h2>{editing?'Edit a memory.':'A little moment for you.'}</h2><p>Write a listening entry and notice how your mood changes.</p><div className="journal-layout"><form onSubmit={save} className="journal"><label>Song or album<input required maxLength={120} value={form.song} onChange={e=>setForm({...form,song:e.target.value})} placeholder="e.g. A favorite song"/></label><label>Artist<input required maxLength={120} value={form.artist} onChange={e=>setForm({...form,artist:e.target.value})} placeholder="Artist name"/></label><label>Date<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><div className="two"><label>Mood before<select value={form.mood} onChange={e=>setForm({...form,mood:e.target.value})}>{moods.map(m=><option key={m}>{m}</option>)}</select></label><label>Mood after<select value={form.afterMood} onChange={e=>setForm({...form,afterMood:e.target.value})}>{moods.map(m=><option key={m}>{m}</option>)}</select></label></div><label>Listening reflection (optional)<textarea maxLength={600} rows={4} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="What did you notice? Use sample reflections for this demo."/></label><div className="actions"><button className="primary" disabled={busy||!loaded}>{busy?'Saving…':editing?'Save changes':'Save entry'} ♡</button><button type="button" className="secondary" onClick={()=>go('Entries')}>Cancel</button></div></form><aside className="journal-aside"><Scene mode="ambient" items={journalDiscs} onChoose={choose}/><h3>Every feeling has a frequency.</h3><p>This is a classroom demo, not a private journal or a mental-health assessment. Please use fictional entries only.</p></aside></div></section>}
    {page==='Entries'&&<section className="section subpage"><div className="section-head"><div><div className="eyebrow">03 / YOUR LISTENING HISTORY</div><h2>Little memories.</h2></div><button className="primary" onClick={()=>start()}>+ New entry</button></div><div className="summary"><div><small>LISTENING ENTRIES</small><strong>{entries.length}</strong></div><div><small>MOODS RECORDED</small><strong>{new Set(entries.map(x=>x.mood)).size}</strong></div><div><small>DATA MODE</small><strong>{API?'MongoDB':'Local demo'}</strong></div></div><div className="entries">{!loaded?<p>Waiting for server connection…</p>:entries.length===0?<div className="empty">♡<h3>No listening entries yet.</h3><button className="secondary" onClick={()=>start()}>Create your first entry</button></div>:entries.map(x=><article key={x._id} className="entry"><div><small>{x.date} • {x.artist}</small><h3>{x.song}</h3><span className="moodtag">{x.mood} → {x.afterMood}</span><p>{x.note}</p></div><div className="actions"><button className="secondary" disabled={busy} onClick={()=>edit(x)}>Edit</button><button className="secondary danger" disabled={busy} onClick={()=>remove(x._id)}>Delete</button></div></article>)}</div></section>}
    </main>
    <div className="bottom-player"><button className="player-song" onClick={()=>{setPlayerOpen(v=>!v);setFeatured(null);}}><img src={artUrl(selected)} alt=""/><span><strong>{selected.song}</strong><small>{selected.artist}</small></span></button><button className="pill player-toggle" onClick={()=>{setPlayerOpen(v=>!v);setFeatured(null);}}>{playerOpen?'− Close player':'▷ Listen'}</button><a href={trackId?`https://open.spotify.com/track/${trackId}`:spotifySearch(selected)} target="_blank" rel="noreferrer">Spotify ↗</a></div>
    {(playerOpen||featured)&&<div className="listen-panel" data-lenis-prevent><button className="pill player-close" onClick={()=>{setPlayerOpen(false);setFeatured(null);}}>× Close</button><div className="listen-title"><img src={artUrl(selected)} alt=""/><div><div className="eyebrow">{selected.world}</div><h2>{selected.song}</h2><p>{selected.artist}</p></div></div>{trackId?<iframe key={trackId} title={`Spotify player: ${selected.song}`} src={`https://open.spotify.com/embed/track/${trackId}`} width="100%" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"/>:<><p className="player-note">This disc needs its Spotify track link. The playlist remains available below.</p><iframe title="Spotify playlist player" src={`https://open.spotify.com/embed/playlist/${playlist}`} width="100%" height="352" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"/></>}<div className="listen-actions"><button className="plain" onClick={()=>{setLinkText('');setLinkStatus('');setLinkSetup(true);}}> {trackId?'Change track link':'Link this song'} </button><button className="plain" onClick={()=>{setPlayerOpen(false);journalTrack(selected);}}>Journal this song ↗</button></div><p className="player-note">Press play in Spotify. Full playback depends on your account, browser and availability.</p></div>}
    {linkSetup&&<div className="modal-shade" data-lenis-prevent><section className="link-dialog" role="dialog" aria-modal="true" aria-label="Connect Spotify tracks"><button className="plain" onClick={()=>setLinkSetup(false)}>Close ×</button><h2>Connect your songs.</h2><p>Paste one link for {selected.song}, or copy all tracks in the original playlist order and paste them together.</p><textarea rows="6" value={linkText} onChange={e=>setLinkText(e.target.value)} placeholder="https://open.spotify.com/track/…"/><div className="actions"><button className="primary" onClick={()=>saveLinks(false)}>Save selected song</button><button className="primary" onClick={()=>saveLinks(true)}>Import all songs</button></div><p role="status">{linkStatus}</p></section></div>}
    </div>
  </div>;
}
