# Edge Functions Auto-Deployment

Edge Functions are **automatically deployed** via GitHub Actions when you push changes to the `main` branch.

All code lives in `supabase/functions/` in your GitHub repository - no manual deployment needed!

---

## One-Time Setup

You only need to do this once to enable auto-deployment.

### Step 1: Get Supabase Access Token

1. Go to https://supabase.com/dashboard/account/tokens
2. Click **"Generate new token"**
3. Name it: `GitHub Actions`
4. Copy the token (you'll need it in the next step)

### Step 2: Add GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add two secrets:

   **Secret 1:**
   - Name: `SUPABASE_ACCESS_TOKEN`
   - Value: (paste the token from Step 1)

   **Secret 2:**
   - Name: `SUPABASE_PROJECT_REF`
   - Value: Your Supabase project reference ID
     - Find it in your Supabase dashboard URL: `https://supabase.com/dashboard/project/YOUR-PROJECT-REF`

### Step 3: Set Encryption Key in Supabase

Generate and set the encryption key for API key storage:

```bash
# Install Supabase CLI (one-time)
npm install -g supabase

# Login to Supabase
supabase login

# Set encryption key
supabase secrets set ENCRYPTION_KEY=$(openssl rand -base64 32) --project-ref YOUR-PROJECT-REF
```

**Alternative** (if OpenSSL not available):
```bash
# Using Node.js
supabase secrets set ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))") --project-ref YOUR-PROJECT-REF
```

### Step 4: Initial Deployment

Trigger the first deployment:

```bash
# Push to main branch
git checkout main
git push origin main
```

Or manually deploy once:
```bash
supabase functions deploy chat --project-ref YOUR-PROJECT-REF
supabase functions deploy providers --project-ref YOUR-PROJECT-REF
```

---

## How Auto-Deployment Works

Once setup is complete:

1. **You edit code** in `supabase/functions/chat/` or `supabase/functions/providers/`
2. **Commit and push** to `main` branch
3. **GitHub Actions automatically deploys** the updated functions to Supabase
4. **Functions are live** within ~1 minute

### Check Deployment Status

- Go to your GitHub repo → **Actions** tab
- You'll see "Deploy Edge Functions" workflow running
- Click on it to see deployment logs

### Verify Functions are Live

Check in Supabase Dashboard:
1. Go to **Edge Functions** in left sidebar
2. You should see:
   - ✅ `chat` (Active)
   - ✅ `providers` (Active)
3. Click on each to see deployment history and logs

---

## Manual Deployment (Optional)

If you ever need to deploy manually (without pushing to main):

```bash
supabase functions deploy chat --project-ref YOUR-PROJECT-REF
supabase functions deploy providers --project-ref YOUR-PROJECT-REF
```

---

## View Logs

```bash
# View real-time logs
supabase functions logs chat --follow
supabase functions logs providers --follow

# View recent logs
supabase functions logs chat
supabase functions logs providers
```

---

## Troubleshooting

### GitHub Action Fails: "SUPABASE_ACCESS_TOKEN not found"
→ Make sure you added the secret in GitHub repo Settings → Secrets and variables → Actions

### GitHub Action Fails: "Project not found"
→ Check that `SUPABASE_PROJECT_REF` secret has the correct project reference ID

### Function Returns "ENCRYPTION_KEY not set"
→ Run: `supabase secrets set ENCRYPTION_KEY=$(openssl rand -base64 32) --project-ref YOUR-PROJECT-REF`

### Changes Not Deploying
→ Check that your changes are in `supabase/functions/` folder and you pushed to `main` branch

---

## Architecture

```
GitHub Repository (main branch)
  └── supabase/functions/
      ├── chat/index.ts
      ├── providers/index.ts
      └── _shared/
          ├── crypto.ts
          └── llm-provider.ts
            ↓
    [Push to main triggers]
            ↓
   GitHub Actions Workflow
            ↓
  Supabase Edge Functions (Deployed)
```

All code stays in your GitHub repository. GitHub Actions handles deployment automatically.
