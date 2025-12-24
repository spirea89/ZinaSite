// Authentication service using Supabase Auth
// Works on both GitHub Pages and local development

// Define Supabase config once (this script loads first)
if (!window.__SUPABASE_CONFIG) {
  window.__SUPABASE_CONFIG = {
    url: 'https://nveksidxddivsqywsrjb.supabase.co',
    anonKey: 'sb_publishable_SUQ2hBY4_Q_0KY78GwNKqg_fmi8KXc8'
  };
}

// Use the shared config
const SUPABASE_URL = window.__SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = window.__SUPABASE_CONFIG.anonKey;

let authClient = null;

// Initialize Supabase auth client (shared instance with data-service)
function getAuthClient() {
  // Always use the shared client if it exists (maintains session consistency)
  if (window.__supabaseClient) {
    authClient = window.__supabaseClient;
    return authClient;
  }
  
  // Only create if it doesn't exist (prevents multiple instances)
  if (!authClient) {
    // Check if Supabase is available
    if (typeof window.supabase === 'undefined') {
      console.warn('Supabase library not loaded yet');
      return null;
    }
    // Create the client and immediately share it
    authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.__supabaseClient = authClient; // Share with data-service immediately
    console.log('Supabase auth client created and shared');
  }
  return authClient;
}

// Auth Service
const AuthService = {
  // Get current session
  async getSession() {
    try {
      const client = getAuthClient();
      if (!client) {
        return null;
      }
      const { data: { session }, error } = await client.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  // Get current user
  async getCurrentUser() {
    const session = await this.getSession();
    return session?.user || null;
  },

  // Sign in with email and password
  async signIn(email, password) {
    try {
      const client = getAuthClient();
      if (!client) {
        throw new Error('Supabase client not initialized');
      }
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return { user: data.user, session: data.session };
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  },

  // Sign out
  async signOut() {
    try {
      const client = getAuthClient();
      if (!client) {
        throw new Error('Supabase client not initialized');
      }
      const { error } = await client.auth.signOut();
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    const client = getAuthClient();
    if (!client) {
      console.warn('Supabase client not initialized, cannot listen to auth changes');
      return { data: { subscription: null }, unsubscribe: () => {} };
    }
    return client.auth.onAuthStateChange(callback);
  }
};

