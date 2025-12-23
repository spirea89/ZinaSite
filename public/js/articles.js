import { supabase } from "./supabase.js";

async function loadArticles() {
  const { data, error } = await supabase
    .from("articles")
    .select("title, slug, created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  const el = document.getElementById("articles");

  if (!el) {
    console.warn('Missing <div id="articles"></div> in your HTML');
    return;
  }

  if (error) {
    console.error("Supabase error:", error);
    el.textContent = "Error loading articles (check console).";
    return;
  }

  if (!data || data.length === 0) {
    el.textContent = "No published articles yet.";
    return;
  }

  el.innerHTML = data
    .map(a => `<p><a href="/article.html?slug=${encodeURIComponent(a.slug)}">${a.title}</a></p>`)
    .join("");
}

loadArticles();
