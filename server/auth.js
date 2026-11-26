import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const sessionCookie = 'sonara_session';
const sessionDuration = 7 * 24 * 60 * 60 * 1000;

function sessionDigest(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)sonara_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  return token && hashToken(token);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function cookieOptions(req) {
  return { httpOnly: true, sameSite: 'strict', secure: req.secure || process.env.COOKIE_SECURE === 'true' };
}

function readCredentials(body) {
  const { email, password } = body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      password.length < 8 || Buffer.byteLength(password) > 128) return null;
  return { email: normalizedEmail, password };
}

export async function registerAuth(app, database) {
  const users = database.collection('users');
  const sessions = database.collection('sessions');
  await users.createIndex({ email: 1 }, { unique: true });
  await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  async function findSession(req) {
    const digest = sessionDigest(req);
    return digest && sessions.findOne({ _id: digest, expiresAt: { $gt: new Date() } });
  }

  async function startSession(req, res, user, status) {
    const token = randomBytes(32).toString('hex');
    await sessions.insertOne({
      _id: hashToken(token),
      userId: user._id,
      expiresAt: new Date(Date.now() + sessionDuration),
    });
    const previousSession = sessionDigest(req);
    if (previousSession) await sessions.deleteOne({ _id: previousSession });
    res.cookie(sessionCookie, token, { ...cookieOptions(req), maxAge: sessionDuration });
    res.status(status).json({ user: { id: user._id, email: user.email } });
  }

  app.use('/api/auth', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.post('/api/auth/register', async (req, res) => {
    const credentials = readCredentials(req.body);
    if (!credentials) {
      return res.status(400).json({ error: 'Enter a valid email and a password of at least 8 characters and at most 128 bytes.' });
    }
    const salt = randomBytes(16).toString('hex');
    const passwordHash = (await deriveKey(credentials.password, salt, 64)).toString('hex');
    const user = { email: credentials.email, salt, passwordHash };
    try {
      await users.insertOne(user);
    } catch (error) {
      if (error.code !== 11000) throw error;
      return res.status(409).json({ error: 'An account already uses this email.' });
    }
    await startSession(req, res, user, 201);
  });

  app.post('/api/auth/login', async (req, res) => {
    const credentials = readCredentials(req.body);
    if (!credentials) return res.status(401).json({ error: 'Invalid email or password.' });
    const user = await users.findOne({ email: credentials.email });
    // Run the same password derivation even if the email has no account.
    const key = await deriveKey(credentials.password, user?.salt ?? 'sonara-missing-account', 64);
    if (!user || !timingSafeEqual(key, Buffer.from(user.passwordHash, 'hex'))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    await startSession(req, res, user, 200);
  });

  app.get('/api/auth/me', async (req, res) => {
    const session = await findSession(req);
    const user = session && await users.findOne({ _id: session.userId }, { projection: { email: 1 } });
    res.json({ user: user ? { id: user._id, email: user.email } : null });
  });

  app.post('/api/auth/logout', async (req, res) => {
    const digest = sessionDigest(req);
    if (digest) await sessions.deleteOne({ _id: digest });
    res.clearCookie(sessionCookie, cookieOptions(req)).json({ user: null });
  });

  app.use('/api/entries', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const session = await findSession(req);
    if (!session) return res.status(401).json({ error: 'Log in to access your listening journal.' });
    req.ownerId = session.userId;
    next();
  });
}
