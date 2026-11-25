import Scene from './Scene.jsx';
import { featured } from './tracks.js';

const moods = ['Calm', 'Happy', 'Sad', 'Energetic', 'Nostalgic', 'Stressed'];
const journalDiscs = featured.slice(0, 2);

export function JournalPage({
  form, setForm, minimumDate, canSave, onSave, onCancel, onChooseTrack,
}) {
  function updateField(event) {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  }

  const moodOptions = moods.map(mood => <option key={mood}>{mood}</option>);
  return (
    <section className="section subpage">
      <div className="eyebrow">02 / LISTENING JOURNAL</div>
      <h2>A little moment for you.</h2>
      <p>Write a listening entry and notice how your mood changes.</p>
      <div className="journal-layout">
        <form className="journal" onSubmit={onSave}>
          <label>
            Song or album
            <input
              name="song"
              value={form.song}
              onChange={updateField}
              placeholder="e.g. A favorite song"
              maxLength={120}
              required
            />
          </label>
          <label>
            Artist
            <input
              name="artist"
              value={form.artist}
              onChange={updateField}
              placeholder="Artist name"
              maxLength={120}
              required
            />
          </label>
          <label>
            Date
            <input name="date" type="date" min={minimumDate} value={form.date} onChange={updateField} required/>
          </label>
          <div className="two">
            <label>
              Mood before
              <select name="mood" value={form.mood} onChange={updateField}>{moodOptions}</select>
            </label>
            <label>
              Mood after
              <select name="afterMood" value={form.afterMood} onChange={updateField}>{moodOptions}</select>
            </label>
          </div>
          <label>
            Listening reflection (optional)
            <textarea
              name="note"
              value={form.note}
              onChange={updateField}
              placeholder="What did you notice? Use sample reflections for this demo."
              maxLength={600}
              rows={4}
            />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={!canSave}>
              Save entry ♡
            </button>
            <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          </div>
        </form>
        <aside className="journal-aside">
          <Scene mode="ambient" items={journalDiscs} onChoose={onChooseTrack}/>
          <h3>Every feeling has a frequency.</h3>
          <p>This is a classroom demo, not a private journal or a mental-health assessment. Please use fictional entries only.</p>
        </aside>
      </div>
    </section>
  );
}

export function ListeningHistory({
  entries, ready, busy, loadingError, usesMongo, onNewEntry, onToggleFavorite, onDelete,
}) {
  const moodCount = new Set(entries.map(entry => entry.mood)).size;
  let entryList;

  if (!ready) {
    entryList = !loadingError && <p role="status">Loading listening entries…</p>;
  } else if (entries.length === 0) {
    entryList = (
      <div className="empty">
        ♡
        <h3>No listening entries yet.</h3>
        <button className="secondary" onClick={onNewEntry}>Create your first entry</button>
      </div>
    );
  } else {
    entryList = entries.map(entry => (
      <article className="entry" key={entry._id}>
        <div>
          <small>{entry.date} • {entry.artist}</small>
          <h3>{entry.song}</h3>
          <span className="moodtag">{entry.mood} → {entry.afterMood}</span>
          <p>{entry.note}</p>
        </div>
        <div className="actions">
          <button
            className="secondary"
            aria-pressed={entry.favorite === true}
            disabled={busy}
            onClick={() => onToggleFavorite(entry)}
          >
            <span aria-hidden="true">{entry.favorite === true ? '★' : '☆'}</span> Favorite
          </button>
          <button className="secondary danger" disabled={busy} onClick={() => onDelete(entry._id)}>Delete</button>
        </div>
      </article>
    ));
  }

  return (
    <section className="section subpage">
      <div className="section-head">
        <div>
          <div className="eyebrow">03 / YOUR LISTENING HISTORY</div>
          <h2>Little memories.</h2>
        </div>
        <button className="primary" onClick={onNewEntry}>+ New entry</button>
      </div>
      {ready && (
        <div className="summary">
          <div>
            <small>LISTENING ENTRIES</small>
            <strong>{entries.length}</strong>
          </div>
          <div>
            <small>MOODS RECORDED</small>
            <strong>{moodCount}</strong>
          </div>
          {usesMongo && <div><small>STORAGE</small><strong>MongoDB</strong></div>}
        </div>
      )}
      <div className="entries">{entryList}</div>
    </section>
  );
}
