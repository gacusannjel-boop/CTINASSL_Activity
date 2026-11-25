import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { journalDateError } from '../client/src/journal-date.js';

const mongo = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
  serverSelectionTimeoutMS: 5000,
});
const app = express();
const entries = mongo.db(process.env.MONGODB_DATABASE || 'sonara').collection('listening_entries');
const moods = new Set(['Calm', 'Happy', 'Sad', 'Energetic', 'Nostalgic', 'Stressed']);

app.use(express.json({ limit: '8kb' }));

function validateEntry(req, res, next) {
  const { song, artist, date, mood, afterMood, note = '' } = req.body ?? {};
  if (typeof song !== 'string' || !song.trim() || song.trim().length > 120 ||
      typeof artist !== 'string' || !artist.trim() || artist.trim().length > 120 ||
      !moods.has(mood) || !moods.has(afterMood) || typeof note !== 'string' || note.trim().length > 600) {
    return res.status(400).json({ error: 'Enter a valid song, artist, and moods. Reflections can be up to 600 characters.' });
  }
  const dateError = journalDateError(date);
  if (dateError) return res.status(400).json({ error: dateError });
  req.entry = { song: song.trim(), artist: artist.trim(), date, mood, afterMood, note: note.trim() };
  next();
}

app.param('id', (req, res, next, id) => {
  if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid listening entry ID.' });
  req.entryId = new ObjectId(id);
  next();
});

app.get('/api/entries', async (_req, res) => {
  res.json(await entries.find().sort({ _id: -1 }).toArray());
});

app.post('/api/entries', validateEntry, async (req, res) => {
  const entry = { ...req.entry, favorite: false };
  const { insertedId } = await entries.insertOne(entry);
  res.status(201).json({ ...entry, _id: insertedId });
});

app.patch('/api/entries/:id', async (req, res) => {
  const body = req.body ?? {};
  const { favorite } = body;
  if (typeof favorite !== 'boolean' || Object.keys(body).length !== 1) {
    return res.status(400).json({ error: 'Send only the favorite status as true or false.' });
  }

  // Saving a favorite leaves the original listening details intact.
  const entry = await entries.findOneAndUpdate(
    { _id: req.entryId }, { $set: { favorite } }, { returnDocument: 'after' },
  );
  if (!entry) return res.status(404).json({ error: 'Listening entry not found.' });
  res.json(entry);
});

app.delete('/api/entries/:id', async (req, res) => {
  const { deletedCount } = await entries.deleteOne({ _id: req.entryId });
  if (!deletedCount) return res.status(404).json({ error: 'Listening entry not found.' });
  res.json({ deleted: true });
});

app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Entry is too large.' });
  console.error(error.name);
  res.status(503).json({ error: 'The database is temporarily unavailable. Try again shortly.' });
});

try {
  await mongo.connect();
  const port = Number(process.env.PORT || 5050);
  app.listen(port, '127.0.0.1', () => console.log(`Sonara API listening on http://127.0.0.1:${port} (MongoDB connected)`));
} catch (error) {
  console.error(`Could not connect to MongoDB (${error.name}). Check the MongoDB service or MONGODB_URI.`);
  await mongo.close();
  process.exitCode = 1;
}
