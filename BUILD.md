# Build Instructions

## Prerequisites

Before building, ensure all dependencies are installed:

```bash
npm install
```

If you encounter network issues during install, try:

```bash
npm install --legacy-peer-deps
# or
npm ci
```

## Build Process

### 1. Development Build

```bash
npm run dev
```

This starts the Vite development server on http://localhost:5173

### 2. Production Build

```bash
npm run build
```

This will:
1. Run TypeScript compiler (`tsc -b`)
2. Run Vite build
3. Output to `dist/` directory

### 3. Preview Production Build

```bash
npm run preview
```

## Common Build Issues

### Issue: "Cannot find type definition file for 'vite/client'"

**Cause:** Missing `vite` package or `@types/node`

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Cannot find module '../lib/supabaseClient'"

**Cause:** TypeScript can't resolve the import

**Fix:** Verify `src/lib/supabaseClient.ts` exists and exports `supabase`

### Issue: Type errors in new AI coaching code

**Potential causes and fixes:**

1. **SessionContext type mismatch**
   - Check `src/types/index.ts` includes `recentSessions?` field

2. **Provider types**
   - Verify `ProviderName` type is exported from `src/types/index.ts`

3. **Import paths**
   - All components should import from `'../types'` not `'../types/index'`

## Verifying the Build

After a successful build:

1. Check `dist/` directory exists
2. Check `dist/index.html` exists
3. Run `npm run preview` to test the build locally

## TypeScript Type Checking

To run type checking without building:

```bash
npx tsc --noEmit
```

## Linting

```bash
npm run lint
```

## Edge Functions (Supabase)

Edge functions are NOT part of the frontend build. They are deployed separately:

```bash
# Deploy all functions
supabase functions deploy chat
supabase functions deploy providers

# Or deploy specific function
supabase functions deploy chat
```

## Environment Variables

Required for frontend:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

Create `.env.local`:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Build Verification Checklist

After running `npm run build`, verify:

- [ ] No TypeScript errors
- [ ] No Vite build errors
- [ ] `dist/` directory created
- [ ] `dist/index.html` exists
- [ ] `dist/assets/` contains JS and CSS files
- [ ] Preview works: `npm run preview`

## Troubleshooting

### Clear cache and rebuild

```bash
rm -rf node_modules package-lock.json dist .vite
npm install
npm run build
```

### Check Node version

Required: Node.js 18+ or 20+

```bash
node --version
```

### Check npm version

```bash
npm --version
```

## Docker Build (Optional)

If you want to build in a clean environment:

```bash
docker run --rm -v $(pwd):/app -w /app node:20 sh -c "npm install && npm run build"
```

## CI/CD Build

For GitHub Actions or similar:

```yaml
- name: Install dependencies
  run: npm ci

- name: Build
  run: npm run build

- name: Test build output
  run: |
    ls -la dist/
    test -f dist/index.html
```

## Need Help?

If build issues persist after following these steps:

1. Check browser console for runtime errors
2. Check `node_modules/` is not empty
3. Verify all imports use correct paths
4. Check TypeScript version compatibility
5. Review Git logs for recent changes that might have caused issues

```bash
# Check what changed recently
git log --oneline -10

# Check specific file changes
git diff HEAD~1 src/types/index.ts
```
