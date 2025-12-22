const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data', 'articles.json');

app.use('/logos', express.static(path.join(__dirname, 'logos')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

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

app.get('/api/articles', (req, res) => {
  const { status } = req.query;
  const articles = readArticles().filter(
    (article) => !status || article.status === status
  );
  res.json(articles);
});

app.get('/api/admin/articles', (req, res) => {
  res.json(readArticles());
});

app.post('/api/articles', (req, res) => {
  const { title, content, status } = req.body || {};

  if (!title || !content || !status || !['draft', 'published'].includes(status)) {
    return res.status(400).json({ error: 'Invalid article payload.' });
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

  res.status(201).json(newArticle);
});

app.put('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  const { title, content, status } = req.body || {};

  if (!title || !content || !status || !['draft', 'published'].includes(status)) {
    return res.status(400).json({ error: 'Invalid article payload.' });
  }

  const articles = readArticles();
  const index = articles.findIndex((article) => article.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Article not found.' });
  }

  const updated = {
    ...articles[index],
    title,
    content,
    status,
    updatedAt: new Date().toISOString(),
  };

  articles[index] = updated;
  writeArticles(articles);

  res.json(updated);
});

app.delete('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  const articles = readArticles();
  const filtered = articles.filter((article) => article.id !== id);

  if (filtered.length === articles.length) {
    return res.status(404).json({ error: 'Article not found.' });
  }

  writeArticles(filtered);
  res.status(204).send();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  ensureDataFile();
  console.log(`ZinaSite server running on http://localhost:${PORT}`);
});
