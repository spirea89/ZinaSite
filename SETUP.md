# Supabase Setup Instructions

## 1. Create .env File

Create a `.env` file in the root directory with the following content:

```
SUPABASE_URL=https://nveksidxddivsqywsrjb.supabase.co
SUPABASE_ANON_KEY=sb_publishable_SUQ2hBY4_Q_0KY78GwNKqg_fmi8KXc8
```

## 2. Set Up Database Schema

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the SQL commands from `supabase-schema.sql`

This will create the `articles` table with the necessary columns and security policies.

## 3. Start the Server

```bash
npm start
```

## Note on Security

The current setup uses Row Level Security (RLS) policies that allow:
- Anonymous users to read published articles
- Full access for service role operations

For production, you may want to:
- Use the service role key instead of the anon key on the server side
- Set up proper authentication
- Implement more restrictive RLS policies

