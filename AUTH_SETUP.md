# Authentication Setup Guide

## Overview

The admin page is now protected with Supabase Authentication. Only authenticated users (admins) can access and manage articles.

## Setup Steps

### 1. Update Database Schema

Run the updated SQL in `supabase-schema.sql` in your Supabase SQL Editor. This will:
- Update RLS policies to require authentication for write operations
- Allow anonymous users to only read published articles
- Require authentication for reading drafts and all write operations

### 2. Enable Authentication in Supabase

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Providers**
3. Ensure **Email** provider is enabled
4. Configure email settings if needed (for password reset, etc.)

### 3. Create Admin Users

#### Option A: Via Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Click **Add User** → **Create new user**
3. Enter:
   - **Email**: admin email address
   - **Password**: secure password
   - **Auto Confirm User**: ✅ (check this to skip email confirmation)
4. Click **Create User**

#### Option B: Via SQL (Advanced)

```sql
-- Insert a new admin user (you'll need to set the password via dashboard or use Supabase's auth API)
-- Note: This is just the metadata, actual password must be set via Supabase Auth API or dashboard
```

### 4. Login to Admin Page

1. Navigate to `/admin.html` on your site
2. You'll see a login modal
3. Enter the email and password of an admin user
4. Click "Autentificare"
5. Once logged in, you can manage articles

## Security Features

- ✅ **Login required** - Admin page is inaccessible without authentication
- ✅ **Session management** - Users stay logged in until they sign out
- ✅ **RLS policies** - Database-level security prevents unauthorized access
- ✅ **Shared sessions** - Auth session is shared between auth-service and data-service

## How It Works

1. **Authentication Check**: On page load, the admin page checks if user is authenticated
2. **Login Modal**: If not authenticated, shows login form
3. **Session Sharing**: Auth service and data service share the same Supabase client instance
4. **Protected Operations**: All database operations (create, update, delete) require authentication
5. **Automatic Logout**: Session expires based on Supabase settings, or user can manually logout

## Troubleshooting

### "Email sau parolă incorectă" Error

- Verify the user exists in Supabase Authentication → Users
- Check that email/password are correct
- Ensure email provider is enabled in Supabase

### "Supabase client not initialized" Error

- Check that Supabase CDN script is loading
- Verify Supabase URL and anon key are correct
- Check browser console for errors

### Can't access articles after login

- Verify RLS policies are updated (run the new SQL from `supabase-schema.sql`)
- Check that the user is authenticated (session exists)
- Check browser console for specific error messages

### Session expires too quickly

- Adjust session expiry in Supabase dashboard: **Authentication** → **Settings** → **Session timeout**

## Creating Multiple Admin Users

Repeat step 3 (Create Admin Users) for each admin. All authenticated users can:
- Access the admin panel
- Create, edit, and delete articles
- Read all articles (including drafts)

## Best Practices

1. **Use strong passwords** for admin accounts
2. **Enable MFA** if available in Supabase (recommended for production)
3. **Regularly review** admin users in Supabase dashboard
4. **Monitor access** through Supabase logs
5. **Use different accounts** for different admins (don't share credentials)

