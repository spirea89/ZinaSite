# ZinaSite

Basic website and admin tool for ZusammenInAustria (Zina), a non-profit connecting Romanian expats in Vienna.

## Getting started

### Prerequisites

- Node.js installed
- Supabase account and project

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a `.env` file in the root directory with your Supabase credentials:
     ```
     SUPABASE_URL=https://your-project-url.supabase.co
     SUPABASE_ANON_KEY=your_anon_key
     ```
   - Run the SQL schema in your Supabase SQL Editor (see `supabase-schema.sql`)

3. **Start the server:**
   ```bash
   npm start
   ```

The site will be available at http://localhost:3000. Use `/admin.html` to create, edit, save drafts, and publish articles.

## Database Setup

Before running the application, you need to create the `articles` table in Supabase. Run the SQL commands in `supabase-schema.sql` in your Supabase SQL Editor.
