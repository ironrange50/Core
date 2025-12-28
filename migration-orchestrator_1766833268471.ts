/**
 * MIGRATION WORKFLOW ORCHESTRATOR
 * server/services/migration-orchestrator.ts
 * 
 * Coordinates the complete migration: install → verify → migrate → cutover
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { 
  checkInstallationStatus, 
  installMissingComponents, 
  setupDatabase,
  InstallationProgress 
} from './migration-installer';

export interface MigrationState {
  phase: 'idle' | 'installing' | 'verifying' | 'migrating' | 'completing' | 'done' | 'failed';
  installationProgress: InstallationProgress[];
  installationReady: boolean;
  migrationProgress: {
    [table: string]: {
      status: 'pending' | 'running' | 'completed' | 'failed';
      totalRecords: number;
      migratedRecords: number;
    };
  };
  errors: string[];
  warnings: string[];
  currentStep: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class MigrationOrchestrator {
  private state: MigrationState;
  private sourcePool: Pool;
  private targetConnectionString: string = '';
  private targetPool?: Pool;

  constructor(sourcePool: Pool) {
    this.sourcePool = sourcePool;
    this.state = {
      phase: 'idle',
      installationProgress: [],
      installationReady: false,
      migrationProgress: {},
      errors: [],
      warnings: [],
      currentStep: 'Not started'
    };
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  public getState(): MigrationState {
    return { ...this.state };
  }

  /**
   * Phase 1: Install prerequisites on target server
   */
  public async install(): Promise<{ success: boolean; message: string }> {
    this.state.phase = 'installing';
    this.state.startedAt = new Date();
    this.state.currentStep = 'Installing prerequisites...';
    this.state.installationProgress = [];

    try {
      // Install missing components
      const result = await installMissingComponents((progress) => {
        this.state.installationProgress.push(progress);
        this.state.currentStep = progress.message;
      });

      if (!result.success) {
        this.state.errors.push(...result.errors);
        this.state.phase = 'failed';
        return { success: false, message: 'Installation failed: ' + result.errors.join(', ') };
      }

      // Verify installation
      this.state.phase = 'verifying';
      this.state.currentStep = 'Verifying installation...';
      
      const status = await checkInstallationStatus();
      
      if (!status.ready) {
        this.state.warnings.push(`Missing: ${status.missing.join(', ')}`);
        this.state.installationReady = false;
        this.state.phase = 'failed';
        return { 
          success: false, 
          message: `Installation incomplete. Missing: ${status.missing.join(', ')}` 
        };
      }

      // Setup database
      this.state.currentStep = 'Setting up database...';
      const dbSetup = await setupDatabase();
      
      if (!dbSetup.success) {
        this.state.errors.push(dbSetup.error || 'Database setup failed');
        this.state.phase = 'failed';
        return { success: false, message: 'Database setup failed' };
      }

      this.targetConnectionString = dbSetup.connectionString;
      this.state.installationReady = true;
      this.state.phase = 'idle';
      this.state.currentStep = 'Installation complete - ready for migration';

      return { 
        success: true, 
        message: 'Target server is ready for migration. Please confirm to proceed.' 
      };

    } catch (err: any) {
      this.state.errors.push(err.message);
      this.state.phase = 'failed';
      return { success: false, message: err.message };
    }
  }

  /**
   * Phase 2: Migrate data (after user confirmation)
   */
  public async migrate(): Promise<{ success: boolean; message: string }> {
    if (!this.state.installationReady) {
      return { success: false, message: 'Installation not complete. Run install() first.' };
    }

    this.state.phase = 'migrating';
    this.state.currentStep = 'Starting migration...';

    try {
      // Connect to target database
      this.targetPool = new Pool({ connectionString: this.targetConnectionString });

      // Run database migrations
      await this.runDatabaseMigrations();

      // Migrate data tables
      await this.migrateData();

      // Verify migration
      await this.verifyMigration();

      this.state.phase = 'completing';
      this.state.currentStep = 'Migration complete';

      return { success: true, message: 'Migration completed successfully' };

    } catch (err: any) {
      this.state.errors.push(err.message);
      this.state.phase = 'failed';
      return { success: false, message: err.message };
    }
  }

  /**
   * Phase 3: Cutover (switch to new server)
   */
  public async cutover(): Promise<{ success: boolean; message: string }> {
    if (this.state.phase !== 'completing') {
      return { success: false, message: 'Migration not complete. Cannot cutover.' };
    }

    this.state.currentStep = 'Performing cutover...';

    try {
      // Create suspend state on old server
      await this.sourcePool.query(`
        INSERT INTO suspend_state (id, active, reason, started_at, started_by)
        VALUES (gen_random_uuid(), true, 'Migrated to new server', NOW(), 'system')
      `);

      this.state.phase = 'done';
      this.state.completedAt = new Date();
      this.state.currentStep = 'Cutover complete - old server suspended';

      return { 
        success: true, 
        message: 'Cutover complete. You can now access the new server.' 
      };

    } catch (err: any) {
      this.state.errors.push(err.message);
      return { success: false, message: err.message };
    }
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private async runDatabaseMigrations(): Promise<void> {
    this.state.currentStep = 'Running database migrations...';

    if (!this.targetPool) throw new Error('Target pool not initialized');

    // Enable extensions
    await this.targetPool.query('CREATE EXTENSION IF NOT EXISTS vector');
    await this.targetPool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    // Run migration SQL files in order
    const migrationFiles = [
      '002_core_system_tables.sql',
      '003_file_processing_tables.sql',
      '004_device_settings_tables.sql',
      '0020_neurocore_p3_schema.sql',
      '0021_engine_schedules.sql'
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, '../../migrations', file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf-8');
        await this.targetPool.query(sql);
      }
    }

    // Add stack architecture fields
    await this.targetPool.query(`
      -- Add stack architecture to domain_entanglements if not exists
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='domain_entanglements' AND column_name='tags') THEN
          ALTER TABLE domain_entanglements ADD COLUMN tags TEXT[];
          CREATE INDEX idx_domain_entanglements_tags ON domain_entanglements USING GIN (tags);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='domain_entanglements' AND column_name='stack_metadata') THEN
          ALTER TABLE domain_entanglements ADD COLUMN stack_metadata JSONB DEFAULT '{}'::jsonb;
        END IF;
      END $$;
    `);
  }

  private async migrateData(): Promise<void> {
    const tables = [
      'users',
      'sessions',
      'conversations',
      'messages',
      'unified_memory',
      'domain_entanglements',
      'blueprints',
      'cad_files',
      'file_uploads',
      'chat_sessions',
      'chat_messages',
      'embeddings',
      'health_snapshots',
      'curiosity_events',
      'curiosity_tasks',
      'audit_logs'
    ];

    for (const table of tables) {
      await this.migrateTable(table);
    }
  }

  private async migrateTable(table: string): Promise<void> {
    this.state.currentStep = `Migrating table: ${table}`;
    this.state.migrationProgress[table] = {
      status: 'running',
      totalRecords: 0,
      migratedRecords: 0
    };

    try {
      if (!this.targetPool) throw new Error('Target pool not initialized');

      // Check if table exists in source
      const checkTable = await this.sourcePool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);

      if (!checkTable.rows[0].exists) {
        this.state.migrationProgress[table].status = 'completed';
        return;
      }

      // Get total count
      const countResult = await this.sourcePool.query(`SELECT COUNT(*) FROM ${table}`);
      const total = parseInt(countResult.rows[0].count);
      this.state.migrationProgress[table].totalRecords = total;

      if (total === 0) {
        this.state.migrationProgress[table].status = 'completed';
        return;
      }

      // Migrate in batches
      const batchSize = 1000;
      let offset = 0;

      while (offset < total) {
        const data = await this.sourcePool.query(`
          SELECT * FROM ${table} 
          ORDER BY created_at 
          LIMIT $1 OFFSET $2
        `, [batchSize, offset]);

        if (data.rows.length > 0) {
          // Generate INSERT statement
          const columns = Object.keys(data.rows[0]);
          const values = data.rows.map((row, i) => {
            const placeholders = columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ');
            return `(${placeholders})`;
          }).join(', ');

          const flatValues = data.rows.flatMap(row => columns.map(col => row[col]));

          await this.targetPool.query(`
            INSERT INTO ${table} (${columns.join(', ')})
            VALUES ${values}
            ON CONFLICT DO NOTHING
          `, flatValues);
        }

        offset += batchSize;
        this.state.migrationProgress[table].migratedRecords = Math.min(offset, total);
      }

      this.state.migrationProgress[table].status = 'completed';

    } catch (err: any) {
      this.state.migrationProgress[table].status = 'failed';
      this.state.errors.push(`Failed to migrate ${table}: ${err.message}`);
      throw err;
    }
  }

  private async verifyMigration(): Promise<void> {
    this.state.currentStep = 'Verifying migration...';

    if (!this.targetPool) throw new Error('Target pool not initialized');

    const tables = Object.keys(this.state.migrationProgress);
    
    for (const table of tables) {
      const sourceCount = await this.sourcePool.query(`SELECT COUNT(*) FROM ${table}`);
      const targetCount = await this.targetPool.query(`SELECT COUNT(*) FROM ${table}`);

      const sourceTotal = parseInt(sourceCount.rows[0].count);
      const targetTotal = parseInt(targetCount.rows[0].count);

      if (sourceTotal !== targetTotal) {
        this.state.warnings.push(
          `Table ${table}: source has ${sourceTotal} records, target has ${targetTotal}`
        );
      }
    }
  }

  public async cleanup(): Promise<void> {
    if (this.targetPool) {
      await this.targetPool.end();
    }
  }
}
