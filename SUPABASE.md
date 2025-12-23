## Supabase setup for ZinaSite

Follow these steps to provision Supabase so the app can store and manage articles.

### 1) Create a project
1. Sign in to [Supabase](https://supabase.com/).
2. Create a new project (any org) and note the **Project URL** and **service role key** from **Project Settings → API**.  
   - Do **not** use the anon key on the server; the service role key is required for full CRUD access.

### 2) Create the `articles` table
Run the SQL below in the Supabase SQL editor (or apply via migrations):

```sql
create extension if not exists "uuid-ossp";

create table if not exists public.articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text not null,
  status text not null check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 3) Allow RPC access (PostgREST defaults)
No additional policies are needed for service-role access. If you later add Row Level Security, ensure the service role key is exempted or policies permit full CRUD for your use cases.

### 4) Configure environment variables
Create a `.env` file in the project root with:

```
SUPABASE_URL=<Project URL from step 1>
SUPABASE_SERVICE_ROLE_KEY=<Service role key from step 1>
```

### 5) Run the server
```bash
npm install
npm start
```

If the environment variables are present, the API will read/write articles in Supabase. Without them, it falls back to the local `data/articles.json` file.

### 6) Admin/authoring flows
- Public site: `/` renders published articles.
- Admin page: `/admin.html` lets admins create, edit, publish/unpublish, and delete articles. The same API is used for both Supabase-backed and local JSON fallback storage.

