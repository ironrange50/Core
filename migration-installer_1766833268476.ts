/**
 * WORKING MIGRATION INSTALLER SERVICE
 * server/services/migration-installer.ts
 * 
 * This service actually installs all required software on the target server
 * and verifies everything is ready before migration
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// ============================================================================
// INSTALLATION REQUIREMENTS
// ============================================================================

interface InstallationRequirements {
  nodejs: { version: string; installed: boolean; path?: string };
  postgresql: { version: string; installed: boolean; running: boolean };
  redis: { version: string; installed: boolean; running: boolean };
  git: { version: string; installed: boolean };
  buildTools: { installed: boolean };
  directories: { created: boolean; paths: string[] };
}

interface InstallationProgress {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string;
  timestamp: Date;
}

// ============================================================================
// CHECK CURRENT INSTALLATION STATUS
// ============================================================================

export async function checkInstallationStatus(): Promise<{
  ready: boolean;
  requirements: InstallationRequirements;
  missing: string[];
}> {
  const platform = os.platform();
  const requirements: InstallationRequirements = {
    nodejs: { version: '', installed: false },
    postgresql: { version: '', installed: false, running: false },
    redis: { version: '', installed: false, running: false },
    git: { version: '', installed: false },
    buildTools: { installed: false },
    directories: { created: false, paths: [] }
  };
  const missing: string[] = [];

  // Check Node.js
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim();
    const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
    requirements.nodejs.installed = majorVersion >= 20;
    requirements.nodejs.version = version;
    requirements.nodejs.path = await getNodePath();
    if (!requirements.nodejs.installed) {
      missing.push(`Node.js 20+ (found ${version})`);
    }
  } catch {
    missing.push('Node.js 20+');
  }

  // Check PostgreSQL
  try {
    const { stdout } = await execAsync(platform === 'win32' ? 'psql --version' : 'psql --version');
    const version = stdout.trim();
    requirements.postgresql.installed = true;
    requirements.postgresql.version = version;
    
    // Check if PostgreSQL is running
    try {
      await execAsync(platform === 'win32' 
        ? 'sc query postgresql-x64-16 | findstr "RUNNING"'
        : 'systemctl is-active postgresql || service postgresql status'
      );
      requirements.postgresql.running = true;
    } catch {
      requirements.postgresql.running = false;
      missing.push('PostgreSQL service (not running)');
    }
  } catch {
    missing.push('PostgreSQL 16+');
  }

  // Check Redis
  try {
    const { stdout } = await execAsync(platform === 'win32' ? 'redis-server --version' : 'redis-server --version');
    requirements.redis.installed = true;
    requirements.redis.version = stdout.trim();
    
    // Check if Redis is running
    try {
      await execAsync(platform === 'win32'
        ? 'sc query Redis | findstr "RUNNING"'
        : 'systemctl is-active redis || service redis status'
      );
      requirements.redis.running = true;
    } catch {
      requirements.redis.running = false;
      missing.push('Redis service (not running)');
    }
  } catch {
    missing.push('Redis');
  }

  // Check Git
  try {
    const { stdout } = await execAsync('git --version');
    requirements.git.installed = true;
    requirements.git.version = stdout.trim();
  } catch {
    missing.push('Git');
  }

  // Check build tools
  try {
    if (platform === 'win32') {
      await execAsync('where cl.exe');
      requirements.buildTools.installed = true;
    } else {
      await execAsync('which gcc');
      requirements.buildTools.installed = true;
    }
  } catch {
    missing.push('C++ Build Tools');
  }

  // Check directories
  const requiredDirs = [
    '/opt/neurocore',
    '/opt/neurocore/uploads',
    '/opt/neurocore/logs',
    '/opt/neurocore/backups'
  ];
  
  let dirsExist = true;
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      dirsExist = false;
      break;
    }
  }
  requirements.directories.created = dirsExist;
  requirements.directories.paths = requiredDirs;
  if (!dirsExist) {
    missing.push('Required directories');
  }

  return {
    ready: missing.length === 0,
    requirements,
    missing
  };
}

// ============================================================================
// AUTO-INSTALL MISSING COMPONENTS
// ============================================================================

export async function installMissingComponents(
  onProgress: (progress: InstallationProgress) => void
): Promise<{ success: boolean; errors: string[] }> {
  const platform = os.platform();
  const errors: string[] = [];

  const updateProgress = (step: string, status: InstallationProgress['status'], message: string) => {
    onProgress({
      step,
      status,
      message,
      timestamp: new Date()
    });
  };

  try {
    // Step 1: Create directories
    updateProgress('directories', 'running', 'Creating required directories...');
    await createDirectories();
    updateProgress('directories', 'completed', 'Directories created successfully');

    // Step 2: Install Node.js if missing
    const status = await checkInstallationStatus();
    
    if (!status.requirements.nodejs.installed) {
      updateProgress('nodejs', 'running', 'Installing Node.js 20 LTS...');
      try {
        await installNodeJS(platform);
        updateProgress('nodejs', 'completed', 'Node.js installed successfully');
      } catch (err: any) {
        updateProgress('nodejs', 'failed', err.message);
        errors.push(`Node.js installation failed: ${err.message}`);
      }
    } else {
      updateProgress('nodejs', 'completed', `Node.js ${status.requirements.nodejs.version} already installed`);
    }

    // Step 3: Install PostgreSQL if missing
    if (!status.requirements.postgresql.installed) {
      updateProgress('postgresql', 'running', 'Installing PostgreSQL 16...');
      try {
        await installPostgreSQL(platform);
        updateProgress('postgresql', 'completed', 'PostgreSQL installed successfully');
      } catch (err: any) {
        updateProgress('postgresql', 'failed', err.message);
        errors.push(`PostgreSQL installation failed: ${err.message}`);
      }
    } else if (!status.requirements.postgresql.running) {
      updateProgress('postgresql', 'running', 'Starting PostgreSQL service...');
      try {
        await startPostgreSQL(platform);
        updateProgress('postgresql', 'completed', 'PostgreSQL service started');
      } catch (err: any) {
        updateProgress('postgresql', 'failed', err.message);
        errors.push(`PostgreSQL start failed: ${err.message}`);
      }
    } else {
      updateProgress('postgresql', 'completed', 'PostgreSQL already installed and running');
    }

    // Step 4: Install Redis if missing
    if (!status.requirements.redis.installed) {
      updateProgress('redis', 'running', 'Installing Redis...');
      try {
        await installRedis(platform);
        updateProgress('redis', 'completed', 'Redis installed successfully');
      } catch (err: any) {
        updateProgress('redis', 'failed', err.message);
        errors.push(`Redis installation failed: ${err.message}`);
      }
    } else if (!status.requirements.redis.running) {
      updateProgress('redis', 'running', 'Starting Redis service...');
      try {
        await startRedis(platform);
        updateProgress('redis', 'completed', 'Redis service started');
      } catch (err: any) {
        updateProgress('redis', 'failed', err.message);
        errors.push(`Redis start failed: ${err.message}`);
      }
    } else {
      updateProgress('redis', 'completed', 'Redis already installed and running');
    }

    // Step 5: Install Git if missing
    if (!status.requirements.git.installed) {
      updateProgress('git', 'running', 'Installing Git...');
      try {
        await installGit(platform);
        updateProgress('git', 'completed', 'Git installed successfully');
      } catch (err: any) {
        updateProgress('git', 'failed', err.message);
        errors.push(`Git installation failed: ${err.message}`);
      }
    } else {
      updateProgress('git', 'completed', 'Git already installed');
    }

    // Step 6: Install build tools if missing
    if (!status.requirements.buildTools.installed) {
      updateProgress('buildTools', 'running', 'Installing C++ build tools...');
      try {
        await installBuildTools(platform);
        updateProgress('buildTools', 'completed', 'Build tools installed successfully');
      } catch (err: any) {
        updateProgress('buildTools', 'failed', err.message);
        errors.push(`Build tools installation failed: ${err.message}`);
      }
    } else {
      updateProgress('buildTools', 'completed', 'Build tools already installed');
    }

    return {
      success: errors.length === 0,
      errors
    };

  } catch (err: any) {
    errors.push(`Installation failed: ${err.message}`);
    return { success: false, errors };
  }
}

// ============================================================================
// INSTALLATION FUNCTIONS
// ============================================================================

async function createDirectories(): Promise<void> {
  const dirs = [
    '/opt/neurocore',
    '/opt/neurocore/uploads',
    '/opt/neurocore/logs',
    '/opt/neurocore/backups'
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
  }
}

async function installNodeJS(platform: string): Promise<void> {
  if (platform === 'win32') {
    // Windows: Download and run Node.js installer
    const installerUrl = 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi';
    await execAsync(`powershell -Command "Invoke-WebRequest -Uri ${installerUrl} -OutFile node-installer.msi; Start-Process msiexec.exe -ArgumentList '/i node-installer.msi /quiet /norestart' -Wait"`);
  } else if (platform === 'linux') {
    // Linux: Use NodeSource repository
    await execAsync('curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -');
    await execAsync('sudo apt-get install -y nodejs');
  } else if (platform === 'darwin') {
    // macOS: Use Homebrew
    await execAsync('brew install node@20');
  }
}

async function installPostgreSQL(platform: string): Promise<void> {
  if (platform === 'win32') {
    const installerUrl = 'https://get.enterprisedb.com/postgresql/postgresql-16.1-1-windows-x64.exe';
    await execAsync(`powershell -Command "Invoke-WebRequest -Uri ${installerUrl} -OutFile pg-installer.exe; Start-Process pg-installer.exe -ArgumentList '--mode unattended --unattendedmodeui none' -Wait"`);
  } else if (platform === 'linux') {
    await execAsync('sudo sh -c \'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list\'');
    await execAsync('wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -');
    await execAsync('sudo apt-get update');
    await execAsync('sudo apt-get -y install postgresql-16');
  } else if (platform === 'darwin') {
    await execAsync('brew install postgresql@16');
  }
}

async function startPostgreSQL(platform: string): Promise<void> {
  if (platform === 'win32') {
    await execAsync('sc start postgresql-x64-16');
  } else {
    await execAsync('sudo systemctl start postgresql || sudo service postgresql start');
  }
}

async function installRedis(platform: string): Promise<void> {
  if (platform === 'win32') {
    const installerUrl = 'https://github.com/microsoftarchive/redis/releases/download/win-3.2.100/Redis-x64-3.2.100.msi';
    await execAsync(`powershell -Command "Invoke-WebRequest -Uri ${installerUrl} -OutFile redis-installer.msi; Start-Process msiexec.exe -ArgumentList '/i redis-installer.msi /quiet /norestart' -Wait"`);
  } else if (platform === 'linux') {
    await execAsync('sudo apt-get update');
    await execAsync('sudo apt-get install -y redis-server');
  } else if (platform === 'darwin') {
    await execAsync('brew install redis');
  }
}

async function startRedis(platform: string): Promise<void> {
  if (platform === 'win32') {
    await execAsync('sc start Redis');
  } else {
    await execAsync('sudo systemctl start redis || sudo service redis start');
  }
}

async function installGit(platform: string): Promise<void> {
  if (platform === 'win32') {
    const installerUrl = 'https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe';
    await execAsync(`powershell -Command "Invoke-WebRequest -Uri ${installerUrl} -OutFile git-installer.exe; Start-Process git-installer.exe -ArgumentList '/VERYSILENT /NORESTART' -Wait"`);
  } else if (platform === 'linux') {
    await execAsync('sudo apt-get update');
    await execAsync('sudo apt-get install -y git');
  } else if (platform === 'darwin') {
    await execAsync('brew install git');
  }
}

async function installBuildTools(platform: string): Promise<void> {
  if (platform === 'win32') {
    // Install Visual Studio Build Tools
    await execAsync('npm install -g windows-build-tools');
  } else if (platform === 'linux') {
    await execAsync('sudo apt-get update');
    await execAsync('sudo apt-get install -y build-essential');
  } else if (platform === 'darwin') {
    await execAsync('xcode-select --install');
  }
}

async function getNodePath(): Promise<string> {
  try {
    const { stdout } = await execAsync(os.platform() === 'win32' ? 'where node' : 'which node');
    return stdout.trim().split('\n')[0];
  } catch {
    return '';
  }
}

// ============================================================================
// DATABASE SETUP
// ============================================================================

export async function setupDatabase(dbName: string = 'neurocore_prod'): Promise<{
  success: boolean;
  connectionString: string;
  error?: string;
}> {
  try {
    // Create database
    await execAsync(`createdb ${dbName}`);
    
    // Create user if needed
    const dbUser = 'neurocore';
    const dbPassword = generateSecurePassword();
    
    await execAsync(`psql -c "CREATE USER ${dbUser} WITH PASSWORD '${dbPassword}';" postgres`);
    await execAsync(`psql -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser};" postgres`);
    
    const connectionString = `postgresql://${dbUser}:${dbPassword}@localhost:5432/${dbName}`;
    
    return {
      success: true,
      connectionString
    };
  } catch (err: any) {
    return {
      success: false,
      connectionString: '',
      error: err.message
    };
  }
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
