# Deploy Edge Functions to Supabase

You can deploy Edge Functions in two ways:
1. **Via Supabase Dashboard** (Recommended - easiest, no CLI needed)
2. **Via Supabase CLI** (Advanced - for development workflow)

---

## Option 1: Deploy via Supabase Dashboard (Recommended)

This method uses the standalone versions that don't require CLI or folder structure.

### Step 1: Generate Encryption Key

First, generate a secure encryption key. Choose one method:

**Using OpenSSL** (Mac/Linux):
```bash
openssl rand -base64 32
```

**Using Node.js**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Using Online Tool**:
Visit https://generate-random.org/base64-string-generator (set length to 44)

**Copy the generated key** - you'll need it in the next step.

### Step 2: Set Environment Variable

1. Go to https://supabase.com/dashboard/project/YOUR-PROJECT-REF/settings/functions
2. Click **"Add new secret"**
3. Name: `ENCRYPTION_KEY`
4. Value: Paste your generated key from Step 1
5. Click **"Save"**

### Step 3: Deploy Chat Function

1. Go to https://supabase.com/dashboard/project/YOUR-PROJECT-REF/functions
2. Click **"Create a new function"**
3. Name: `chat`
4. Copy **the entire contents** of `supabase/functions/chat-standalone.ts`
5. Paste into the editor
6. Click **"Deploy"**

### Step 4: Deploy Providers Function

1. Still on the Edge Functions page, click **"Create a new function"**
2. Name: `providers`
3. Copy **the entire contents** of `supabase/functions/providers-standalone.ts`
4. Paste into the editor
5. Click **"Deploy"**

### Step 5: Verify Deployment

You should see both functions listed as **Active**:
- ✅ chat
- ✅ providers

**Done!** Your Edge Functions are now deployed and ready to use.

---

## Option 2: Deploy via Supabase CLI

### Quick Deploy

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR-PROJECT-REF

# Set encryption key secret
supabase secrets set ENCRYPTION_KEY=$(openssl rand -base64 32)

# Deploy both Edge Functions
supabase functions deploy chat
supabase functions deploy providers
```

## What These Commands Do

### 1. Login
```bash
supabase login
```
Opens browser to authenticate with Supabase.

### 2. Link Project
```bash
supabase link --project-ref YOUR-PROJECT-REF
```
**Find your project ref:**
- Go to https://supabase.com/dashboard
- Your URL is: `https://supabase.com/dashboard/project/YOUR-PROJECT-REF`
- Copy `YOUR-PROJECT-REF` from the URL

### 3. Set Encryption Key
```bash
supabase secrets set ENCRYPTION_KEY=$(openssl rand -base64 32)
```
Creates a secure 256-bit encryption key for API keys.

**Alternative** (if OpenSSL not available):
```bash
# On macOS/Linux
supabase secrets set ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Or manually generate and paste:
supabase secrets set ENCRYPTION_KEY=<your-base64-key>
```

### 4. Deploy Functions
```bash
supabase functions deploy chat
supabase functions deploy providers
```
Uploads the Edge Functions to Supabase.

## Verify Deployment

After deploying, check in Supabase Dashboard:
1. Go to **Edge Functions** in left sidebar
2. You should see:
   - ✅ `chat`
   - ✅ `providers`
3. Both should show status: **Active**

## Test Edge Functions

### Test Providers Function
```bash
curl -i https://YOUR-PROJECT-REF.supabase.co/functions/v1/providers?action=list \
  -H "Authorization: Bearer YOUR-ANON-KEY"
```

Should return: `{"providers":[]}`

### Test Chat Function
```bash
curl -i https://YOUR-PROJECT-REF.supabase.co/functions/v1/chat \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -H "Content-Type: application/json"
```

Should return error about missing sessionId (expected).

## Troubleshooting

### Error: "Project ref not found"
Run: `supabase link --project-ref YOUR-PROJECT-REF`

### Error: "Not logged in"
Run: `supabase login`

### Error: "ENCRYPTION_KEY not set"
Run: `supabase secrets set ENCRYPTION_KEY=$(openssl rand -base64 32)`

### Error: "Function not found" (404)
The functions need to be deployed first. Run the deploy commands above.

## Update Existing Functions

If you make changes to the Edge Functions:
```bash
supabase functions deploy chat
supabase functions deploy providers
```

## View Logs

```bash
# View chat function logs
supabase functions logs chat

# View providers function logs
supabase functions logs providers

# Follow logs in real-time
supabase functions logs chat --follow
```

## Remove Functions

If you want to remove the Edge Functions:
```bash
supabase functions delete chat
supabase functions delete providers
```

## Next Steps

After deploying:
1. ✅ Functions are live
2. ✅ Go to your app
3. ✅ Navigate to Settings → AI Providers
4. ✅ Click "Add Provider"
5. ✅ Should work now!
