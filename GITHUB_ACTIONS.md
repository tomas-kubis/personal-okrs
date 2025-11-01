# GitHub Actions Workflows

This repository uses GitHub Actions for CI/CD.

## Workflows

### 1. CI (`ci.yml`)

**Triggers:** Pull requests to `main`, pushes to non-main branches

**Purpose:** Validate code quality and ensure builds succeed before merging

**Steps:**
1. ✅ Checkout code
2. ✅ Setup Node.js 20
3. ✅ Install dependencies (`npm ci`)
4. ✅ TypeScript type check (`tsc --noEmit`)
5. ✅ Run linter (`npm run lint`)
6. ✅ Build project (`npm run build`)
7. ✅ Upload build artifacts

**Environment Variables Required:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### 2. Deploy (`deploy.yml`)

**Triggers:** Push to `main` branch, manual workflow dispatch

**Purpose:** Build and deploy to GitHub Pages

**Steps:**
1. ✅ Checkout code
2. ✅ Setup Node.js 20
3. ✅ Configure GitHub Pages
4. ✅ Install dependencies (`npm ci`)
5. ✅ Build project with environment variables
6. ✅ Create 404.html fallback for SPA routing
7. ✅ Upload to GitHub Pages
8. ✅ Deploy to GitHub Pages

**Environment Variables Required:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Setup GitHub Secrets

To make the workflows work, you need to add secrets to your GitHub repository:

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (the long JWT token)

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these two secrets:

   **Secret 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://your-project.supabase.co`

   **Secret 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your full anon key)

## Verifying Workflows

### Check CI Status (for PRs)

1. Open your pull request
2. Scroll to the bottom - you'll see "All checks have passed" or "Some checks failed"
3. Click "Details" to see the full build log
4. If it fails, read the logs to identify the issue

### Check Deployment Status

1. Go to **Actions** tab in your repository
2. Click on the latest "Deploy to GitHub Pages" workflow run
3. Check the status and logs

## Troubleshooting

### "Build failed" on PR

**Possible causes:**
1. Missing GitHub secrets (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY)
2. TypeScript errors in code
3. Linting errors
4. Dependencies not installing properly

**Solution:**
- Check the workflow logs for specific errors
- Verify GitHub secrets are set correctly
- Fix any TypeScript/linting errors shown in logs

### "npm ci failed"

**Cause:** package-lock.json is out of sync with package.json

**Solution:**
1. Run locally: `rm -rf node_modules package-lock.json && npm install`
2. Commit the updated package-lock.json
3. Push to your branch

### Build succeeds locally but fails in CI

**Possible causes:**
1. Different Node versions
2. Missing environment variables
3. Case-sensitive file names (CI runs on Linux, local might be Mac/Windows)

**Solution:**
- Check Node version matches (we use Node 20)
- Verify secrets are set in GitHub
- Check file name casing in imports

## Manual Workflow Dispatch

You can manually trigger the deployment workflow:

1. Go to **Actions** tab
2. Click **Deploy to GitHub Pages**
3. Click **Run workflow**
4. Select branch (usually `main`)
5. Click **Run workflow** button

## Viewing Deployed Site

After successful deployment:

1. Go to **Settings** → **Pages**
2. Your site URL will be shown (e.g., `https://username.github.io/repository-name`)
3. It may take a few minutes for changes to appear

## Workflow Status Badges

Add these to your README.md to show workflow status:

```markdown
![CI](https://github.com/username/repository/workflows/CI/badge.svg)
![Deploy](https://github.com/username/repository/workflows/Deploy%20to%20GitHub%20Pages/badge.svg)
```

## Advanced: Workflow Customization

### Change Node Version

Edit the workflows and change `node-version: '20'` to your desired version.

### Add More Checks

Add additional steps in `ci.yml`:

```yaml
- name: Run tests
  run: npm test

- name: Check bundle size
  run: npm run size-check
```

### Deploy to Different Branch

Change `deploy.yml` to deploy from a different branch:

```yaml
on:
  push:
    branches: [ staging ]  # Change from 'main' to 'staging'
```

## Need Help?

If workflows are failing:
1. Check the **Actions** tab for detailed logs
2. Verify all secrets are set correctly
3. Compare your configuration with this documentation
4. Check that package-lock.json is committed and up to date
