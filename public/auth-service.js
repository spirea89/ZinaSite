// Authentication service using Supabase Auth
// Works on both GitHub Pages and local development

const SUPABASE_URL = 'https://nveksidxddivsqywsrjb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SUQ2hBY4_Q_0KY78GwNKqg_fmi8KXc8';

let authClient = null;

// Initialize Supabase auth client (shared instance with data-service)
function getAuthClient() {
  if (!authClient) {
    // Wait for Supabase to be available
    if (typeof window.supabase === 'undefined') {
      throw new Error('Supabase library not loaded');
    }
    authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Share the same client instance with data-service for session sharing
    if (typeof window.__supabaseClient === 'undefined') {
      window.__supabaseClient = authClient;
    }
  }
  return authClient;
}

// Auth Service
const AuthService = {
  // Get current session
  async getSession() {
    try {
      const client = getAuthClient();
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
    return client.auth.onAuthStateChange(callback);
  }
};

