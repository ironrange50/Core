# UNIFIED MAINTENANCE SYSTEM - SETUP GUIDE

## What This Fixes

**Before:**
- ❌ Multiple disconnected maintenance files
- ❌ No end-to-end flow
- ❌ Fake data in UI
- ❌ No learning integration
- ❌ Doesn't actually work

**After:**
- ✅ Single unified system
- ✅ Real health monitoring
- ✅ Actual maintenance operations
- ✅ Learns from every run
- ✅ Auto-heal based on thresholds
- ✅ **Actually works end-to-end**

---

## File Structure

```
server/
├── services/
│   └── unified-maintenance.ts          ← Single maintenance system
└── routes/
    └── maintenance-unified-routes.ts   ← API endpoints

src/
└── components/
    └── MaintenancePanel-Working.tsx    ← UI component
```

---

## Setup Steps

### Step 1: Copy Files (1 minute)

```bash
cp unified-maintenance.ts server/services/
cp maintenance-unified-routes.ts server/routes/
cp MaintenancePanel-Working.tsx src/components/
```

### Step 2: Initialize in Server (2 minutes)

In your main server file (`server/index.ts` or similar):

```typescript
import { initializeMaintenanceSystem } from './services/unified-maintenance';
import maintenanceRoutes from './routes/maintenance-unified-routes';
import { Pool } from 'pg';

// After creating your database pool:
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize maintenance system
const maintenanceSystem = initializeMaintenanceSystem(pool, {
  enabled: true,
  checkIntervalMs: 3600000, // Check every hour
  thresholds: {
    cpuPercent: 80,
    memoryPercent: 85,
    diskPercent: 85
  }
});

// Start auto-heal monitoring
maintenanceSystem.startAutoHeal();

// Register routes
app.use('/api/maintenance', maintenanceRoutes);
```

### Step 3: Use UI Component (30 seconds)

In your admin panel:

```typescript
import { MaintenancePanelWorking } from '../components/MaintenancePanel-Working';

// Add to your admin tabs:
<MaintenancePanelWorking />
```

---

## How It Works End-to-End

### Flow 1: Manual Maintenance

```
User opens Admin Panel
  ↓
MaintenancePanel loads
  ↓
GET /api/maintenance/status
  ↓
Shows:
  - System Health (CPU, Memory, Disk, Database)
  - Auto-Heal Status (running/stopped, next check time)
  - Recent Runs (last 10 maintenance runs)
  ↓
User clicks "Run Maintenance"
  ↓
POST /api/maintenance/trigger
  ↓
Maintenance runs:
  1. Clean temp logs → removes files
  2. Clean cache → removes files
  3. Clean old DB records → DELETE queries
  4. Garbage collection → frees memory
  5. Learn from run → stores in stack
  ↓
Health re-checked (before/after comparison)
  ↓
UI updates with results:
  - ✅ Completed
  - Duration: 2.3s
  - Results: 47 logs, 12 cache, 234 records, 23.4 MB freed
```

### Flow 2: Auto-Heal

```
Auto-Heal timer fires (every hour)
  ↓
Check system health
  ↓
Current state:
  - CPU: 45%
  - Memory: 88% ⚠️ (threshold: 85%)
  - Disk: 62%
  ↓
Memory threshold exceeded!
  ↓
Automatically trigger maintenance
  ↓
Runs all cleanup steps
  ↓
Health after:
  - CPU: 43%
  - Memory: 72% ✅
  - Disk: 60%
  ↓
Learn from auto-heal:
  - Stored in stack
  - Duration logged
  - Success tracked
  ↓
Next check scheduled (1 hour from now)
```

### Flow 3: Learning Integration

```
Every maintenance run stores:
  ↓
await systemAIStackBridge.learnFromAutoHeal({
  jobId: 'maint-1234567890',
  kind: 'maintenance',
  itemsProcessed: 293,  // total items cleaned
  duration: 2341,       // milliseconds
  success: true
})
  ↓
Stored in domain_entanglements table:
  - source_domain: 'auto-heal'
  - target_domain: 'system-maintenance'
  - tags: ['auto-heal:event', 'auto-heal:success:true']
  - metadata: { duration, itemsProcessed, ... }
  ↓
Later queries can analyze:
  - Average maintenance duration
  - Optimal run frequency
  - Success rates
  - Performance trends
```

---

## API Endpoints

### GET /api/maintenance/status
Get overall system status (health + auto-heal + recent runs).

**Response:**
```json
{
  "success": true,
  "health": {
    "timestamp": "2025-12-27T...",
    "cpu": { "usage": 45.3, "load1m": 1.23 },
    "memory": { "percentage": 72.4, "used": 11234567890 },
    "disk": { "percentage": 62.1 },
    "database": { "connections": 8, "size": 123456789 },
    "status": "healthy"
  },
  "autoHeal": {
    "enabled": true,
    "running": true,
    "lastCheck": "2025-12-27T10:00:00Z",
    "nextCheck": "2025-12-27T11:00:00Z"
  },
  "recentRuns": [...]
}
```

### POST /api/maintenance/trigger
Manually trigger maintenance run.

**Response:**
```json
{
  "success": true,
  "run": {
    "id": "maint-1234567890",
    "status": "completed",
    "duration": 2341,
    "actionsCompleted": 4,
    "actionsFailed": 0,
    "results": {
      "tempLogsRemoved": 47,
      "cacheFilesRemoved": 12,
      "dbRecordsRemoved": 234,
      "memoryFreed": 24567890
    }
  }
}
```

### GET /api/maintenance/runs
Get maintenance run history.

### GET /api/maintenance/health
Get current system health only.

### POST /api/maintenance/auto-heal/start
Start auto-heal monitoring.

### POST /api/maintenance/auto-heal/stop
Stop auto-heal monitoring.

### GET /api/maintenance/auto-heal/status
Get auto-heal status.

---

## What Gets Cleaned

### 1. Temp Logs
```
logs/tmp/*
logs/rotated/*
```

### 2. Cache Files
```
tmp/cache/*
```

### 3. Database Records
```sql
-- Old model metrics (60 days)
DELETE FROM model_metrics 
WHERE window_end < NOW() - INTERVAL '60 days'

-- Old curiosity tasks (30 days)
DELETE FROM curiosity_tasks 
WHERE status IN ('done', 'failed') 
AND updated_at < NOW() - INTERVAL '30 days'
```

### 4. Memory
```typescript
if (global.gc) {
  global.gc();  // Trigger V8 garbage collection
}
```

---

## Auto-Heal Thresholds

Default configuration:

```typescript
{
  enabled: true,
  checkIntervalMs: 3600000,  // Check every hour
  thresholds: {
    cpuPercent: 80,          // Auto-heal if CPU > 80%
    memoryPercent: 85,       // Auto-heal if Memory > 85%
    diskPercent: 85          // Auto-heal if Disk > 85%
  }
}
```

You can customize when initializing:

```typescript
initializeMaintenanceSystem(pool, {
  enabled: true,
  checkIntervalMs: 1800000,  // 30 minutes
  thresholds: {
    cpuPercent: 90,
    memoryPercent: 90,
    diskPercent: 90
  }
});
```

---

## UI Features

### Health Cards
- **CPU** - Usage % and load average
- **Memory** - Percentage and used/total bytes
- **Disk** - Percentage and used/total bytes
- **Database** - Active connections and size

### Status Indicator
- 🟢 **Healthy** - All metrics normal
- 🟡 **Warning** - Any metric > 75%
- 🔴 **Critical** - Any metric > 90%

### Action Buttons
- **Run Maintenance** - Manual trigger
- **Start/Stop Auto-Heal** - Toggle monitoring

### Run History
- Last 10 runs displayed
- Shows: type, status, duration, results
- Color-coded status badges
- Detailed results (files cleaned, memory freed)

### Auto-Refresh
- Updates every 5 seconds
- Shows live system health
- Shows current running maintenance

---

## Example Run Output

```
Maintenance Run: maint-1735300800123
Type: Manual
Triggered by: admin@example.com
Started: 2025-12-27 10:00:00

Actions:
✅ Clean Temp Logs - Removed 47 temporary log files
✅ Clean Cache - Removed 12 cache files  
✅ Clean Database - Removed 234 old database records
✅ Garbage Collection - Freed 23.41 MB

Health Before:
  CPU: 52.3%
  Memory: 88.7%  ⚠️
  Disk: 64.2%
  Status: Warning

Health After:
  CPU: 48.1%
  Memory: 71.4%  ✅
  Disk: 62.8%
  Status: Healthy

Duration: 2.34s
Status: ✅ Completed
```

---

## Learning Analytics

After running for a while, you can query learned patterns:

```typescript
// Get auto-heal efficiency
const efficiency = await systemAIStackBridge.getAutoHealStats();
console.log(efficiency);
// {
//   avgDuration: 2341,        // 2.3s average
//   avgItemsProcessed: 293,   // 293 items per run
//   successRate: 98.5         // 98.5% success rate
// }

// Get optimal schedule
const schedule = await systemAIStackBridge.getOptimalSchedule();
console.log(schedule);
// {
//   intervalMinutes: 60,
//   reason: "Fast execution and high success rate"
// }
```

---

## Troubleshooting

### Maintenance doesn't run
1. Check if system is initialized: `maintenanceSystem.getStatus()`
2. Verify pool is connected: `await pool.query('SELECT 1')`
3. Check server logs for errors

### Auto-heal not triggering
1. Verify it's enabled: `GET /api/maintenance/auto-heal/status`
2. Check thresholds - system may not exceed them
3. Look at `lastCheck` time - may not be time yet

### UI shows no data
1. Check API endpoints are registered
2. Verify routes match (`/api/maintenance/*`)
3. Check browser console for fetch errors

### Learning not working
1. Verify `system-ai-stack-bridge.ts` is integrated
2. Check `domain_entanglements` table exists
3. Ensure pool is passed to bridge initialization

---

## Complete Working Example

```typescript
// server/index.ts
import express from 'express';
import { Pool } from 'pg';
import { initializeMaintenanceSystem } from './services/unified-maintenance';
import { systemAIStackBridge } from './integrations/system-ai-stack-bridge';
import maintenanceRoutes from './routes/maintenance-unified-routes';

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize stack learning
systemAIStackBridge.initialize(pool);

// Initialize maintenance system
const maintenanceSystem = initializeMaintenanceSystem(pool);
maintenanceSystem.startAutoHeal();

// Register routes
app.use('/api/maintenance', maintenanceRoutes);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] Shutting down...');
  maintenanceSystem.stopAutoHeal();
  await pool.end();
  process.exit(0);
});

app.listen(3001, () => {
  console.log('[Server] Listening on port 3001');
  console.log('[Maintenance] Auto-heal started');
});
```

---

## Summary

**What you get:**
1. ✅ Real system health monitoring
2. ✅ Actual file cleanup operations
3. ✅ Database record cleanup
4. ✅ Memory garbage collection
5. ✅ Auto-heal when thresholds exceeded
6. ✅ Learning from every run
7. ✅ Complete UI with live updates
8. ✅ **Everything works end-to-end!**

Just copy 3 files, initialize in server, and it works.
