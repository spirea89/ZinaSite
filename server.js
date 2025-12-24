const express = require('express');
const path = require('path');
const supabase = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '1mb' }));

app.get('/api/articles', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('articles').select('*').order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: articles, error } = await query;
    
    if (error) {
      console.error('Error fetching articles:', error);
      return res.status(500).json({ error: 'Failed to fetch articles.' });
    }
    
    // Map database columns to API format
    const formattedArticles = articles.map(article => ({
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
      createdAt: article.created_at,
      updatedAt: article.updated_at,
    }));
    
    res.json(formattedArticles);
  } catch (error) {
    console.error('Error in /api/articles:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/admin/articles', async (req, res) => {
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching articles:', error);
      return res.status(500).json({ error: 'Failed to fetch articles.' });
    }
    
    // Map database columns to API format
    const formattedArticles = articles.map(article => ({
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
      createdAt: article.created_at,
      updatedAt: article.updated_at,
    }));
    
    res.json(formattedArticles);
  } catch (error) {
    console.error('Error in /api/admin/articles:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/articles', async (req, res) => {
  try {
    const { title, content, status } = req.body || {};

    if (!title || !content || !status || !['draft', 'published'].includes(status)) {
      return res.status(400).json({ error: 'Invalid article payload.' });
    }

    const now = new Date().toISOString();
    const { data: article, error } = await supabase
      .from('articles')
      .insert({
        title,
        content,
        status,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating article:', error);
      return res.status(500).json({ error: 'Failed to create article.' });
    }

    // Map database columns to API format
    const formattedArticle = {
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
      createdAt: article.created_at,
      updatedAt: article.updated_at,
    };

    res.status(201).json(formattedArticle);
  } catch (error) {
    console.error('Error in POST /api/articles:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.put('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, status } = req.body || {};

    if (!title || !content || !status || !['draft', 'published'].includes(status)) {
      return res.status(400).json({ error: 'Invalid article payload.' });
    }

    const updatedAt = new Date().toISOString();
    const { data: article, error } = await supabase
      .from('articles')
      .update({
        title,
        content,
        status,
        updated_at: updatedAt,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Article not found.' });
      }
      console.error('Error updating article:', error);
      return res.status(500).json({ error: 'Failed to update article.' });
    }

    // Map database columns to API format
    const formattedArticle = {
      id: article.id,
      title: article.title,
      content: article.content,
      status: article.status,
      createdAt: article.created_at,
      updatedAt: article.updated_at,
    };

    res.json(formattedArticle);
  } catch (error) {
    console.error('Error in PUT /api/articles/:id:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('articles')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error deleting article:', error);
      return res.status(500).json({ error: 'Failed to delete article.' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Article not found.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /api/articles/:id:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Events API endpoints
app.get('/api/events', async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabase.from('events').select('*').order('start_date', { ascending: true });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: events, error } = await query;
    
    if (error) {
      console.error('Error fetching events:', error);
      return res.status(500).json({ error: 'Failed to fetch events.' });
    }
    
    // Map database columns to API format
    const formattedEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      location: event.location,
      status: event.status,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    }));
    
    res.json(formattedEvents);
  } catch (error) {
    console.error('Error in /api/events:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/admin/events', async (req, res) => {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching events:', error);
      return res.status(500).json({ error: 'Failed to fetch events.' });
    }
    
    // Map database columns to API format
    const formattedEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      location: event.location,
      status: event.status,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    }));
    
    res.json(formattedEvents);
  } catch (error) {
    console.error('Error in /api/admin/events:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const { title, description, startDate, endDate, location, status } = req.body || {};

    if (!title || !startDate || !status || !['draft', 'published'].includes(status)) {
      return res.status(400).json({ error: 'Invalid event payload.' });
    }

    const now = new Date().toISOString();
    const { data: event, error } = await supabase
      .from('events')
      .insert({
        title,
        description: description || null,
        start_date: startDate,
        end_date: endDate || null,
        location: location || null,
        status,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating event:', error);
      return res.status(500).json({ error: 'Failed to create event.' });
    }

    // Map database columns to API format
    const formattedEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      location: event.location,
      status: event.status,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    };

    res.status(201).json(formattedEvent);
  } catch (error) {
    console.error('Error in POST /api/events:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, location, status } = req.body || {};

    if (!title || !startDate || !status || !['draft', 'published'].includes(status)) {
      return res.status(400).json({ error: 'Invalid event payload.' });
    }

    const updatedAt = new Date().toISOString();
    const { data: event, error } = await supabase
      .from('events')
      .update({
        title,
        description: description || null,
        start_date: startDate,
        end_date: endDate || null,
        location: location || null,
        status,
        updated_at: updatedAt,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Event not found.' });
      }
      console.error('Error updating event:', error);
      return res.status(500).json({ error: 'Failed to update event.' });
    }

    // Map database columns to API format
    const formattedEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.start_date,
      endDate: event.end_date,
      location: event.location,
      status: event.status,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    };

    res.json(formattedEvent);
  } catch (error) {
    console.error('Error in PUT /api/events/:id:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error deleting event:', error);
      return res.status(500).json({ error: 'Failed to delete event.' });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /api/events/:id:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ZinaSite server running on http://localhost:${PORT}`);
  console.log('Connected to Supabase database');
});
