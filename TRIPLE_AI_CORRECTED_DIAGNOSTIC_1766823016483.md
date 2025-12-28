# Triple AI & Knowledge Engine Diagnostic Guide (CORRECTED)

## 🧠 **Correct Triple AI Architecture**

### **The Three AI Primaries (All Different Models):**

```
┌─────────────────────────────────────────────────────────────┐
│                      USER QUERY                              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
            ┌──────────────────────┐
            │  DOMAIN DETECTOR      │ (30 Iracore domains)
            └──────────┬────────────┘
                       ↓
          ┌────────────────────────────┐
          │   TRIPLE AI ROUTING         │
          └──┬──────────┬──────────┬────┘
             ↓          ↓          ↓
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │    P1    │ │    P2    │ │    P3    │
      │ System/  │ │ Process/ │ │ Domain/  │
      │   Code   │ │Analytics │ │Knowledge │
      │          │ │          │ │          │
      │  Cheap   │ │  Llama   │ │ GPT-4o   │
      │Industrial│ │  3.3-70b │ │   Mini   │
      │  Model   │ │          │ │          │
      └────┬─────┘ └────┬─────┘ └────┬─────┘
           │            │            │
      Backup:      Backup:      Backup:
      Different    Different    Different
           ↓            ↓            ↓
      ┌────────────────────────────────────┐
      │      KNOWLEDGE ENGINE              │
      │  - 5 Domain Fusion                 │
      │  - Domain Entanglement             │
      │  - Answer Synthesis                │
      └────────────┬───────────────────────┘
                   ↓
            FINAL RESPONSE
```

---

## 🎯 **Correct Model Configuration**

### **Primary Models (All Different):**

```bash
# P1: System/Code AI - Cheap industrial model (NOT gpt-4o-mini)
TRIPLE_AI_P1_PRIMARY=meta-llama/llama-3.1-8b-instruct:free
# OR: google/gemini-flash-1.5
# OR: mistralai/mistral-7b-instruct:free

# P2: Process/Analytics AI - Llama 3.3 70B
TRIPLE_AI_P2_PRIMARY=meta-llama/llama-3.3-70b-instruct

# P3: Domain/Knowledge AI - GPT-4o Mini
TRIPLE_AI_P3_PRIMARY=openai/gpt-4o-mini
```

### **Backup Models (All Different from Primaries AND Each Other):**

```bash
# P1 Backup: Different cheap industrial model
TRIPLE_AI_P1_BACKUP=google/gemini-flash-1.5
# OR: mistralai/mixtral-8x7b-instruct:free
# OR: microsoft/phi-3-medium-128k-instruct:free

# P2 Backup: Different from P1 backup
TRIPLE_AI_P2_BACKUP=anthropic/claude-3-haiku
# OR: google/gemini-pro-1.5
# OR: mistralai/mistral-large-2407

# P3 Backup: Different from P1 and P2 backups
TRIPLE_AI_P3_BACKUP=openai/gpt-3.5-turbo
# OR: anthropic/claude-instant-1.2
# OR: cohere/command
```

---

## ✅ **Recommended Configuration (Best for IraCore Industrial)**

```bash
# .env Configuration

# ============================================================================
# PRIMARY MODELS (All Different)
# ============================================================================

# P1: System/Code - Fast, cheap, industrial-grade
TRIPLE_AI_P1_PRIMARY=meta-llama/llama-3.1-8b-instruct:free

# P2: Process/Analytics - Powerful for analysis
TRIPLE_AI_P2_PRIMARY=meta-llama/llama-3.3-70b-instruct

# P3: Domain/Knowledge - High quality reasoning
TRIPLE_AI_P3_PRIMARY=openai/gpt-4o-mini

# ============================================================================
# BACKUP MODELS (All Different from Each Other)
# ============================================================================

# P1 Backup: Different cheap industrial model
TRIPLE_AI_P1_BACKUP=google/gemini-flash-1.5

# P2 Backup: Fast, quality alternative
TRIPLE_AI_P2_BACKUP=anthropic/claude-3-haiku

# P3 Backup: Cheaper GPT alternative
TRIPLE_AI_P3_BACKUP=openai/gpt-3.5-turbo

# ============================================================================
# API KEYS
# ============================================================================

OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
GITHUB_MODELS_TOKEN=github_pat_YOUR_TOKEN_HERE
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY_HERE  # For P3
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE  # For P2 backup
```

---

## 🚨 **What Likely Broke (Updated Analysis)**

### **#1: Model Names Changed (Most Likely - 60%)**

**The Issue:**
- `llama-3.3-70b-instruct` may have different path on OpenRouter
- Free tier models get renamed/moved frequently
- Provider availability changes

**Check Current Model Names:**

```bash
# Get list of available models
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  | grep -i "llama-3.3\|gemini\|gpt-4o"
```

**Common Issues:**
- `meta-llama/llama-3.3-70b-instruct` → Might be `meta-llama/llama-3.1-70b-instruct`
- Free tier removed from certain models
- Model moved to different provider

**Fix:**
Update .env with confirmed working model names from OpenRouter's current catalog.

---

### **#2: API Key Expired (35%)**

**The Issue:**
OpenRouter keys expire, especially free tier keys after 2 weeks of inactivity.

**Test:**
```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

**If 401 Unauthorized:** Key is dead

**Fix:**
1. Go to https://openrouter.ai/keys
2. Generate new API key
3. Update .env: `OPENROUTER_API_KEY=sk-or-v1-NEW_KEY`
4. Restart server

---

### **#3: Provider Routing Broken (3%)**

**The Issue:**
Your fallback chain (OpenRouter → GitHub → Backup) might be broken.

**Check:**
Are all provider API keys valid?

```bash
# Test OpenRouter
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Test GitHub Models  
curl https://models.inference.ai.azure.com/models \
  -H "Authorization: Bearer $GITHUB_MODELS_TOKEN"

# Test OpenAI (for P3)
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Fix:**
Get fresh keys for any that fail.

---

### **#4: Domain Entanglements Empty (2%)**

**The Issue:**
Knowledge Engine needs domain relationships to fuse answers.

**Check:**
```sql
SELECT COUNT(*) FROM domain_entanglements;
```

**If 0:** Knowledge Engine can't link domains

**Fix:**
You need to reinitialize domain entanglements (likely a migration script).

---

## 🧪 **Step-by-Step Diagnostic**

### **Step 1: Verify Environment Variables**

```bash
# Check your .env has all required models
cat .env | grep TRIPLE_AI

# Should show 6 lines (3 primaries + 3 backups)
# All should be DIFFERENT models
```

**Verify:**
- [ ] P1 Primary is NOT gpt-4o-mini (use cheap industrial model)
- [ ] P2 Primary is meta-llama/llama-3.3-70b-instruct
- [ ] P3 Primary is openai/gpt-4o-mini
- [ ] All 3 backups are different from primaries
- [ ] All 3 backups are different from each other

---

### **Step 2: Test Each Model Individually**

**Test P1 Model:**
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.1-8b-instruct:free",
    "messages": [{"role": "user", "content": "Test P1"}]
  }'
```

**Test P2 Model:**
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.3-70b-instruct",
    "messages": [{"role": "user", "content": "Test P2"}]
  }'
```

**Test P3 Model:**
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Test P3"}]
  }'
```

**Which ones fail?** That tells us which model is broken.

---

### **Step 3: Test Triple AI Endpoint**

```javascript
// Run in browser console
fetch('/api/triple-ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Explain quantum computing',
    mode: 'auto-advanced'
  })
})
.then(r => r.json())
.then(data => {
  console.log('RESPONSE:', data);
  
  if (data.error) {
    console.error('❌ ERROR:', data.error);
    console.error('Model used:', data.metrics?.hardwareModel);
    console.error('Domains:', data.metrics?.domainsUsed);
  } else {
    console.log('✅ SUCCESS');
    console.log('Hardware:', data.metrics?.hardwareModel);
    console.log('Software:', data.metrics?.softwareModel);
    console.log('Backup:', data.metrics?.backupModel);
    console.log('Domains:', data.metrics?.domainsUsed);
  }
})
```

**Share the output!** This tells us which model failed.

---

### **Step 4: Check Backend Logs**

```bash
# Start server with debug logging
LOG_LEVEL=debug npm run server
```

**Make a Triple AI request, then look for:**
- `[TRIPLE-AI]` logs - Shows which AI is selected
- `[KNOWLEDGE-ENGINE]` logs - Shows domain fusion
- API errors - Shows which provider failed
- Model selection logs - Shows which model was chosen

**Share any errors you see!**

---

## 🔧 **Immediate Fixes**

### **Fix 1: Update Model Configuration (3 minutes)**

**File:** `.env`

Replace with this corrected configuration:

```bash
# ============================================================================
# CORRECTED TRIPLE AI CONFIGURATION
# ============================================================================

# P1: System/Code AI - Cheap industrial (NOT gpt-4o-mini!)
TRIPLE_AI_P1_PRIMARY=meta-llama/llama-3.1-8b-instruct:free
TRIPLE_AI_P1_BACKUP=google/gemini-flash-1.5

# P2: Process/Analytics AI - Llama 70B
TRIPLE_AI_P2_PRIMARY=meta-llama/llama-3.3-70b-instruct
TRIPLE_AI_P2_BACKUP=anthropic/claude-3-haiku

# P3: Domain/Knowledge AI - GPT-4o Mini
TRIPLE_AI_P3_PRIMARY=openai/gpt-4o-mini
TRIPLE_AI_P3_BACKUP=openai/gpt-3.5-turbo

# API Keys
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY
OPENAI_API_KEY=sk-YOUR_KEY
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
```

**Restart server:**
```bash
npm run server
```

---

### **Fix 2: Handle Model Name Changes**

**If llama-3.3-70b doesn't exist:**

```bash
# Check available Llama models
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  | grep -i "llama.*70b"
```

**Update to available model:**
```bash
# If 3.3 doesn't exist, use 3.1:
TRIPLE_AI_P2_PRIMARY=meta-llama/llama-3.1-70b-instruct
```

---

### **Fix 3: Add Fallback Logic**

**If models fail, ensure your code has proper fallback:**

```typescript
// In triple-ai-handler.ts or similar
async function getAIResponse(query: string, primary: number) {
  const models = {
    1: {
      primary: process.env.TRIPLE_AI_P1_PRIMARY,
      backup: process.env.TRIPLE_AI_P1_BACKUP,
    },
    2: {
      primary: process.env.TRIPLE_AI_P2_PRIMARY,
      backup: process.env.TRIPLE_AI_P2_BACKUP,
    },
    3: {
      primary: process.env.TRIPLE_AI_P3_PRIMARY,
      backup: process.env.TRIPLE_AI_P3_BACKUP,
    },
  };

  try {
    // Try primary model
    return await callAI(models[primary].primary, query);
  } catch (error) {
    console.warn(`Primary P${primary} failed, trying backup`);
    // Fallback to backup
    return await callAI(models[primary].backup, query);
  }
}
```

---

## 📋 **Verification Checklist**

Configuration:
- [ ] P1 Primary: Cheap industrial model (llama-3.1-8b or gemini-flash)
- [ ] P1 Backup: Different model (NOT same as P1 primary)
- [ ] P2 Primary: meta-llama/llama-3.3-70b-instruct (or 3.1 if 3.3 unavailable)
- [ ] P2 Backup: Different model (NOT P1 backup, NOT P2 primary)
- [ ] P3 Primary: openai/gpt-4o-mini
- [ ] P3 Backup: Different model (NOT P1 backup, NOT P2 backup, NOT P3 primary)

API Keys:
- [ ] OPENROUTER_API_KEY is valid
- [ ] OPENAI_API_KEY is valid (for P3)
- [ ] ANTHROPIC_API_KEY is valid (if using Claude backup)
- [ ] All keys tested with curl

Database:
- [ ] domain_entanglements table has data
- [ ] unified_memory is recording interactions
- [ ] ai_interaction_weights exists

Testing:
- [ ] Each individual model tested and works
- [ ] Triple AI endpoint returns responses
- [ ] Knowledge Engine logs appear
- [ ] Metrics show correct models used

---

## 🎯 **What to Share With Me**

To get exact fix, please share:

1. **Your current .env Triple AI config:**
```bash
grep TRIPLE_AI .env
```

2. **Test results for each model:**
- Does P1 model work? (which model are you using?)
- Does P2 model work? (llama-3.3 or 3.1?)
- Does P3 model work? (gpt-4o-mini?)

3. **Error message from Triple AI:**
```javascript
// Run this, share output:
fetch('/api/triple-ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'test', mode: 'auto-advanced' })
}).then(r => r.json()).then(console.log)
```

4. **Backend logs** when making request

With this info, I'll give you the EXACT fix! 🎯
