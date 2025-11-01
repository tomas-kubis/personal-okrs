#!/usr/bin/env node

/**
 * Validates Supabase environment variables before build
 * This script helps catch configuration issues early in the CI/CD pipeline
 */

const REQUIRED_VARS = {
  VITE_SUPABASE_URL: {
    pattern: /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/,
    description: 'Supabase project URL (e.g., https://xxxxx.supabase.co)',
  },
  VITE_SUPABASE_ANON_KEY: {
    pattern: /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    description: 'Supabase anonymous (anon/public) JWT key',
  },
};

function validateEnvVar(name, config) {
  const value = process.env[name];

  if (!value) {
    console.error(`❌ ${name} is not set`);
    return false;
  }

  // Check for common issues
  const trimmed = value.trim();
  if (trimmed !== value) {
    console.error(`❌ ${name} has leading or trailing whitespace`);
    console.error(`   Length: ${value.length}, Trimmed length: ${trimmed.length}`);
    return false;
  }

  // Check for quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    console.error(`❌ ${name} is wrapped in quotes - remove the quotes from the secret value`);
    console.error(`   First char: ${value[0]}, Last char: ${value[value.length - 1]}`);
    return false;
  }

  // Check for template syntax
  if (value.includes('${{') || value.includes('${')) {
    console.error(`❌ ${name} contains template syntax - the secret was not properly substituted`);
    console.error(`   Value appears to be: ${value.substring(0, 50)}...`);
    return false;
  }

  // Check for placeholder values
  if (value.toLowerCase().includes('your-') ||
      value.toLowerCase().includes('<') ||
      value.toLowerCase().includes('>')) {
    console.error(`❌ ${name} appears to be a placeholder value`);
    console.error(`   Value: ${value.substring(0, 50)}...`);
    return false;
  }

  // Check format
  if (!config.pattern.test(value)) {
    console.error(`❌ ${name} does not match expected format`);
    console.error(`   Expected: ${config.description}`);
    console.error(`   Length: ${value.length} characters`);
    console.error(`   First 10 chars: ${value.substring(0, 10)}...`);
    console.error(`   Last 10 chars: ...${value.substring(value.length - 10)}`);

    // Additional checks for JWT tokens
    if (name.includes('ANON_KEY')) {
      const parts = value.split('.');
      console.error(`   JWT parts found: ${parts.length} (expected: 3)`);
      if (parts.length === 3) {
        console.error(`   Part 1 length: ${parts[0].length}, Part 2 length: ${parts[1].length}, Part 3 length: ${parts[2].length}`);

        // Check for invalid characters in JWT
        const invalidChars = value.match(/[^A-Za-z0-9._-]/g);
        if (invalidChars) {
          console.error(`   ⚠️  Invalid characters found in JWT: ${[...new Set(invalidChars)].join(', ')}`);
          console.error(`   JWT tokens should only contain: A-Z, a-z, 0-9, dots, hyphens, and underscores`);
        }
      }
    }

    return false;
  }

  console.log(`✅ ${name} is valid`);
  console.log(`   Format: ${config.description}`);
  console.log(`   Length: ${value.length} characters`);

  return true;
}

function main() {
  console.log('🔍 Validating Supabase environment variables...\n');

  let allValid = true;

  for (const [name, config] of Object.entries(REQUIRED_VARS)) {
    const isValid = validateEnvVar(name, config);
    allValid = allValid && isValid;
    console.log('');
  }

  if (allValid) {
    console.log('✨ All environment variables are valid!\n');
    console.log('📝 Reminder: The anon key should be copied from:');
    console.log('   Supabase Dashboard → Project Settings → API → Project API keys → anon public\n');
    process.exit(0);
  } else {
    console.log('❌ Environment validation failed!\n');
    console.log('📝 How to fix:');
    console.log('   1. Go to your GitHub repository');
    console.log('   2. Navigate to Settings → Secrets and variables → Actions');
    console.log('   3. Update the secrets with the correct values from Supabase:');
    console.log('      - VITE_SUPABASE_URL: Copy from Project Settings → API → Project URL');
    console.log('      - VITE_SUPABASE_ANON_KEY: Copy from Project Settings → API → anon public key');
    console.log('   4. IMPORTANT: Copy the values exactly as shown, without quotes or extra spaces\n');
    process.exit(1);
  }
}

main();
