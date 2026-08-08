// Data service that works both on GitHub Pages (with Supabase) and locally (with API)

let supabaseClient = null;
let useSupabaseDirectly = false;
let supabaseInitialized = false;

// Supabase configuration (safe to expose - this is the anon/public key)
// Read from shared config set by auth-service.js (which loads first)
// Fallback values in case auth-service hasn't loaded yet
function getSupabaseConfig() {
  if (window.__SUPABASE_CONFIG) {
    return window.__SUPABASE_CONFIG;
  }
  // Fallback if config not yet set
  return {
    url: 'https://nveksidxddivsqywsrjb.supabase.co',
    anonKey: 'sb_publishable_SUQ2hBY4_Q_0KY78GwNKqg_fmi8KXc8'
  };
}

// Detect environment - more robust detection
// Always use Supabase directly if available (for auth support)
const isGitHubPages = window.location.hostname.includes('github.io') || 
                      window.location.hostname.includes('github.com') ||
                      window.location.pathname.includes('/docs/'); // Also check pathname

// For admin page, always prefer Supabase (needed for authentication)
// Check if we're on admin page
const isAdminPage = window.location.pathname.includes('admin.html') || 
                    window.location.pathname.includes('admin');

// Get Supabase client (shared instance, maintains auth session)
function getSupabaseClient() {
  // Always use the shared client from auth-service if available (this has the auth session)
  if (window.__supabaseClient) {
    return window.__supabaseClient;
  }
  
  // Use local client as fallback
  return supabaseClient;
}

// Initialize Supabase client
async function initializeSupabase() {
  if (supabaseInitialized) return;
  
  // Always initialize Supabase if available (needed for auth on GitHub Pages)
  // Wait for Supabase to be available (it's loaded via CDN in the HTML)
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max wait
  
  while (typeof window.supabase === 'undefined' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (typeof window.supabase !== 'undefined') {
    // Always use the shared client from auth-service if it exists
    if (window.__supabaseClient) {
      supabaseClient = window.__supabaseClient;
      useSupabaseDirectly = true;
      supabaseInitialized = true;
      console.log('Supabase client initialized (using shared instance from auth-service)');
      return;
    }
    
    // Only create if auth-service hasn't created one yet
    const config = getSupabaseConfig();
    supabaseClient = window.supabase.createClient(config.url, config.anonKey);
    window.__supabaseClient = supabaseClient; // Share with auth-service
    useSupabaseDirectly = true;
    supabaseInitialized = true;
    console.log('Supabase client initialized');
  } else if (isGitHubPages) {
    console.warn('Supabase not available, falling back to API (if available)');
  }
}

// Format article from database format to API format
function formatArticle(article) {
  return {
    id: article.id,
    title: article.title,
    content: article.content,
    titleEn: article.title_en || '',
    contentEn: article.content_en || '',
    titleDe: article.title_de || '',
    contentDe: article.content_de || '',
    categoryId: article.category_id || null,
    category: article.category || null,
    status: article.status,
    createdAt: article.created_at || article.createdAt,
    updatedAt: article.updated_at || article.updatedAt
  };
}

// Format event from database format to API format
function formatEvent(event) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    titleEn: event.title_en || '',
    descriptionEn: event.description_en || '',
    titleDe: event.title_de || '',
    descriptionDe: event.description_de || '',
    startDate: event.start_date || event.startDate,
    endDate: event.end_date || event.endDate,
    location: event.location,
    registrationUrl: event.registration_url || event.registrationUrl,
    status: event.status,
    createdAt: event.created_at || event.createdAt,
    updatedAt: event.updated_at || event.updatedAt
  };
}

async function formatArticlesWithCategories(client, rows) {
  let categories = [];
  try {
    const result = await client.from('article_categories').select('*');
    if (!result.error) categories = result.data || [];
  } catch (_) {
    // Categories are optional until the migration is installed.
  }
  const byId = new Map(categories.map(category => [category.id, category]));
  return (rows || []).map(article => formatArticle({ ...article, category: byId.get(article.category_id) || null }));
}

function formatTeamMember(member) {
  return {
    id: member.id,
    name: member.name,
    roleEn: member.role_en || '', roleRo: member.role_ro || '', roleDe: member.role_de || '',
    bioEn: member.bio_en || '', bioRo: member.bio_ro || '', bioDe: member.bio_de || '',
    imageUrl: member.image_url || null,
    sortOrder: member.sort_order || 0,
    createdAt: member.created_at,
    updatedAt: member.updated_at
  };
}

// Data Service API
const DataService = {
  // Ensure Supabase is initialized before use
  async ensureInitialized() {
    await initializeSupabase();
  },

  // Get articles (optionally filtered by status)
  async getArticles(status = null) {
    await this.ensureInitialized();
    
    // On GitHub Pages, must use Supabase (no API available)
    // For admin operations, also use Supabase (needed for auth)
    if (isGitHubPages || useSupabaseDirectly) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        let query = client
          .from('articles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (status) {
          query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return await formatArticlesWithCategories(client, data);
      } catch (error) {
        console.error('Error fetching articles from Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    const url = status ? `/api/articles?status=${status}` : '/api/articles';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch articles');
    return response.json();
  },

  // Get articles with pagination. Returns { items, total }.
  async getArticlesPage(status = 'published', page = 1, pageSize = 9) {
    await this.ensureInitialized();
    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(24, Math.max(1, parseInt(pageSize, 10) || 9));

    if (isGitHubPages || useSupabaseDirectly) {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase client not initialized.');
      try {
        const from = (p - 1) * size;
        const to = from + size - 1;
        let query = client
          .from('articles')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
        if (status) query = query.eq('status', status);
        const { data, error, count } = await query;
        if (error) throw error;
        return { items: await formatArticlesWithCategories(client, data), total: count ?? 0 };
      } catch (error) {
        console.error('Error fetching articles page:', error);
        throw error;
      }
    }

    const all = await this.getArticles(status);
    const total = all.length;
    const start = (p - 1) * size;
    const items = all.slice(start, start + size);
    return { items, total };
  },

  // Get all articles (for admin)
  async getAllArticles() {
    await this.ensureInitialized();
    
    // On GitHub Pages or admin page, use Supabase (required for authentication)
    if (isGitHubPages || useSupabaseDirectly || isAdminPage) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      
      // Verify we have an authenticated session
      try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated. Please log in again.');
        }
        console.log('Using authenticated session for getAllArticles');
      } catch (sessionError) {
        console.error('Session check error:', sessionError);
        throw new Error('Authentication session not found. Please log in again.');
      }
      
      try {
        const { data, error } = await client
          .from('articles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
        return await formatArticlesWithCategories(client, data);
      } catch (error) {
        console.error('Error fetching all articles from Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    const response = await fetch('/api/admin/articles');
    if (!response.ok) throw new Error('Failed to fetch articles');
    return response.json();
  },

  // Create article
  async createArticle(article) {
    await this.ensureInitialized();
    
    // On GitHub Pages or admin page, must use Supabase (required for authentication)
    if (isGitHubPages || useSupabaseDirectly || isAdminPage) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { data, error } = await client
          .from('articles')
          .insert({
            title: article.title,
            content: article.content,
            title_en: article.titleEn || null,
            content_en: article.contentEn || null,
            title_de: article.titleDe || null,
            content_de: article.contentDe || null,
            category_id: article.categoryId || null,
            status: article.status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        return formatArticle(data);
      } catch (error) {
        console.error('Error creating article in Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    const response = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(article)
    });
    if (!response.ok) throw new Error('Failed to create article');
    return response.json();
  },

  // Update article
  async updateArticle(id, article) {
    await this.ensureInitialized();
    
    // On GitHub Pages or admin page, must use Supabase (required for authentication)
    if (isGitHubPages || useSupabaseDirectly || isAdminPage) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { data, error } = await client
          .from('articles')
          .update({
            title: article.title,
            content: article.content,
            title_en: article.titleEn || null,
            content_en: article.contentEn || null,
            title_de: article.titleDe || null,
            content_de: article.contentDe || null,
            category_id: article.categoryId || null,
            status: article.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return formatArticle(data);
      } catch (error) {
        console.error('Error updating article in Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    const response = await fetch(`/api/articles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(article)
    });
    if (!response.ok) throw new Error('Failed to update article');
    return response.json();
  },

  // Delete article
  async deleteArticle(id) {
    await this.ensureInitialized();
    
    // On GitHub Pages or admin page, must use Supabase (required for authentication)
    if (isGitHubPages || useSupabaseDirectly || isAdminPage) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { error } = await client
          .from('articles')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return true;
      } catch (error) {
        console.error('Error deleting article from Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    const response = await fetch(`/api/articles/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete article');
    return true;
  },

  // Get events (optionally filtered by status)
  async getEvents(status = null) {
    await this.ensureInitialized();
    
    // On GitHub Pages, must use Supabase (no API available)
    // Also use Supabase on localhost if available (for consistency)
    if (isGitHubPages || useSupabaseDirectly) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        let query = client
          .from('events')
          .select('*')
          .order('start_date', { ascending: true });
        
        if (status) {
          query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        if (error) {
          console.error('Supabase query error:', error);
          // If table doesn't exist, return empty array instead of throwing
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            console.warn('Events table does not exist yet. Please run the SQL schema.');
            return [];
          }
          throw error;
        }
        console.log('Events fetched from Supabase:', data?.length || 0, 'events');
        return (data || []).map(formatEvent);
      } catch (error) {
        console.error('Error fetching events from Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    try {
      const url = status ? `/api/events?status=${status}` : '/api/events';
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch events: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      console.log('Events fetched from API:', data?.length || 0, 'events');
      return data;
    } catch (error) {
      console.error('Error fetching events from API:', error);
      throw error;
    }
  },

  // Get events with pagination. Returns { items, total }. Ordered by start_date asc.
  async getEventsPage(status = 'published', page = 1, pageSize = 9) {
    await this.ensureInitialized();
    const p = Math.max(1, parseInt(page, 10) || 1);
    const size = Math.min(24, Math.max(1, parseInt(pageSize, 10) || 9));

    if (isGitHubPages || useSupabaseDirectly) {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase client not initialized.');
      try {
        const from = (p - 1) * size;
        const to = from + size - 1;
        let query = client
          .from('events')
          .select('*', { count: 'exact' })
          .order('start_date', { ascending: true })
          .range(from, to);
        if (status) query = query.eq('status', status);
        const { data, error, count } = await query;
        if (error) {
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            return { items: [], total: 0 };
          }
          throw error;
        }
        return { items: (data || []).map(formatEvent), total: count ?? 0 };
      } catch (error) {
        console.error('Error fetching events page:', error);
        throw error;
      }
    }

    const all = await this.getEvents(status);
    const total = all.length;
    const start = (p - 1) * size;
    const items = all.slice(start, start + size);
    return { items, total };
  },

  // Get all events (for admin)
  async getAllEvents() {
    await this.ensureInitialized();
    
    // On GitHub Pages or admin page, use Supabase (required for authentication)
    if (isGitHubPages || useSupabaseDirectly || isAdminPage) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      
      // Verify we have an authenticated session
      try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated. Please log in again.');
        }
        console.log('Using authenticated session for getAllEvents');
      } catch (sessionError) {
        console.error('Session check error:', sessionError);
        throw new Error('Authentication session not found. Please log in again.');
      }
      
      try {
        const { data, error } = await client
          .from('events')
          .select('*')
          .order('start_date', { ascending: false });
        
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
        return data.map(formatEvent);
      } catch (error) {
        console.error('Error fetching all events from Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    const response = await fetch('/api/admin/events');
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  },

  // Create event
  async createEvent(event) {
    await this.ensureInitialized();
    
    // On GitHub Pages or admin page, must use Supabase (required for authentication)
    if (isGitHubPages || useSupabaseDirectly || isAdminPage) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { data, error } = await client
          .from('events')
          .insert({
            title: event.title,
            description: event.description || null,
            title_en: event.titleEn || null,
            description_en: event.descriptionEn || null,
            title_de: event.titleDe || null,
            description_de: event.descriptionDe || null,
            start_date: event.startDate,
            end_date: event.endDate || null,
            location: event.location || null,
            registration_url: event.registrationUrl || null,
            status: event.status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        return formatEvent(data);
      } catch (error) {
        console.error('Error creating event in Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!response.ok) throw new Error('Failed to create event');
    return response.json();
  },

  // Update event
  async updateEvent(id, event) {
    await this.ensureInitialized();
    
    // On GitHub Pages or admin page, must use Supabase (required for authentication)
    if (isGitHubPages || useSupabaseDirectly || isAdminPage) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { data, error } = await client
          .from('events')
          .update({
            title: event.title,
            description: event.description || null,
            title_en: event.titleEn || null,
            description_en: event.descriptionEn || null,
            title_de: event.titleDe || null,
            description_de: event.descriptionDe || null,
            start_date: event.startDate,
            end_date: event.endDate || null,
            location: event.location || null,
            registration_url: event.registrationUrl || null,
            status: event.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return formatEvent(data);
      } catch (error) {
        console.error('Error updating event in Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    const response = await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!response.ok) throw new Error('Failed to update event');
    return response.json();
  },

  // Delete event
  async deleteEvent(id) {
    await this.ensureInitialized();
    
    // On GitHub Pages or admin page, must use Supabase (required for authentication)
    if (isGitHubPages || useSupabaseDirectly || isAdminPage) {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { error } = await client
          .from('events')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return true;
      } catch (error) {
        console.error('Error deleting event from Supabase:', error);
        throw error;
      }
    }
    
    // Use API endpoint (local development only)
    const response = await fetch(`/api/events/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete event');
    return true;
  },

  async getTeamMembers() {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('team_members').select('*').order('sort_order').order('created_at');
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return [];
      throw error;
    }
    return (data || []).map(formatTeamMember);
  },

  async createTeamMember(member) {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized.');
    const { data, error } = await client.from('team_members').insert({
      name: member.name,
      role_en: member.roleEn,
      role_ro: member.roleRo || null,
      role_de: member.roleDe || null,
      bio_en: member.bioEn,
      bio_ro: member.bioRo || null,
      bio_de: member.bioDe || null,
      image_url: member.imageUrl || null,
      sort_order: member.sortOrder || 0
    }).select().single();
    if (error) throw error;
    return formatTeamMember(data);
  },

  async updateTeamMember(id, member) {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized.');
    const { data, error } = await client.from('team_members').update({
      name: member.name,
      role_en: member.roleEn,
      role_ro: member.roleRo || null,
      role_de: member.roleDe || null,
      bio_en: member.bioEn,
      bio_ro: member.bioRo || null,
      bio_de: member.bioDe || null,
      image_url: member.imageUrl || null,
      sort_order: member.sortOrder || 0,
      updated_at: new Date().toISOString()
    }).eq('id', id).select().single();
    if (error) throw error;
    return formatTeamMember(data);
  },

  async deleteTeamMember(id) {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized.');
    const { error } = await client.from('team_members').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async uploadTeamImage(file) {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized.');
    if (!file || !file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.size > 5 * 1024 * 1024) throw new Error('The image must be smaller than 5 MB.');
    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error('Not authenticated. Please log in again.');
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${session.user.id}/${Date.now()}.${extension}`;
    const { error } = await client.storage.from('team-media').upload(path, file, { cacheControl: '3600', contentType: file.type });
    if (error) throw error;
    return client.storage.from('team-media').getPublicUrl(path).data.publicUrl;
  },

  async getCategories() {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client.from('article_categories').select('*').order('name_ro');
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return [];
      throw error;
    }
    return data || [];
  },

  async createCategory(category) {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized.');
    const slug = (category.slug || category.nameRo)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data, error } = await client.from('article_categories').insert({
      slug,
      name_ro: category.nameRo,
      name_en: category.nameEn || category.nameRo,
      name_de: category.nameDe || category.nameRo
    }).select().single();
    if (error) throw error;
    return data;
  },

  async updateCategory(id, category) {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized.');
    const { data, error } = await client.from('article_categories').update({
      name_ro: category.nameRo,
      name_en: category.nameEn || category.nameRo,
      name_de: category.nameDe || category.nameRo
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteCategory(id) {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized.');
    const { error } = await client.from('article_categories').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // Get editable homepage content. Returns null until the optional homepage schema is installed.
  async getHomepageContent() {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from('homepage_content')
      .select('content, hero_image_url')
      .eq('id', 'home')
      .maybeSingle();

    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') return null;
      throw error;
    }

    if (!data) return null;
    return {
      content: data.content || {},
      heroImageUrl: data.hero_image_url || null
    };
  },

  // Save homepage content. Supabase RLS restricts this operation to authenticated users.
  async updateHomepageContent(content, heroImageUrl = null) {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized.');

    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error('Not authenticated. Please log in again.');

    const { data, error } = await client
      .from('homepage_content')
      .upsert({
        id: 'home',
        content,
        hero_image_url: heroImageUrl || null,
        updated_at: new Date().toISOString(),
        updated_by: session.user.id
      }, { onConflict: 'id' })
      .select('content, hero_image_url')
      .single();

    if (error) throw error;
    return {
      content: data.content || {},
      heroImageUrl: data.hero_image_url || null
    };
  },

  // Upload a homepage image to the public, admin-write-only media bucket.
  async uploadHomepageImage(file) {
    await this.ensureInitialized();
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not initialized.');
    if (!file || !file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.size > 5 * 1024 * 1024) throw new Error('The image must be smaller than 5 MB.');

    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error('Not authenticated. Please log in again.');

    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${session.user.id}/${Date.now()}.${extension}`;
    const { error } = await client.storage
      .from('homepage-media')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (error) throw error;

    const { data } = client.storage.from('homepage-media').getPublicUrl(path);
    return data.publicUrl;
  }
};
