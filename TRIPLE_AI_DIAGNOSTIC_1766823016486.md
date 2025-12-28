# Triple AI & Knowledge Engine Diagnostic Guide

## 🎯 Understanding Triple AI Architecture

### System Overview
```
User Query
    ↓
Triple AI Handler (Routes to appropriate AI)
    ↓
┌─────────────┬──────────────┬─────────────┐
│   P1: Code  │  P2: Process │ P3: Knowledge│
│  gpt-4o-mini│  llama-3.3   │  gpt-4o-mini │
└─────────────┴──────────────┴─────────────┘
    ↓
Domain Router (30 Iracore domains)
    ↓
Knowledge Engine (5 domains for fusion)
    ↓
Final Response
```

---

## 🚨 Common Failure Points (What's Probably Broken)

### 1. API Key Issues (Most Common)

**Check these environment variables in `.env`:**

```bash
# Required for Triple AI
OPENROUTER_API_KEY=sk-or-v1-...  # Must be valid
GITHUB_MODELS_TOKEN=github_pat_... # Must be valid
OPENAI_API_KEY=sk-... # Optional but recommended

# Check if expired
grep -E "OPENROUTER|GITHUB|OPENAI" .env
```

**Test API keys:**

```bash
# Test OpenRouter
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Test GitHub Models
curl https://models.inference.ai.azure.com/models \
  -H "Authorization: Bearer $GITHUB_MODELS_TOKEN"
```

**Symptoms if broken:**
- "API key invalid" errors
- "Unauthorized" responses
- Empty/null responses from AI

---

### 2. Model Deprecation/Unavailability

**The models may have changed:**

```bash
# In .env, check these are still valid:
TRIPLE_AI_P2_PRIMARY=meta-llama/llama-3.3-70b-instruct
TRIPLE_AI_P2_BACKUP=google/gemini-2.0-flash-exp:free
```

**Recent changes that could break:**
- `llama-3.3-70b` may have been renamed
- `gemini-2.0-flash-exp` might no longer be free
- OpenRouter model availability changes

**Fix:** Update to current models:

```bash
# Recommended replacements (as of Dec 2024)
TRIPLE_AI_P2_PRIMARY=meta-llama/llama-3.1-70b-instruct
TRIPLE_AI_P2_BACKUP=google/gemini-flash-1.5
```

---

### 3. Domain Router Not Executing

**File:** `server/ai/triple-ai-handler.ts`

**Check if domain detection is working:**

Add logging to see which domain is selected:

```typescript
// In triple-ai-handler.ts, add:
console.log('[TRIPLE-AI] Detected domain:', selectedDomain);
console.log('[TRIPLE-AI] Using model:', selectedModel);
console.log('[TRIPLE-AI] Query:', query);
```

**If no domain logs appear:**
- Domain detection logic is broken
- Query preprocessing failed
- Router not being called at all

---

### 4. Knowledge Engine Not Being Invoked

**File:** `server/ai/knowledge-engine.ts`

**The Knowledge Engine should:**
1. Detect when multi-domain synthesis is needed
2. Query multiple domains
3. Fuse answers together

**Check if it's being called:**

```typescript
// In knowledge-engine.ts, add:
console.log('[KNOWLEDGE-ENGINE] Starting fusion for query:', query);
console.log('[KNOWLEDGE-ENGINE] Domains to query:', domains);
console.log('[KNOWLEDGE-ENGINE] Fusion result:', fusedAnswer);
```

**Common issues:**
- Threshold for invoking knowledge engine too high
- Domain entanglement scores broken
- Fusion logic errors out silently

---

### 5. Database Issues

**Domain entanglements table may be empty or corrupted:**

```sql
-- Check if domain entanglements exist
SELECT COUNT(*) FROM domain_entanglements;

-- Check entanglement strengths
SELECT domain_id_a, domain_id_b, strength 
FROM domain_entanglements 
ORDER BY strength DESC 
LIMIT 10;

-- If empty, the knowledge engine can't link domains
```

**Fix:** Rebuild entanglements:

```typescript
// You may need to re-initialize domain entanglements
// Check if there's a setup/migration script for this
```

---

## 🧪 Step-by-Step Diagnostic

### Step 1: Test Basic AI Response (Bypass Triple AI)

```bash
# Test if OpenRouter works at all
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.1-8b-instruct:free",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Expected:** Should return AI response  
**If fails:** API key is bad

### Step 2: Test Triple AI Endpoint Directly

```bash
# Call your Triple AI API
curl http://localhost:3001/api/triple-ai \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is machine learning?",
    "mode": "auto-advanced"
  }'
```

**Expected:** Should return answer with metrics  
**If fails:** Check response for error message

### Step 3: Check Backend Logs

Start server with verbose logging:

```bash
LOG_LEVEL=debug npm run server
```

**Look for:**
- `[TRIPLE-AI]` logs
- `[KNOWLEDGE-ENGINE]` logs
- API errors
- Model selection logs

### Step 4: Check Database Domain Data

```sql
-- Check if domains are registered
SELECT * FROM domain_entanglements LIMIT 5;

-- Check recent AI interactions
SELECT * FROM unified_memory 
WHERE mode = 'auto-advanced' 
ORDER BY created_at DESC 
LIMIT 5;

-- Check AI weights
SELECT * FROM ai_interaction_weights 
ORDER BY updated_at DESC 
LIMIT 10;
```

### Step 5: Test Knowledge Engine Specifically

**If you have a knowledge engine test endpoint:**

```bash
curl http://localhost:3001/api/knowledge-engine/test \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Explain quantum computing and its applications",
    "domains": ["quantum", "computing", "applications"]
  }'
```

---

## 🔧 Common Fixes

### Fix 1: Update API Keys

```bash
# Get new OpenRouter key from https://openrouter.ai/keys
# Update .env
OPENROUTER_API_KEY=sk-or-v1-NEW_KEY_HERE

# Restart server
npm run server
```

### Fix 2: Update Models to Current Versions

```bash
# .env changes
TRIPLE_AI_P2_PRIMARY=meta-llama/llama-3.1-70b-instruct
TRIPLE_AI_P2_BACKUP=google/gemini-1.5-flash
```

### Fix 3: Reset Domain Entanglements

**If database table is empty:**

```sql
-- You may need to run initialization
-- Check for drizzle migrations
npm run db:push

-- Or manually insert test entanglements
INSERT INTO domain_entanglements (domain_id_a, domain_id_b, strength) VALUES
('quantum', 'computing', 0.8),
('machine-learning', 'ai', 0.9),
('data', 'analytics', 0.85);
```

### Fix 4: Add Fallback to Single AI

**If Triple AI is too broken, temporarily simplify:**

```typescript
// In triple-ai-handler.ts, add simple fallback:
if (tripleAIFails) {
  // Just use OpenAI directly
  return await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: query }]
  });
}
```

---

## 📋 Diagnostic Checklist

Environment:
- [ ] OPENROUTER_API_KEY is valid (not expired)
- [ ] GITHUB_MODELS_TOKEN is valid
- [ ] Model names in .env are current
- [ ] All model variables set (P1, P2, P3 primary and backup)

Database:
- [ ] domain_entanglements table has data
- [ ] ai_interaction_weights table exists
- [ ] unified_memory is recording interactions

Code:
- [ ] triple-ai-handler.ts is being called
- [ ] Domain detection logic executes
- [ ] Knowledge engine is invoked for complex queries
- [ ] Error handling doesn't swallow failures silently

API Providers:
- [ ] OpenRouter API responding
- [ ] GitHub Models API responding
- [ ] Fallback models work if primary fails

---

## 🎯 Most Likely Culprits (In Order)

1. **API Key Expired** (80% chance)
   - OpenRouter keys can expire
   - GitHub tokens have expiration
   - Check key validity first

2. **Model Renamed/Deprecated** (15% chance)
   - `llama-3.3` might be `llama-3.1` now
   - `gemini-2.0-flash-exp` may no longer be free
   - Update model names in .env

3. **Domain Entanglements Empty** (3% chance)
   - Database was wiped
   - Migration didn't run
   - Need to rebuild entanglements

4. **Code Logic Broken** (2% chance)
   - Recent changes broke routing
   - Error swallowed silently
   - Check logs for exceptions

---

## 📞 Next Steps

1. **Check API keys first:**
   ```bash
   echo $OPENROUTER_API_KEY
   # Should start with sk-or-v1-
   ```

2. **Test OpenRouter directly:**
   ```bash
   curl https://openrouter.ai/api/v1/models \
     -H "Authorization: Bearer YOUR_KEY"
   ```

3. **Check backend logs** when making request:
   ```bash
   LOG_LEVEL=debug npm run server
   # Then make a Triple AI request
   # Look for errors
   ```

4. **Share specific error** if you see one:
   - API error message
   - Backend console output
   - Browser console error

---

## 💡 Quick Test Script

Run this to test everything:

```javascript
// Test in browser console or Node
async function testTripleAI() {
  const response = await fetch('/api/triple-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Explain machine learning',
      mode: 'auto-advanced'
    })
  });
  
  const data = await response.json();
  console.log('Response:', data);
  
  if (!data.ok) {
    console.error('ERROR:', data.error);
    console.error('This tells us what broke!');
  } else {
    console.log('✅ Triple AI working!');
    console.log('Domains used:', data.metrics?.domainsUsed);
  }
}

testTripleAI();
```

This will show exactly what's failing!
