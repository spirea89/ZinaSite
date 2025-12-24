# GitHub Pages Deployment Guide

## Overview

This project is configured to work seamlessly on both:
- **Local development** - Uses Express.js backend with API endpoints
- **GitHub Pages** - Uses Supabase client directly (static hosting)

## How It Works

The application automatically detects the environment and uses the appropriate data source:

1. **On GitHub Pages** (`*.github.io` domain):
   - Uses Supabase JavaScript client directly
   - All API calls go directly to Supabase
   - No backend server required

2. **Local development** (`localhost`):
   - Uses Express.js API endpoints
   - Backend server handles all database operations
   - Full Node.js environment

## Deployment Steps

### 1. Using `/docs` Folder (Current Setup)

This is the **recommended approach** for GitHub Pages:

1. ✅ Files in `public/` are automatically synced to `docs/` via GitHub Actions
2. ✅ Enable GitHub Pages in repository settings:
   - Go to: **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** / **docs** folder
3. ✅ Your site will be available at: `https://username.github.io/repository-name/`

### 2. Database Setup Required

Before the site works on GitHub Pages, you must:

1. Run the SQL schema in Supabase:
   - Go to your Supabase dashboard
   - Open SQL Editor
   - Run the contents of `supabase-schema.sql`

2. Configure Row Level Security (RLS):
   - The schema includes RLS policies
   - Anonymous users can read published articles
   - For admin operations, you may need authentication (future enhancement)

### 3. Files Structure

```
public/
  ├── index.html          # Main page (uses DataService)
  ├── admin.html          # Admin page (uses DataService)
  ├── styles.css          # Styles
  └── data-service.js     # Environment-aware data layer

docs/                     # Synced from public/ (for GitHub Pages)
  ├── index.html
  ├── admin.html
  ├── styles.css
  └── data-service.js
```

## Key Features

- **Automatic environment detection** - Works without configuration
- **Unified API** - Same code works in both environments
- **No build step required** - Pure JavaScript
- **Secure** - Uses Supabase anon key (safe for public frontend)

## Troubleshooting

### Articles not loading on GitHub Pages?

1. Check browser console for errors
2. Verify Supabase database schema is created
3. Verify RLS policies allow anonymous reads
4. Check Supabase URL and anon key in `data-service.js`

### Admin page not working?

The admin page requires proper RLS policies for write operations. Currently, the RLS policy allows all operations (see `supabase-schema.sql`). For production:

1. Implement authentication
2. Create more restrictive RLS policies
3. Use service role key for admin operations (server-side only)

## Alternative: Full-Stack Deployment

If you prefer to deploy the full Node.js application:

### Recommended Platforms:
- **Vercel** - Great for Next.js/Node.js
- **Netlify** - Supports serverless functions
- **Railway** - Full Node.js support
- **Render** - Simple Node.js deployment

These platforms can run your Express.js server, and you can keep using API endpoints instead of direct Supabase calls.

## Best Practices

1. ✅ **Use `/docs` folder** - Simplest GitHub Pages setup
2. ✅ **Keep `public/` and `docs/` in sync** - Automated via GitHub Actions
3. ✅ **Never commit `.env` file** - Already in `.gitignore`
4. ✅ **Use anon key only** - Service role key should never be in frontend
5. ✅ **Test locally first** - Ensure everything works before deploying

