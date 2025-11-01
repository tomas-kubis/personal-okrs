# GitHub Secrets Setup Guide

This guide explains how to properly configure GitHub repository secrets for deploying to GitHub Pages with Supabase.

## Required Secrets

You need to add two secrets to your GitHub repository:

1. `VITE_SUPABASE_URL` - Your Supabase project URL
2. `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous (public) key

## How to Add Secrets

### Step 1: Get Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **Settings** (gear icon) in the left sidebar
4. Click on **API** under Project Settings
5. You'll see two important values:
   - **Project URL**: This is your `VITE_SUPABASE_URL`
   - **Project API keys → anon public**: This is your `VITE_SUPABASE_ANON_KEY`

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click on **Secrets and variables** → **Actions**
4. Click **New repository secret**

#### Adding VITE_SUPABASE_URL

1. Name: `VITE_SUPABASE_URL`
2. Value: Paste your Supabase Project URL (e.g., `https://xxxxx.supabase.co`)
   - ⚠️ **Important**: Copy EXACTLY as shown, without quotes
   - ⚠️ Make sure there are NO extra spaces before or after
   - ⚠️ The URL should start with `https://` and end with `.supabase.co` (or `.supabase.in`)
3. Click **Add secret**

#### Adding VITE_SUPABASE_ANON_KEY

1. Name: `VITE_SUPABASE_ANON_KEY`
2. Value: Paste your Supabase anon public key
   - ⚠️ **Important**: Copy EXACTLY as shown from Supabase dashboard
   - ⚠️ Make sure there are NO extra spaces before or after
   - ⚠️ Do NOT wrap in quotes
   - ⚠️ Do NOT add any extra characters
   - ℹ️ The key should start with `eyJ` and contain only letters, numbers, dots, hyphens, and underscores
3. Click **Add secret**

## Common Mistakes to Avoid

### ❌ DON'T wrap values in quotes

```
Bad:  "https://xxxxx.supabase.co"
Good: https://xxxxx.supabase.co
```

### ❌ DON'T add extra whitespace

```
Bad:  https://xxxxx.supabase.co
      ^                        ^ (note the spaces)
Good: https://xxxxx.supabase.co
```

### ❌ DON'T use placeholder values

```
Bad:  <your-supabase-url>
Bad:  your-anon-key
Good: (actual values from Supabase dashboard)
```

### ❌ DON'T copy from code examples

```
Bad:  ${{ secrets.VITE_SUPABASE_URL }}
Good: https://xxxxx.supabase.co
```

## Verifying Your Setup

After adding the secrets:

1. Go to the **Actions** tab in your repository
2. Trigger a new workflow run (push to main or use "Run workflow" button)
3. Check the **Validate environment variables** step
4. If validation fails, it will show specific error messages to help you fix the issue

## Security Notes

- The Supabase anonymous (anon) key is **safe to expose** in client-side code
- It's designed to be public and is used in your frontend application
- Row Level Security (RLS) policies in Supabase control what data can be accessed with this key
- Never commit `.env` files to your repository
- GitHub secrets are encrypted and only exposed during workflow runs

## Troubleshooting

### Error: "Invalid characters found in JWT"

Your anon key contains characters that shouldn't be there. Double-check that you:
- Copied the entire key from Supabase
- Didn't accidentally include extra characters or symbols
- Didn't wrap the key in quotes

### Error: "Contains template syntax"

You copied the GitHub Actions variable syntax instead of the actual value. Use the value from Supabase dashboard, not from example code.

### Error: "Does not match expected format"

The validation script will show you:
- The length of your value
- The first and last 10 characters
- The number of JWT parts (should be 3)

Use this information to verify you copied the complete value.

## Need Help?

If you're still having issues:
1. Delete the existing secrets in GitHub
2. Go back to Supabase dashboard and copy the values fresh
3. Use a text editor to paste and verify the values before adding them to GitHub
4. Make sure your text editor doesn't add any formatting or extra characters
