const express = require('express');
const fs = require('fs');
const path = require('path');

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data', 'articles.json');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_REST_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/`
  : null;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...rest] = trimmed.split('=');
    if (!key) return;
    const value = rest.join('=').trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFileSync(DATA_PATH, '[]', 'utf8');
  }
}

function readArticles() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeArticles(articles) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(articles, null, 2));
}

function isValidStatus(status) {
  return ['draft', 'published'].includes(status);
}

function normalizeArticle(row) {
  if (!row) return null;
  return {
    id: row.id?.toString(),
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

async function supabaseRequest(method, resource, { query, body } = {}) {
  if (!SUPABASE_REST_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase is not configured.');
  }

  const url = new URL(resource, SUPABASE_REST_URL);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    Prefer: 'return=representation',
  };

  const options = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text();
    const error = new Error(message || 'Supabase request failed.');
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listArticles(status) {
  if (SUPABASE_REST_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const query = { select: '*', order: 'created_at.desc' };
    if (status) {
      query.status = `eq.${status}`;
    }
    const data = await supabaseRequest('GET', 'articles', { query });
    return Array.isArray(data) ? data.map(normalizeArticle) : [];
  }

  const articles = readArticles();
  return articles.filter((article) => !status || article.status === status);
}

async function listAllArticles() {
  if (SUPABASE_REST_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const data = await supabaseRequest('GET', 'articles', {
      query: { select: '*', order: 'created_at.desc' },
    });
    return Array.isArray(data) ? data.map(normalizeArticle) : [];
  }

  return readArticles();
}

async function createArticle({ title, content, status }) {
  if (SUPABASE_REST_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const now = new Date().toISOString();
    const data = await supabaseRequest('POST', 'articles', {
      body: [{ title, content, status, created_at: now, updated_at: now }],
    });
    return normalizeArticle(Array.isArray(data) ? data[0] : data);
  }

  const articles = readArticles();
  const now = new Date().toISOString();
  const newArticle = {
    id: Date.now().toString(36),
    title,
    content,
    status,
    createdAt: now,
    updatedAt: now,
  };

  articles.unshift(newArticle);
  writeArticles(articles);

  return newArticle;
}

async function updateArticle(id, { title, content, status }) {
  if (SUPABASE_REST_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const data = await supabaseRequest('PATCH', 'articles', {
      query: { id: `eq.${id}`, select: '*' },
      body: { title, content, status, updated_at: new Date().toISOString() },
    });

    if (!data || !data.length) return null;
    return normalizeArticle(data[0]);
  }

  const articles = readArticles();
  const index = articles.findIndex((article) => article.id === id);
  if (index === -1) return null;

  const updated = {
    ...articles[index],
    title,
    content,
    status,
    updatedAt: new Date().toISOString(),
  };

  articles[index] = updated;
  writeArticles(articles);

  return updated;
}

async function deleteArticle(id) {
  if (SUPABASE_REST_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const data = await supabaseRequest('DELETE', 'articles', {
      query: { id: `eq.${id}`, select: 'id' },
    });

    return Array.isArray(data) && data.length > 0;
  }

  const articles = readArticles();
  const filtered = articles.filter((article) => article.id !== id);

  if (filtered.length === articles.length) {
    return false;
  }

  writeArticles(filtered);
  return true;
}

app.get('/api/articles', async (req, res) => {
  try {
    const { status } = req.query;
    const articles = await listArticles(status);
    res.json(articles);
  } catch (error) {
    console.error('Failed to fetch articles', error);
    res.status(500).json({ error: 'Failed to fetch articles.' });
  }
});

app.get('/api/admin/articles', async (req, res) => {
  try {
    const articles = await listAllArticles();
    res.json(articles);
  } catch (error) {
    console.error('Failed to fetch admin articles', error);
    res.status(500).json({ error: 'Failed to fetch admin articles.' });
  }
});

app.post('/api/articles', async (req, res) => {
  const { title, content, status } = req.body || {};

  if (!title || !content || !status || !isValidStatus(status)) {
    return res.status(400).json({ error: 'Invalid article payload.' });
  }

  try {
    const newArticle = await createArticle({ title, content, status });
    res.status(201).json(newArticle);
  } catch (error) {
    console.error('Failed to create article', error);
    res.status(500).json({ error: 'Failed to create article.' });
  }
});

app.put('/api/articles/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content, status } = req.body || {};

  if (!title || !content || !status || !isValidStatus(status)) {
    return res.status(400).json({ error: 'Invalid article payload.' });
  }

  try {
    const updated = await updateArticle(id, { title, content, status });
    if (!updated) {
      return res.status(404).json({ error: 'Article not found.' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Failed to update article', error);
    res.status(500).json({ error: 'Failed to update article.' });
  }
});

app.delete('/api/articles/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await deleteArticle(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Article not found.' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete article', error);
    res.status(500).json({ error: 'Failed to delete article.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  ensureDataFile();
  console.log(`ZinaSite server running on http://localhost:${PORT}`);
});
