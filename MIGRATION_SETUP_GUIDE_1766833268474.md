# COMPLETE MIGRATION SYSTEM - SETUP GUIDE

## What You're Installing

A **complete migration system** that:
1. ✅ **Installs all prerequisites** (Node.js, PostgreSQL, Redis, Git, build tools)
2. ✅ **Verifies installation** and alerts when ready
3. ✅ **Migrates all data** with progress tracking
4. ✅ **Performs cutover** to switch to new server

---

## File Structure

```
server/
├── services/
│   ├── migration-installer.ts          ← Installs prerequisites
│   └── migration-orchestrator.ts       ← Coordinates workflow
├── routes/
│   └── migration-enhanced-routes.ts    ← API endpoints
└── migrations/
    ├── 002_core_system_tables.sql
    ├── 003_file_processing_tables.sql
    ├── 004_device_settings_tables.sql
    ├── 0020_neurocore_p3_schema.sql
    └── 0021_engine_schedules.sql

src/
└── components/
    └── MigrationWizard-Enhanced.tsx     ← UI component
```

---

## Installation Steps

### Step 1: Copy Files to Your Project

```bash
# Create directories if they don't exist
mkdir -p server/services
mkdir -p server/routes
mkdir -p server/migrations
mkdir -p src/components

# Copy the files
cp migration-installer.ts server/services/
cp migration-orchestrator.ts server/services/
cp migration-enhanced-routes.ts server/routes/
cp MigrationWizard-Enhanced.tsx src/components/

# Copy SQL migrations (you already have these)
# 002_core_system_tables.sql
# 003_file_processing_tables.sql
# 004_device_settings_tables.sql
# 0020_neurocore_p3_schema.sql
# 0021_engine_schedules.sql
```

### Step 2: Install NPM Dependencies

```bash
npm install archiver
```

### Step 3: Register the Route in Your Server

In your main server file (e.g., `server/index.ts` or `server/server.ts`):

```typescript
import migrationRoutes from './routes/migration-enhanced-routes';

// Attach database pool to request (middleware)
app.use((req, res, next) => {
  (req as any).dbPool = pool; // Your existing pool
  next();
});

// Register migration routes
app.use('/api/migration', migrationRoutes);
```

### Step 4: Add the UI Component

In your admin panel or wherever you want the migration wizard:

```typescript
// In your AdminPage.tsx or similar
import { MigrationWizard } from '../components/MigrationWizard-Enhanced';

// Add to your tabs or navigation
<MigrationWizard userId={user.id} />
```

### Step 5: Create Migrations Directory

Make sure your SQL migrations are in the right place:

```bash
mkdir -p server/migrations
# Copy all .sql files there
```

---

## How It Works - Complete Workflow

### Phase 1: Check Installation (User clicks "Check Server")

```
User → [Check Server Button]
  ↓
Server → checkInstallationStatus()
  ↓
Returns:
{
  ready: false,
  missing: ["Node.js 20+", "PostgreSQL 16+", "Redis"],
  requirements: { ... }
}
  ↓
UI shows: "Missing: Node.js 20+, PostgreSQL 16+, Redis"
UI shows: [Install Prerequisites Button]
```

### Phase 2: Install Prerequisites (User clicks "Install Prerequisites")

```
User → [Install Prerequisites Button]
  ↓
Server → installMissingComponents()
  ↓
  Downloads and installs:
  1. Node.js 20 LTS
  2. PostgreSQL 16
  3. Redis
  4. Git
  5. C++ Build Tools
  ↓
  Each step updates progress:
  {
    step: "nodejs",
    status: "running",
    message: "Installing Node.js 20 LTS..."
  }
  ↓
UI shows live progress for each component
  ↓
When all complete:
  ↓
Server → setupDatabase()
  - Creates database
  - Creates user
  - Returns connection string
  ↓
UI shows: "✅ Target Server Ready"
UI shows: [Start Migration Button]
```

### Phase 3: Migrate Data (User clicks "Start Migration")

```
User confirms → [Start Migration Button]
  ↓
Server → migrate()
  ↓
  1. Run database migrations (.sql files)
  2. Migrate tables:
     - users
     - conversations
     - messages
     - unified_memory
     - domain_entanglements
     - ... (all tables)
  ↓
  For each table:
  - Count total records
  - Migrate in batches of 1000
  - Update progress:
    {
      table: "conversations",
      totalRecords: 5000,
      migratedRecords: 2000,
      status: "running"
    }
  ↓
UI shows progress bars for each table
  ↓
When all complete:
  ↓
UI shows: "Ready for Cutover"
UI shows: [Perform Cutover Button]
```

### Phase 4: Cutover (User clicks "Perform Cutover")

```
User confirms → [Perform Cutover Button]
  ↓
Server → cutover()
  1. Suspend old server (insert into suspend_state)
  2. Mark new server as primary
  3. Log audit event
  ↓
UI shows: "✅ Migration Complete!"
UI shows: [Refresh Application Button]
```

---

## API Endpoints

### GET `/api/migration/check-installation`
Check if target server has prerequisites.

**Response:**
```json
{
  "success": true,
  "ready": false,
  "requirements": {
    "nodejs": { "installed": false, "version": "" },
    "postgresql": { "installed": false, "running": false },
    "redis": { "installed": false, "running": false }
  },
  "missing": ["Node.js 20+", "PostgreSQL 16+", "Redis"]
}
```

### POST `/api/migration/install-prerequisites`
Start installing missing components.

**Body:**
```json
{
  "sessionId": "session-123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Installation started. Poll /migration/status for progress."
}
```

### GET `/api/migration/status/:sessionId`
Get current status of installation/migration.

**Response:**
```json
{
  "success": true,
  "state": {
    "phase": "installing",
    "currentStep": "Installing PostgreSQL...",
    "installationReady": false,
    "installationProgress": [
      {
        "step": "nodejs",
        "status": "completed",
        "message": "Node.js installed successfully"
      },
      {
        "step": "postgresql",
        "status": "running",
        "message": "Installing PostgreSQL 16..."
      }
    ],
    "migrationProgress": {},
    "errors": [],
    "warnings": []
  }
}
```

### POST `/api/migration/start`
Start the migration process.

**Body:**
```json
{
  "sessionId": "session-123",
  "userId": "user-456"
}
```

### POST `/api/migration/cutover`
Perform cutover to new server.

**Body:**
```json
{
  "sessionId": "session-123",
  "userId": "user-456"
}
```

---

## Testing the System

### Test on Windows

```bash
# 1. Start with clean system (no Node/Postgres/Redis)
# 2. Run the migration wizard
# 3. Click "Check Server" → Should show missing components
# 4. Click "Install Prerequisites" → Watch installations happen
# 5. Wait for "Target Server Ready"
# 6. Click "Start Migration" → Watch data migrate
# 7. Click "Perform Cutover" → Complete!
```

### Test on Linux

```bash
# Same steps as Windows, but installations use apt-get
sudo systemctl status postgresql  # Check if running
sudo systemctl status redis       # Check if running
```

---

## Platform-Specific Notes

### Windows
- Uses PowerShell to download installers
- Installs: `.msi` for Node.js, `.exe` for PostgreSQL, Git, Redis
- Services start automatically

### Linux (Ubuntu/Debian)
- Uses `apt-get` package manager
- Adds NodeSource repository for Node.js 20
- Adds PostgreSQL apt repository
- Uses `systemctl` to start services

### macOS
- Uses Homebrew
- `brew install node@20 postgresql@16 redis git`
- Services controlled via `brew services`

---

## What Gets Installed

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 LTS | Run NeuroCore application |
| PostgreSQL | 16+ | Database server |
| Redis | Latest | Job queue and caching |
| Git | Latest | Version control |
| Build Tools | Latest | Compile native modules |

**Directories Created:**
- `/opt/neurocore` - Application code
- `/opt/neurocore/uploads` - User uploads
- `/opt/neurocore/logs` - Log files
- `/opt/neurocore/backups` - Backups

---

## Troubleshooting

### Installation Fails

**Error:** "Failed to install Node.js"
**Fix:** Check internet connection, try manual installation

**Error:** "PostgreSQL service not starting"
**Fix:** Check ports (5432), ensure no conflicts

### Migration Fails

**Error:** "Failed to migrate table X"
**Fix:** Check table exists in source, check target database permissions

### Cutover Fails

**Error:** "Cannot suspend old server"
**Fix:** Ensure `suspend_state` table exists, check database connection

---

## Security Notes

1. **Database Password:** System generates 24-character secure password
2. **Connection String:** Stored only in memory during migration
3. **Old Server:** Suspended (not deleted) so you can roll back if needed
4. **Permissions:** All created directories have 755 permissions

---

## Complete Example Run

```
[User opens Migration Wizard]

Step 1: CHECK
User clicks "Check Server"
→ System checks for Node.js, PostgreSQL, Redis, etc.
→ Shows: "Missing: Node.js 20+, PostgreSQL 16+, Redis"

Step 2: INSTALL
User clicks "Install Prerequisites"
→ Installing Node.js 20 LTS... ✓
→ Installing PostgreSQL 16... ✓
→ Starting PostgreSQL service... ✓
→ Installing Redis... ✓
→ Starting Redis service... ✓
→ Installing Git... ✓
→ Installing C++ Build Tools... ✓
→ Setting up database... ✓
→ Shows: "✅ Target Server Ready"

Step 3: MIGRATE
User clicks "Start Migration"
→ Running database migrations... ✓
→ Migrating users (1,234 records)... ✓
→ Migrating conversations (5,678 records)... ✓
→ Migrating messages (12,345 records)... ✓
→ Migrating unified_memory (8,901 records)... ✓
→ [... all tables ...]
→ Verifying migration... ✓
→ Shows: "Ready for Cutover"

Step 4: CUTOVER
User clicks "Perform Cutover"
→ Confirm dialog: "This will switch servers. Continue?"
→ User clicks "OK"
→ Suspending old server... ✓
→ Activating new server... ✓
→ Shows: "✅ Migration Complete!"

Step 5: DONE
User clicks "Refresh Application"
→ Application reloads
→ Now connected to new server
→ All data available
→ Old server suspended (can roll back if needed)
```

---

## What's Different from Original

**Original System:**
- ❌ Assumed prerequisites were installed
- ❌ No verification step
- ❌ No progress tracking
- ❌ Manual installation required

**New System:**
- ✅ **Installs everything automatically**
- ✅ **Verifies before starting**
- ✅ **Shows live progress**
- ✅ **Alerts when ready**
- ✅ **Complete automation**

---

## Support

If something doesn't work:
1. Check the console for errors
2. Look at installation progress logs
3. Verify internet connection (for downloads)
4. Check available disk space
5. Ensure admin/sudo privileges

The system logs everything to console, so you can see exactly where it fails.
