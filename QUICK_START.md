# Quick Start Guide - Admin Authentication

## Step 1: Create Admin User (✅ SQL Schema Already Run)

1. Go to your Supabase Dashboard: https://nveksidxddivsqywsrjb.supabase.co
2. Navigate to **Authentication** → **Users**
3. Click **"Add User"** button → Select **"Create new user"**
4. Fill in:
   - **Email**: your admin email (e.g., admin@zina.com)
   - **Password**: choose a secure password
   - ✅ Check **"Auto Confirm User"** (important - allows immediate login)
5. Click **"Create User"**

## Step 2: Test the Admin Login

1. Go to your site: `/admin.html` (or the GitHub Pages URL + `/admin.html`)
2. You should see a login modal
3. Enter the email and password you just created
4. Click **"Autentificare"**
5. You should now see the admin panel with article management

## Step 3: Test Article Operations

Once logged in, try:
- ✅ Creating a new article
- ✅ Editing an existing article
- ✅ Deleting an article
- ✅ Viewing all articles (including drafts)

## Troubleshooting

### "Email sau parolă incorectă" Error
- Double-check email/password
- Verify user exists in Supabase → Authentication → Users
- Make sure email provider is enabled in Supabase

### Can't access articles after login
- Check browser console (F12) for errors
- Verify RLS policies were updated (the SQL ran successfully)
- Try logging out and back in

### Login works but can't save articles
- Check Supabase logs for policy violations
- Verify the user is authenticated (check session in browser)
- Make sure RLS policies allow authenticated users to write

## Next Steps

- Create multiple admin users if needed
- Commit the authentication changes to git (if you want)
- Test on both localhost and GitHub Pages

