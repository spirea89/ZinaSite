import { supabase } from "./supabase.js";

const DEFAULT_REDIRECT_PATH = "./login.html";

const resolveUrl = (path) => new URL(path, window.location.href).toString();

const redirectToLogin = (redirectTo = DEFAULT_REDIRECT_PATH) => {
  window.location.replace(resolveUrl(redirectTo));
};

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data.user;
}

export async function logout({ redirectTo } = {}) {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  if (redirectTo) {
    window.location.replace(resolveUrl(redirectTo));
  }
}

export async function requireAuth(options = {}) {
  const { redirectTo = DEFAULT_REDIRECT_PATH } = options;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    redirectToLogin(redirectTo);
    return null;
  }

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    if (!nextSession) {
      redirectToLogin(redirectTo);
    }
  });

  return session;
}
