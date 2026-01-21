/**
 * Global type definitions
 */

// Electron API types
interface ElectronAPI {
  readGFX: (gfxFolder: string, gfxNumber: number) => Promise<{ success: boolean; data?: ArrayBuffer; error?: string }>;
  openFile: (filters: Array<{ name: string; extensions: string[] }>) => Promise<string>;
  readFile: (filePath: string) => Promise<{ success: boolean; data?: ArrayBuffer; error?: string }>;
  writeFile: (filePath: string, data: Uint8Array) => Promise<{ success: boolean; error?: string }>;
  readTextFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeTextFile: (filePath: string, text: string) => Promise<{ success: boolean; error?: string }>;
  openDirectory: () => Promise<string>;
  saveFile: (defaultPath: string, filters: Array<{ name: string; extensions: string[] }>) => Promise<string>;
  preloadAllGFX: (gfxPath: string) => Promise<{ success: boolean; filesLoaded?: number; total?: number; error?: string }>;
  onGFXLoadProgress: (callback: (data: { current: number; total: number; progress: number; fileName: string }) => void) => () => void;
  getHomeDir: () => Promise<string>;
  getCwd: () => Promise<string>;
  setTitle: (title: string) => Promise<void>;
  fileExists: (filePath: string) => Promise<boolean>;
  isDirectory: (filePath: string) => Promise<boolean>;
  ensureDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  listDirectories: (dirPath: string) => Promise<string[]>;
  readDirectory: (dirPath: string) => Promise<{ success: boolean; files?: Array<{ name: string; isDirectory: boolean; isFile: boolean }>; error?: string }>;
  deleteDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  pathExists: (path: string) => Promise<boolean>;
  renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
  selectFolder: () => Promise<{ success: boolean; path?: string; error?: string }>;
  selectFile: (options: { filters: Array<{ name: string; extensions: string[] }> }) => Promise<{ success: boolean; path?: string; error?: string }>;
  convertBitmapToPNG: (bitmapData: Uint8Array | number[]) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  runCommand: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

interface Window {
  electronAPI?: ElectronAPI;
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
}

// Electron extends the File interface with a path property
interface ElectronFile extends File {
  path: string;
}

// File System Access API types (for browser)
interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
}
