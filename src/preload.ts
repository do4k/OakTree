/* eslint-disable @typescript-eslint/no-var-requires */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog operations
  openFile: (filters) => ipcRenderer.invoke('dialog:openFile', filters),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (defaultPath, filters) => ipcRenderer.invoke('dialog:saveFile', defaultPath, filters),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  
  // File operations
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('file:write', filePath, data),
  readTextFile: (filePath) => ipcRenderer.invoke('file:readText', filePath),
  writeTextFile: (filePath, text) => ipcRenderer.invoke('file:writeText', filePath, text),
  readGFX: (gfxPath, gfxNumber) => ipcRenderer.invoke('file:readGFX', gfxPath, gfxNumber),
  listGFXFiles: (gfxPath) => ipcRenderer.invoke('file:listGFXFiles', gfxPath),
  preloadAllGFX: (gfxPath) => ipcRenderer.invoke('file:preloadAllGFX', gfxPath),
  onGFXLoadProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('gfx:loadProgress', subscription);
    return () => ipcRenderer.removeListener('gfx:loadProgress', subscription);
  },
  joinPath: (...paths) => ipcRenderer.invoke('path:join', ...paths),
  getHomeDir: () => ipcRenderer.invoke('path:getHomeDir'),
  getCwd: () => ipcRenderer.invoke('path:getCwd'),
  setTitle: (title: string) => ipcRenderer.invoke('window:setTitle', title),
  fileExists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
  pathExists: (path) => ipcRenderer.invoke('file:pathExists', path),
  isDirectory: (filePath) => ipcRenderer.invoke('file:isDirectory', filePath),
  ensureDir: (dirPath) => ipcRenderer.invoke('file:ensureDir', dirPath),
  listDirectories: (dirPath) => ipcRenderer.invoke('file:listDirectories', dirPath),
  readDirectory: (dirPath) => ipcRenderer.invoke('file:readDirectory', dirPath),
  deleteDirectory: (dirPath) => ipcRenderer.invoke('file:deleteDirectory', dirPath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('file:rename', oldPath, newPath),
  convertBitmapToPNG: (bitmapData) => ipcRenderer.invoke('file:convertBitmapToPNG', bitmapData),
  runCommand: (command) => ipcRenderer.invoke('shell:runCommand', command)
});
