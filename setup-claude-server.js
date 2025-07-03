import { homedir, platform } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from "node:child_process";
import { version as nodeVersion } from 'process';

// Setup tracking
let setupSteps = []; // Track setup progress
let setupStartTime = Date.now();

// Function to get npm version
async function getNpmVersion() {
  try {
    return new Promise((resolve, reject) => {
      exec('npm --version', (error, stdout, stderr) => {
        if (error) {
          resolve('unknown');
          return;
        }
        resolve(stdout.trim());
      });
    });
  } catch (error) {
    return 'unknown';
  }
}

const getVersion = async () => {
    try {
        const packagePath = join(dirname(fileURLToPath(import.meta.url)), 'package.json');
        const packageContent = readFileSync(packagePath, 'utf-8');
        const packageData = JSON.parse(packageContent);
        return packageData.version || 'unknown';
    } catch (error) {
        return 'unknown';
    }
};

// Detect shell
function detectShell() {
    const shell = process.env.SHELL || 'unknown';
    
    // Extract just the shell name from the path
    const shellName = shell.split('/').pop() || shell;
    
    // Map common shells to standardized names
    const shellMap = {
        'bash': 'bash',
        'zsh': 'zsh',
        'fish': 'fish',
        'sh': 'sh',
        'dash': 'dash',
        'ksh': 'ksh',
        'tcsh': 'tcsh',
        'csh': 'csh',
        'cmd': 'cmd',
        'powershell': 'powershell',
        'pwsh': 'powershell'
    };
    
    return shellMap[shellName.toLowerCase()] || shellName;
}

// Get execution context (how the setup was run)
function getExecutionContext() {
    // Check if running via npx
    if (process.env.npm_command === 'exec' || process.argv[1]?.includes('npx')) {
        return 'npx';
    }
    
    // Check if running via npm run
    if (process.env.npm_lifecycle_event) {
        return `npm_${process.env.npm_lifecycle_event}`;
    }
    
    // Check if running directly via node
    if (process.argv[0]?.includes('node')) {
        return 'node_direct';
    }
    
    return 'unknown';
}

function logToFile(message, isError = false) {
    const logDir = join(homedir(), '.claude-code-logs');
    
    try {
        // Create log directory if it doesn't exist
        if (!existsSync(logDir)) {
            mkdirSync(logDir, { recursive: true });
        }

        // Create timestamp for log entry
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${isError ? 'ERROR: ' : ''}${message}\n`;
        
        // Determine log file name (use date for rotation)
        const dateStr = new Date().toISOString().split('T')[0];
        const logFile = join(logDir, `setup-${dateStr}.log`);
        
        // Append to log file
        appendFileSync(logFile, logEntry);
        
        // Also create a latest.log symlink/copy for easy access
        const latestLog = join(logDir, 'setup-latest.log');
        writeFileSync(latestLog, logEntry, { flag: 'a' });
        
    } catch (error) {
        // Silently fail - we don't want logging issues to break setup
        // but still try to output to console
        if (isError) {
            console.error(`[Log Error] ${error.message}`);
        }
    }
}

function isDebugMode() {
    return process.argv.includes('--debug');
}

function addSetupStep(step, status = 'started', error = null) {
    const stepInfo = {
        step,
        status,
        timestamp: Date.now(),
        duration: 0,
        error: error ? error.message || error : null
    };
    
    setupSteps.push(stepInfo);
    return setupSteps.length - 1; // Return index for updates
}

function updateSetupStep(index, status, error = null) {
    if (index >= 0 && index < setupSteps.length) {
        const step = setupSteps[index];
        step.status = status;
        step.duration = Date.now() - step.timestamp;
        if (error) {
            step.error = error.message || error;
        }
    }
}

async function execAsync(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function restartClaude() {
    const restartStep = addSetupStep('restart_claude');
    
    const processes = ['Claude', 'Claude.app'];
    
    for (const processName of processes) {
        try {
            await execAsync(`pkill -x "${processName}"`);
        } catch (error) {
            // Process might not be running, which is fine
        }
    }
    
    // Give it a moment to fully close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to start Claude
    try {
        await execAsync('open -a Claude');
        updateSetupStep(restartStep, 'completed');
    } catch (error) {
        updateSetupStep(restartStep, 'failed', error);
        console.error('Failed to restart Claude:', error.message);
        throw error;
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

(async () => {
  console.log('\n🚀 Setting up Markdown Editor MCP for Claude Desktop...\n');

  // Determine the install path and whether we're doing local or global install
  let installPath = __dirname;
  let isDebug = false;
  let shouldUninstall = false;

  if (args.includes('--debug')) {
    isDebug = true;
    console.log('🐛 Debug mode enabled\n');
  }

  if (args.includes('--uninstall')) {
    shouldUninstall = true;
    console.log('🗑️  Uninstall mode\n');
  }

  // Find Claude config file
  const os = platform();
  let configPath;

  if (os === 'darwin') {
    configPath = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else if (os === 'win32') {
    configPath = join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else {
    console.error('❌ Unsupported operating system:', os);
    process.exit(1);
  }

  // Ensure config directory exists
  const configDir = dirname(configPath);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Read existing config or create new one
  let config = {};
  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, 'utf-8');
    try {
      config = JSON.parse(configContent);
    } catch (error) {
      console.error('❌ Error parsing existing config:', error);
      process.exit(1);
    }
  }

  // Initialize mcpServers if it doesn't exist
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  if (shouldUninstall) {
    // Remove the server from config
    if (config.mcpServers['markdown-editor-mcp']) {
      delete config.mcpServers['markdown-editor-mcp'];
      console.log('✅ Removed markdown-editor-mcp from Claude config');
    } else {
      console.log('ℹ️  markdown-editor-mcp was not found in Claude config');
    }
  } else {
    // Add our server configuration
    const serverPath = join(installPath, 'dist', 'index.js');
    
    const serverConfig = {
      command: "node",
      args: isDebug ? ["--inspect-brk=9229", serverPath] : [serverPath]
    };

    config.mcpServers['markdown-editor-mcp'] = serverConfig;

    console.log('✅ Added markdown-editor-mcp to Claude config');
    console.log('📍 Server path:', serverPath);
    
    if (isDebug) {
      console.log('\n🐛 Debug mode configuration:');
      console.log('- Node.js inspector will be available on port 9229');
      console.log('- You can attach a debugger to debug the MCP server');
      console.log('- Use Chrome DevTools or VS Code for debugging');
      console.log('- Open chrome://inspect in Chrome to connect to the debugger\n');
    }
  }

  // Write updated config
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('✅ Updated Claude config at:', configPath);

  if (!shouldUninstall) {
    console.log('\n🎉 Installation complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart Claude Desktop app');
    console.log('2. Look for "markdown-editor-mcp" in the available MCP servers');
    console.log('3. The server will start automatically when you use Claude\n');
    
    if (isDebug) {
      console.log('🐛 Debug-specific instructions:');
      console.log('- When Claude starts the server, it will pause and wait for debugger');
      console.log('- Attach your debugger to port 9229 to continue execution\n');
    }
  } else {
    console.log('\n🎉 Uninstallation complete!');
    console.log('The server has been removed from Claude config.');
    console.log('Restart Claude Desktop app to apply changes.\n');
  }

  // Log completion
  logToFile(`Setup completed successfully - Mode: ${shouldUninstall ? 'uninstall' : 'install'}, Debug: ${isDebug}`);
})().catch(error => {
  console.error('\n❌ Setup failed:', error);
  logToFile(`Setup failed: ${error.message}`, true);
  process.exit(1);
});