# COMPLETE WORKING EXAMPLE

This shows exactly how the integration works in practice.

## Scenario: System AI Proposes a Dashboard Change

### 1. User Makes Request in UI
```
User: "Optimize the dashboard to load faster"
```

### 2. System AI Proposes Changes
```typescript
// In system-ai-handler.ts - proposeSystemAiChanges()
const patches = [
  {
    id: 'patch_1234',
    filePath: 'src/components/Dashboard.tsx',
    oldCode: '// old slow code',
    newCode: '// new fast code',
    summary: 'Optimized rendering'
  }
];

// Proposal stored in database automatically (if you added the learning call)
```

### 3. User Approves in SystemsAIPanel

User clicks "Approve" → calls `approveSystemAiPatch()`

```typescript
// In system-ai-handler.ts
export async function approveSystemAiPatch(patch, opts) {
  // Apply the patch
  await applyPatchToRepo({
    filePath: 'src/components/Dashboard.tsx',
    oldCode: patch.oldCode,
    newCode: patch.newCode,
  });

  // Run tests
  const tests = await runProjectTests();
  // tests.exitCode = 0 (success!)

  // ⭐ LEARNING HAPPENS HERE:
  await systemAIStackBridge.learnFromProposal({
    proposalId: 'patch_1234',
    command: 'Optimize the dashboard to load faster',
    filesAffected: ['src/components/Dashboard.tsx'],
    approved: true,
    testsPassed: true,  // ✅ Tests passed!
    testExitCode: 0
  });

  // This gets stored in domain_entanglements:
  // source_domain: 'system-ai'
  // target_domain: 'code-changes'
  // strength: 1.0 (because approved and tests passed)
  // tags: [
  //   'system-ai:proposal',
  //   'system-ai:approved:true',
  //   'system-ai:tests:pass',
  //   'system-ai:file:src/components/Dashboard.tsx'
  // ]
}
```

### 4. Next Time: AI Learns

Later, another user asks to modify Dashboard.tsx:

```typescript
// Before approving, check historical data:
const recommendation = await systemAIStackBridge.shouldApproveFile(
  'src/components/Dashboard.tsx'
);

console.log(recommendation);
// {
//   recommend: true,
//   confidence: 1.0,
//   reason: "File has 100% success rate in 1 past changes - looks safe"
// }
```

### 5. Auto-Heal Learning Example

```typescript
// Auto-heal runs every hour
await autoHealFastPath();

// Inside autoHealFastPath:
const startTime = Date.now();
const report = await runCleanSweep();
// report = { itemsRemoved: 147, spaceFreed: '2.3MB' }

const duration = Date.now() - startTime;
// duration = 342ms

// ⭐ LEARNING:
await systemAIStackBridge.learnFromAutoHeal({
  jobId: 'heal-1234567890',
  kind: 'clean_sweep',
  itemsProcessed: 147,
  duration: 342,
  success: true
});

// After multiple runs, query efficiency:
const efficiency = await systemAIStackBridge.getAutoHealStats();
console.log(efficiency);
// {
//   avgDuration: 356,          // Average 356ms
//   avgItemsProcessed: 132,    // Average 132 items
//   successRate: 98.5          // 98.5% success rate
// }

// Get smart recommendation:
const schedule = await systemAIStackBridge.getOptimalSchedule();
console.log(schedule);
// {
//   intervalMinutes: 30,
//   reason: "Fast execution (<1s) and high success rate (>95%) - safe to run frequently"
// }
```

### 6. Curiosity Task Learning Example

```typescript
// Curiosity engine runs a probe task
const task = {
  id: 'task_9876',
  kind: 'probe',
  payload: { sourceModel: 'claude-sonnet-4', testCount: 5 }
};

const startTime = Date.now();
const result = await runLatencyProbe(task.payload);
const duration = Date.now() - startTime;

// ⭐ LEARNING:
await systemAIStackBridge.learnFromCuriosityTask({
  taskId: 'task_9876',
  kind: 'probe',
  result: 'Latency probe completed for claude-sonnet-4',
  duration: 234,
  valueScore: 0.7  // Probes are valuable
});

// Later, check which task types are most valuable:
const probeValue = await systemAIStackBridge.getCuriosityValue('probe');
const auditValue = await systemAIStackBridge.getCuriosityValue('data_audit');

console.log({ probeValue, auditValue });
// { probeValue: 0.7, auditValue: 0.4 }
// → Prioritize probe tasks over data audits
```

## Real Database Queries

Here's what actually happens in the database:

### Query 1: Store Learning
```sql
INSERT INTO domain_entanglements 
  (source_domain, target_domain, strength, metadata, tags, created_at)
VALUES 
  ('system-ai', 'code-changes', 1.0, 
   '{"proposalId":"patch_1234","command":"Optimize dashboard",...}',
   ARRAY['system-ai:proposal','system-ai:approved:true','system-ai:tests:pass','system-ai:file:src/components/Dashboard.tsx'],
   NOW());
```

### Query 2: Get Success Rate
```sql
SELECT 
  COUNT(*) FILTER (WHERE 'system-ai:tests:pass' = ANY(tags)) as passed,
  COUNT(*) as total
FROM domain_entanglements
WHERE source_domain = 'system-ai'
  AND 'system-ai:approved:true' = ANY(tags)
  AND created_at > NOW() - INTERVAL '30 days';
```

### Query 3: Find Risky Files
```sql
SELECT 
  UNNEST(tags) as tag,
  COUNT(*) FILTER (WHERE 'system-ai:tests:fail' = ANY(tags)) * 100.0 / COUNT(*) as fail_rate
FROM domain_entanglements
WHERE source_domain = 'system-ai'
  AND created_at > NOW() - INTERVAL '90 days'
GROUP BY tag
HAVING 
  tag LIKE 'system-ai:file:%'
  AND COUNT(*) >= 3
  AND fail_rate > 50
ORDER BY fail_rate DESC;
```

## API Response Examples

### GET /api/system-ai/learning/analytics

```json
{
  "ok": true,
  "analytics": {
    "systemAI": {
      "successRate": 87.5,
      "riskyFiles": [
        "src/components/ComplexForm.tsx",
        "server/ai/brain-ai-provider.ts"
      ]
    },
    "autoHeal": {
      "avgDuration": 342,
      "avgItemsProcessed": 147,
      "successRate": 98.5
    },
    "recommendedSchedule": {
      "intervalMinutes": 30,
      "reason": "Fast execution (<1s) and high success rate (>95%) - safe to run frequently"
    }
  }
}
```

### GET /api/system-ai/learning/file-risk/src%2Fcomponents%2FDashboard.tsx

```json
{
  "ok": true,
  "recommendation": {
    "recommend": true,
    "confidence": 1.0,
    "reason": "File has 100% success rate in 3 past changes - looks safe"
  }
}
```

## Timeline View

```
T=0: User requests "optimize dashboard"
  → System AI creates proposal
  → Stored in database (not learned yet - no outcome)

T=1: User approves proposal
  → Code applied
  → Tests run → PASS ✅
  → systemAIStackBridge.learnFromProposal() called
  → Learned: Dashboard.tsx = safe file (100% success)

T=60: Auto-heal runs
  → Cleans up 147 items in 342ms
  → systemAIStackBridge.learnFromAutoHeal() called
  → Learned: clean_sweep is fast and successful

T=120: Curiosity task runs
  → Probe completes in 234ms
  → systemAIStackBridge.learnFromCuriosityTask() called
  → Learned: probe tasks have 0.7 value

T=180: Another user wants to modify Dashboard.tsx
  → shouldApproveFile('Dashboard.tsx') called
  → Returns: { recommend: true, confidence: 1.0 }
  → UI shows: "✅ This file has 100% success rate"

T=240: Dashboard loaded in SystemsAIPanel
  → GET /api/system-ai/learning/analytics
  → Shows:
    - System AI: 87.5% success rate
    - Auto-heal: 342ms avg, 98.5% success
    - Recommended schedule: Run every 30 minutes
```

## What Gets Learned

1. **System AI Proposals**
   - Which files are safe vs risky
   - Which types of commands succeed
   - Test pass/fail patterns
   - Success rate trends

2. **Auto-Heal Operations**
   - Average execution time
   - Items processed per run
   - Success/failure patterns
   - Optimal run frequency

3. **Curiosity Tasks**
   - Which task types are valuable
   - Execution time patterns
   - Task effectiveness scores
   - Priority recommendations

## Benefits in Action

1. **Smart Approvals**: "Dashboard.tsx has 100% success rate - safe to approve"
2. **Risk Warnings**: "ComplexForm.tsx has 30% success rate - review carefully"
3. **Efficient Scheduling**: "Auto-heal is fast (342ms avg) - can run every 30 min"
4. **Task Prioritization**: "Probe tasks (0.7 value) > Data audits (0.4 value)"
5. **Performance Tracking**: "Success rate improved from 75% → 87.5% over 30 days"
