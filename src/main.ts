/* eslint-disable @typescript-eslint/no-var-requires */
const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { BMPConverter } = require('./bmp-converter');

// Set app name before ready event
app.setName('OakTree');

let mainWindow;

function createWindow() {
  // Determine icon path based on dev/prod mode and platform
  const isDev = process.argv.includes('--dev');
  let iconPath;
  
  if (process.platform === 'darwin') {
    // Use ICNS for macOS
    iconPath = isDev 
      ? path.join(process.cwd(), 'assets', 'icon.icns')
      : path.join(__dirname, '..', 'assets', 'icon.icns');
  } else if (process.platform === 'win32') {
    // Use ICO for Windows
    iconPath = isDev 
      ? path.join(process.cwd(), 'assets', 'icon.ico')
      : path.join(__dirname, '..', 'assets', 'icon.ico');
  } else {
    // Use PNG for Linux
    iconPath = isDev 
      ? path.join(process.cwd(), 'assets', 'icon.png')
      : path.join(__dirname, '..', 'assets', 'icon.png');
  }

  const icon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'OakTree',
    icon: icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev 
            ? "default-src 'self' 'unsafe-inline' data: blob: http://localhost:* ws://localhost:* https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' http://localhost:* https://cdn.jsdelivr.net; img-src 'self' data: blob: http://localhost:*; worker-src 'self' blob: https://cdn.jsdelivr.net; font-src 'self' data: https://cdn.jsdelivr.net"
            : "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data: https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net"
        ]
      }
    });
  });

  // Load Vite dev server in development, built files in production
  if (isDev) {
    // Wait a moment for Vite to be ready, then try common ports
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:5174').catch(() => {
        mainWindow.loadURL('http://localhost:5175').catch(() => {
          mainWindow.loadURL('http://localhost:5173');
        });
      });
    }, 1000);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Set dock icon for macOS
  if (process.platform === 'darwin') {
    const isDev = process.argv.includes('--dev');
    const iconPath = isDev 
      ? path.join(process.cwd(), 'assets', 'icon.icns')
      : path.join(__dirname, '..', 'assets', 'icon.icns');
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('dialog:openFile', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [
      { name: 'Item Files', extensions: ['eif'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select GFX Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:saveFile', async (event, defaultPath, filters) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath,
    filters: filters || [
      { name: 'Item Files', extensions: ['eif'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    return result.filePath;
  }
  return null;
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath);
    return { success: true, data: Array.from(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:write', async (event, filePath, data) => {
  try {
    await fs.writeFile(filePath, Buffer.from(data));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:readText', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:writeText', async (event, filePath, text) => {
  try {
    await fs.writeFile(filePath, text, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:readGFX', async (event, gfxPath, gfxNumber) => {
  try {
    // Format: gfx001.egf, gfx002.egf, etc.
    const fileName = `gfx${String(gfxNumber).padStart(3, '0')}.egf`;
    const filePath = path.join(gfxPath, fileName);
    const data = await fs.readFile(filePath);
    return { success: true, data: Array.from(data) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:listGFXFiles', async (event, gfxPath) => {
  try {
    const files = await fs.readdir(gfxPath);
    const gfxFiles = files
      .filter(f => f.match(/^gfx\d{3}\.egf$/i))
      .map(f => {
        const match = f.match(/gfx(\d{3})\.egf/i);
        return parseInt(match[1], 10);
      })
      .sort((a, b) => a - b);
    return { success: true, files: gfxFiles };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle('path:join', async (event, ...paths) => {
  return path.join(...paths);
});

ipcMain.handle('path:getHomeDir', async () => {
  const os = require('os');
  return os.homedir();
});

ipcMain.handle('path:getCwd', async () => {
  return process.cwd();
});

ipcMain.handle('window:setTitle', async (event, title) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

ipcMain.handle('file:exists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('file:isDirectory', async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
});

ipcMain.handle('file:ensureDir', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return { success: true };
  } catch (error) {
    console.error('Error creating directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:listDirectories', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const directories = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => entry.name);
    return directories;
  } catch (error) {
    console.error('Error listing directories:', error);
    return [];
  }
});

ipcMain.handle('file:readDirectory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile()
    }));
    return { success: true, files };
  } catch (error) {
    console.error('Error reading directory:', error);
    return { success: false, error: error.message, files: [] };
  }
});

ipcMain.handle('file:deleteDirectory', async (event, dirPath) => {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    console.error('Error deleting directory:', error);
    return { success: false, error: error.message };
  }
});

// Check if path exists
ipcMain.handle('file:pathExists', async (event, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

// Rename file or directory
ipcMain.handle('file:rename', async (event, oldPath, newPath) => {
  try {
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    console.error('Error renaming:', error);
    return { success: false, error: error.message };
  }
});

// Select folder dialog
ipcMain.handle('dialog:selectFolder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'No folder selected' };
    }
    
    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    console.error('Error selecting folder:', error);
    return { success: false, error: error.message };
  }
});

// Preload all GFX files in the background with progress updates
ipcMain.handle('file:preloadAllGFX', async (event, gfxPath) => {
  try {
    // List all GFX files
    const files = await fs.readdir(gfxPath);
    const gfxFiles = files
      .filter(f => f.match(/^gfx\d{3}\.egf$/i))
      .map(f => {
        const match = f.match(/gfx(\d{3})\.egf/i);
        return {
          number: parseInt(match[1], 10),
          fileName: f
        };
      })
      .sort((a, b) => a.number - b.number);

    const total = gfxFiles.length;
    const cache = new Map();
    
    // Load files one by one and send progress updates
    for (let i = 0; i < gfxFiles.length; i++) {
      const gfxFile = gfxFiles[i];
      const filePath = path.join(gfxPath, gfxFile.fileName);
      
      try {
        const data = await fs.readFile(filePath);
        cache.set(gfxFile.number, Array.from(data));
        
        // Send progress update
        const progress = ((i + 1) / total) * 100;
        event.sender.send('gfx:loadProgress', {
          current: i + 1,
          total,
          progress,
          fileName: gfxFile.fileName
        });
      } catch (error) {
        console.error(`Error loading ${gfxFile.fileName}:`, error);
        // Continue loading other files even if one fails
      }
    }

    return { 
      success: true, 
      filesLoaded: cache.size,
      total: gfxFiles.length
    };
  } catch (error) {
    console.error('Error preloading GFX files:', error);
    return { success: false, error: error.message };
  }
});

// Convert BMP buffer to PNG data URL (server-side)
ipcMain.handle('file:convertBitmapToPNG', async (event, bitmapData) => {
  try {
    const startTime = performance.now();
    const bmpBuffer = Buffer.from(bitmapData);
    const dataUrl = await BMPConverter.convertToDataURL(bmpBuffer);
    const endTime = performance.now();
    
    if (endTime - startTime > 50) {
      console.log(`⏱️  Server-side BMP conversion: ${(endTime - startTime).toFixed(2)}ms`);
    }
    
    return { success: true, dataUrl };
  } catch (error) {
    console.error('Error converting BMP:', error);
    return { success: false, error: error.message };
  }
});

// Execute shell command
ipcMain.handle('shell:runCommand', async (event, command) => {
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    const { stdout, stderr } = await execPromise(command, {
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    return { 
      stdout: stdout || '', 
      stderr: stderr || '', 
      exitCode: 0 
    };
  } catch (error) {
    return { 
      stdout: error.stdout || '', 
      stderr: error.stderr || error.message, 
      exitCode: error.code || 1 
    };
  }
});
