# Triple AI Architecture - Quick Reference Card

## 🎯 **The Correct Setup (IraCore Industrial)**

```
                    ┌─────────────────────────┐
                    │     USER QUERY          │
                    └───────────┬─────────────┘
                                ↓
                    ┌───────────────────────┐
                    │  30 Iracore Domains   │
                    │   Route by Intent     │
                    └───────────┬───────────┘
                                ↓
        ┌───────────────────────┼───────────────────────┐
        ↓                       ↓                       ↓
┌───────────────┐      ┌────────────────┐      ┌───────────────┐
│  PRIMARY 1    │      │   PRIMARY 2    │      │  PRIMARY 3    │
│  System/Code  │      │ Process/Analyt │      │ Domain/Knowl  │
├───────────────┤      ├────────────────┤      ├───────────────┤
│   Cheap AI    │      │  Llama 3.3-70B │      │ GPT-4o-mini   │
│  Industrial   │      │                │      │               │
│               │      │                │      │               │
│ llama-3.1-8b  │      │meta-llama/     │      │ openai/       │
│   :free       │      │llama-3.3-70b   │      │ gpt-4o-mini   │
├───────────────┤      ├────────────────┤      ├───────────────┤
│   BACKUP:     │      │   BACKUP:      │      │   BACKUP:     │
│ gemini-flash  │      │ claude-haiku   │      │ gpt-3.5-turbo │
└───────────────┘      └────────────────┘      └───────────────┘
        ↓                       ↓                       ↓
        └───────────────────────┼───────────────────────┘
                                ↓
                    ┌───────────────────────┐
                    │  KNOWLEDGE ENGINE     │
                    │  5 Domain Fusion      │
                    │  Entanglement Links   │
                    └───────────┬───────────┘
                                ↓
                    ┌───────────────────────┐
                    │   FINAL RESPONSE      │
                    └───────────────────────┘
```

---

## ✅ **Configuration Rules**

### **CRITICAL:**
- ❌ P1 is **NOT** gpt-4o-mini (that's P3!)
- ✅ P1 is a **cheap industrial model** (llama-8b, gemini-flash, mistral-7b)
- ✅ P2 is **meta-llama 70B** (3.3 or 3.1)
- ✅ P3 is **gpt-4o-mini**
- ✅ All 3 primaries are **DIFFERENT**
- ✅ All 3 backups are **DIFFERENT from each other**

---

## 📋 **Quick Checklist**

```
Primary Models:
├─ P1: [ ] Cheap industrial (NOT gpt-4o-mini)
├─ P2: [ ] meta-llama/llama-3.3-70b-instruct
└─ P3: [ ] openai/gpt-4o-mini

Backup Models:
├─ P1 Backup: [ ] Different from P1 primary
├─ P2 Backup: [ ] Different from P1 backup & P2 primary
└─ P3 Backup: [ ] Different from P1, P2 backups & P3 primary

No Duplicates:
├─ [ ] No model appears twice in primaries
├─ [ ] No model appears twice in backups
└─ [ ] No overlap between primaries and backups (optional)
```

---

## 🔧 **Recommended .env**

```bash
# P1: System/Code (Cheap Industrial)
TRIPLE_AI_P1_PRIMARY=meta-llama/llama-3.1-8b-instruct:free
TRIPLE_AI_P1_BACKUP=google/gemini-flash-1.5

# P2: Process/Analytics (Llama 70B)
TRIPLE_AI_P2_PRIMARY=meta-llama/llama-3.3-70b-instruct
TRIPLE_AI_P2_BACKUP=anthropic/claude-3-haiku

# P3: Domain/Knowledge (GPT-4o-mini)
TRIPLE_AI_P3_PRIMARY=openai/gpt-4o-mini
TRIPLE_AI_P3_BACKUP=openai/gpt-3.5-turbo

# API Keys
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 🧪 **Quick Test**

```bash
# Test configuration is loaded
grep TRIPLE_AI .env

# Test Triple AI works
curl http://localhost:3001/api/triple-ai \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "mode": "auto-advanced"}'

# Should return:
# {
#   "ok": true,
#   "answer": "...",
#   "metrics": {
#     "hardwareModel": "meta-llama/llama-3.1-8b-instruct:free",
#     "softwareModel": "meta-llama/llama-3.3-70b-instruct",
#     "backupModel": "openai/gpt-4o-mini",
#     "domainsUsed": ["domain1", "domain2"],
#     "coherenceScore": 0.85
#   }
# }
```

---

## 🚨 **Common Mistakes**

### ❌ **WRONG:**
```bash
# P1 using gpt-4o-mini (that's P3's job!)
TRIPLE_AI_P1_PRIMARY=openai/gpt-4o-mini  # ❌

# P2 using gpt-4o-mini (should be llama 70B)
TRIPLE_AI_P2_PRIMARY=openai/gpt-4o-mini  # ❌

# Using same model for multiple primaries
TRIPLE_AI_P1_PRIMARY=openai/gpt-4o-mini
TRIPLE_AI_P3_PRIMARY=openai/gpt-4o-mini  # ❌ Duplicate!

# Using same backup for multiple AIs
TRIPLE_AI_P1_BACKUP=google/gemini-flash-1.5
TRIPLE_AI_P2_BACKUP=google/gemini-flash-1.5  # ❌ Duplicate!
```

### ✅ **CORRECT:**
```bash
# P1: Cheap industrial
TRIPLE_AI_P1_PRIMARY=meta-llama/llama-3.1-8b-instruct:free  # ✅

# P2: Llama 70B
TRIPLE_AI_P2_PRIMARY=meta-llama/llama-3.3-70b-instruct  # ✅

# P3: GPT-4o-mini
TRIPLE_AI_P3_PRIMARY=openai/gpt-4o-mini  # ✅

# All different backups
TRIPLE_AI_P1_BACKUP=google/gemini-flash-1.5  # ✅
TRIPLE_AI_P2_BACKUP=anthropic/claude-3-haiku  # ✅ Different
TRIPLE_AI_P3_BACKUP=openai/gpt-3.5-turbo  # ✅ Different
```

---

## 🎯 **Model Selection Guide**

### **P1 Options (Cheap Industrial):**
- `meta-llama/llama-3.1-8b-instruct:free` ⭐ **Recommended**
- `google/gemini-flash-1.5`
- `mistralai/mistral-7b-instruct:free`
- `microsoft/phi-3-medium-128k-instruct:free`

### **P2 Options (Process/Analytics):**
- `meta-llama/llama-3.3-70b-instruct` ⭐ **Recommended**
- `meta-llama/llama-3.1-70b-instruct` (if 3.3 unavailable)
- `mistralai/mixtral-8x22b-instruct`

### **P3 Options (Domain/Knowledge):**
- `openai/gpt-4o-mini` ⭐ **Recommended**
- `openai/gpt-4o` (higher quality, more expensive)

### **Backup Options (All Different):**
- `google/gemini-flash-1.5`
- `google/gemini-pro-1.5`
- `anthropic/claude-3-haiku`
- `anthropic/claude-3-sonnet`
- `openai/gpt-3.5-turbo`
- `openai/gpt-4o-mini`
- `mistralai/mixtral-8x7b-instruct`
- `cohere/command`

---

## 📊 **Performance Comparison**

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| llama-3.1-8b | ⚡⚡⚡ | ⭐⭐⭐ | FREE | P1 (Code/System) |
| llama-3.3-70b | ⚡⚡ | ⭐⭐⭐⭐⭐ | $$ | P2 (Analytics) |
| gpt-4o-mini | ⚡⚡⚡ | ⭐⭐⭐⭐ | $ | P3 (Knowledge) |
| gemini-flash | ⚡⚡⚡ | ⭐⭐⭐⭐ | FREE | Backup |
| claude-haiku | ⚡⚡⚡ | ⭐⭐⭐⭐ | $ | Backup |

---

## 🔍 **Troubleshooting**

**If Triple AI not working:**

1. **Check model names:**
   ```bash
   curl https://openrouter.ai/api/v1/models \
     -H "Authorization: Bearer $OPENROUTER_API_KEY" \
     | grep -i "llama-3.3"
   ```

2. **Check API keys:**
   ```bash
   curl https://openrouter.ai/api/v1/models \
     -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```
   If 401 → Key expired

3. **Check .env loaded:**
   ```bash
   echo $TRIPLE_AI_P2_PRIMARY
   ```
   Should show model name

4. **Check backend logs:**
   ```bash
   LOG_LEVEL=debug npm run server
   ```
   Look for `[TRIPLE-AI]` errors

---

## 💡 **Remember**

- **P1** = Cheap & Fast (Industrial workhorse)
- **P2** = Powerful (Heavy analytics)
- **P3** = Smart (Knowledge & reasoning)

All different models, all different backups. No duplicates! 🎯
