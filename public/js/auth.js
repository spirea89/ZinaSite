import { supabase } from "./supabase.js";

const REDIRECT_DEFAULT = "/login.html";

const redirectToLogin = (redirectTo = REDIRECT_DEFAULT) => {
  window.location.replace(redirectTo);
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
    window.location.replace(redirectTo);
  }
}

export async function requireAuth(options = {}) {
  const { redirectTo = REDIRECT_DEFAULT } = options;

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
