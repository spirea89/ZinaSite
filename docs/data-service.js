// Data service that works both on GitHub Pages (with Supabase) and locally (with API)

let supabaseClient = null;
let useSupabaseDirectly = false;
let supabaseInitialized = false;

// Supabase configuration (safe to expose - this is the anon/public key)
const SUPABASE_URL = 'https://nveksidxddivsqywsrjb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SUQ2hBY4_Q_0KY78GwNKqg_fmi8KXc8';

// Detect environment - more robust detection
const isGitHubPages = window.location.hostname.includes('github.io') || 
                      window.location.hostname.includes('github.com') ||
                      window.location.pathname.includes('/docs/'); // Also check pathname

// Initialize Supabase client
async function initializeSupabase() {
  if (supabaseInitialized) return;
  
  if (isGitHubPages) {
    // Wait for Supabase to be available (it's loaded via CDN in the HTML)
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    while (typeof window.supabase === 'undefined' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (typeof window.supabase !== 'undefined') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      useSupabaseDirectly = true;
      supabaseInitialized = true;
      console.log('Supabase client initialized for GitHub Pages');
    } else {
      console.warn('Supabase not available, falling back to API (if available)');
    }
  }
}

// Format article from database format to API format
function formatArticle(article) {
  return {
    id: article.id,
    title: article.title,
    content: article.content,
    status: article.status,
    createdAt: article.created_at || article.createdAt,
    updatedAt: article.updated_at || article.updatedAt
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
    if (isGitHubPages) {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        let query = supabaseClient
          .from('articles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (status) {
          query = query.eq('status', status);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data.map(formatArticle);
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

  // Get all articles (for admin)
  async getAllArticles() {
    await this.ensureInitialized();
    
    // On GitHub Pages, must use Supabase (no API available)
    if (isGitHubPages) {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { data, error } = await supabaseClient
          .from('articles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data.map(formatArticle);
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
    
    // On GitHub Pages, must use Supabase (no API available)
    if (isGitHubPages) {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { data, error } = await supabaseClient
          .from('articles')
          .insert({
            title: article.title,
            content: article.content,
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
    
    // On GitHub Pages, must use Supabase (no API available)
    if (isGitHubPages) {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { data, error } = await supabaseClient
          .from('articles')
          .update({
            title: article.title,
            content: article.content,
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
    
    // On GitHub Pages, must use Supabase (no API available)
    if (isGitHubPages) {
      if (!supabaseClient) {
        throw new Error('Supabase client not initialized. Please check your connection.');
      }
      try {
        const { error } = await supabaseClient
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
  }
};

