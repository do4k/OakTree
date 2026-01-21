import { useState, useCallback, useEffect } from 'react';
import { EIFParser } from '../../eif-parser';
import { ENFParser } from '../../enf-parser';
import { ECFParser } from '../../ecf-parser';
import { ESFParser } from '../../esf-parser';
import { EQFParser, QuestData } from '../../eqf-parser';
import { recordToArray, arrayToRecord } from '../../utils/dataTransforms';

export type TabType = 'items' | 'npcs' | 'classes' | 'skills' | 'inns' | 'quests' | 'git';

interface ProjectConfig {
  name: string;
  gfxPath: string;
  createdAt: string;
  lastModified: string;
  tabOrder?: TabType[];
}

interface ProjectData {
  items?: Record<number, any>;
  npcs?: Record<number, any>;
  classes?: Record<number, any>;
  skills?: Record<number, any>;
  inns?: any[];
  drops?: Map<number, any[]>;
  quests?: Record<number, QuestData>;
  equipment?: {
    equippedItems: Record<string, any>;
    appearance: {
      gender: number;
      hairStyle: number;
      hairColor: number;
      skinTone: number;
    };
  };
}

interface UseProjectReturn {
  currentProject: string; // Full path to project directory
  projectName: string; // Just the project name
  gfxFolder: string;
  pubDirectory: string | null;
  tabOrder: TabType[];
  createProject: (projectName: string, gfxPath: string, eifPath?: string, enfPath?: string, ecfPath?: string, esfPath?: string, dropsPath?: string) => Promise<void>;
  selectProject: (projectName: string) => Promise<ProjectData | null>;
  deleteProject: (projectName: string) => Promise<void>;
  updateProjectSettings: (settings: { projectName?: string; gfxPath?: string; pubDirectory?: string }) => Promise<void>;
  saveTabOrder: (newTabOrder: TabType[]) => Promise<void>;
  setCurrentProject: (projectName: string) => void;
  setGfxFolder: (path: string) => void;
  setPubDirectory: (path: string | null) => void;
  createQuest: (templateName?: string) => Promise<number>;
  updateQuest: (questId: number, updates: Partial<QuestData>) => Promise<void>;
  deleteQuest: (questId: number) => Promise<void>;
  importQuest: (eqfPath: string) => Promise<number>;
  exportQuest: (questId: number, savePath?: string) => Promise<void>;
  duplicateQuest: (questId: number) => Promise<number>;
}

export const useProject = (): UseProjectReturn => {
  const [currentProject, setCurrentProject] = useState(''); // Full path
  const [projectName, setProjectName] = useState(''); // Just the name
  const [gfxFolder, setGfxFolder] = useState('');
  const [pubDirectory, setPubDirectory] = useState<string | null>(null);
  const [oaktreeDir, setOaktreeDir] = useState(''); // Internal: .oaktree directory
  const [tabOrder, setTabOrder] = useState<TabType[]>(['items', 'npcs', 'classes', 'skills', 'inns', 'quests']);

  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

  // Initialize .oaktree directory on mount
  useEffect(() => {
    const initializeOaktreeDir = async () => {
      if (isElectron && window.electronAPI) {
        const homeDir = await window.electronAPI.getHomeDir();
        const cwd = await window.electronAPI.getCwd();
        
        // Try home directory first
        const homeOaktreeDir = `${homeDir}/.oaktree`;
        const cwdOaktreeDir = `${cwd}/.oaktree`;
        
        // Check if CWD .oaktree exists and has projects
        let useCwdDir = false;
        try {
          const cwdDirExists = await window.electronAPI.pathExists(cwdOaktreeDir);
          if (cwdDirExists) {
            // Check if it has any project folders
            const files = await window.electronAPI.readDirectory(cwdOaktreeDir);
            if (files.success && files.files && files.files.length > 0) {
              console.log('Found existing .oaktree in CWD with projects, using that location');
              useCwdDir = true;
            }
          }
        } catch (error) {
          console.log('CWD .oaktree not accessible:', error);
        }
        
        const folder = useCwdDir ? cwdOaktreeDir : homeOaktreeDir;
        setOaktreeDir(folder);
        await window.electronAPI.ensureDir(folder);
      }
    };
    initializeOaktreeDir();
  }, []);

  const createProject = useCallback(async (
    projectName: string,
    gfxPath: string,
    eifPath?: string,
    enfPath?: string,
    ecfPath?: string,
    esfPath?: string,
    dropsPath?: string
  ) => {
    if (!oaktreeDir || !isElectron || !window.electronAPI) {
      throw new Error('.oaktree directory not available');
    }

    // Validate project name
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(projectName)) {
      throw new Error('Project name contains invalid characters. Please use only letters, numbers, spaces, hyphens, and underscores.');
    }

    const projectFolder = `${oaktreeDir}/${projectName}`;
    console.log('Creating project folder:', projectFolder);
    await window.electronAPI.ensureDir(projectFolder);

    // Create config.json
    const config: ProjectConfig = {
      name: projectName,
      gfxPath: gfxPath,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      tabOrder: ['items', 'npcs', 'classes', 'skills', 'inns', 'quests']
    };

    const configPath = `${projectFolder}/config.json`;
    const result = await window.electronAPI.writeTextFile(configPath, JSON.stringify(config, null, 2));

    if (!result.success) {
      throw new Error(result.error);
    }

    const importedFiles: string[] = [];

    // Import EIF if provided
    if (eifPath) {
      console.log('Importing EIF from:', eifPath);
      const fileData = await window.electronAPI.readFile(eifPath);
      if (fileData.success) {
        const eifArray = new Uint8Array(fileData.data);
        console.log('EIF file read successfully, size:', eifArray.byteLength);
        const parsedData = EIFParser.parse(eifArray.buffer);
        console.log('Parsed EIF data:', parsedData);
        console.log('Number of records:', parsedData.records?.length);
        
        const items: Record<number, any> = {};
        for (const item of parsedData.records) {
          items[item.id] = item;
        }
        console.log('Items object created, keys:', Object.keys(items).length);
        
        const itemsArray = recordToArray(items);
        console.log('Items array created, length:', itemsArray.length);
        const itemsPath = `${projectFolder}/items.json`;
        const writeResult = await window.electronAPI.writeTextFile(itemsPath, JSON.stringify(itemsArray, null, 2));
        console.log('Items write result:', writeResult);
        console.log('Items imported during project creation');
        importedFiles.push('Items');
      } else {
        console.error('Failed to read EIF file:', fileData.error);
      }
    }

    // Import ENF if provided
    if (enfPath) {
      console.log('Importing ENF from:', enfPath);
      const fileData = await window.electronAPI.readFile(enfPath);
      if (fileData.success) {
        const enfArray = new Uint8Array(fileData.data);
        console.log('ENF file read successfully, size:', enfArray.byteLength);
        const parsedData = ENFParser.parse(enfArray.buffer);
        console.log('Parsed ENF data:', parsedData);
        console.log('Number of records:', parsedData.records?.length);
        
        const npcs: Record<number, any> = {};
        for (const npc of parsedData.records) {
          npcs[npc.id] = npc;
        }
        console.log('NPCs object created, keys:', Object.keys(npcs).length);
        
        const npcsArray = recordToArray(npcs);
        console.log('NPCs array created, length:', npcsArray.length);
        const npcsPath = `${projectFolder}/npcs.json`;
        const writeResult = await window.electronAPI.writeTextFile(npcsPath, JSON.stringify(npcsArray, null, 2));
        console.log('NPCs write result:', writeResult);
        console.log('NPCs imported during project creation');
        importedFiles.push('NPCs');
      } else {
        console.error('Failed to read ENF file:', fileData.error);
      }
    }

    // Import ECF if provided
    if (ecfPath) {
      console.log('Importing ECF from:', ecfPath);
      const fileData = await window.electronAPI.readFile(ecfPath);
      if (fileData.success) {
        const ecfArray = new Uint8Array(fileData.data);
        console.log('ECF file read successfully, size:', ecfArray.byteLength);
        const parsedData = ECFParser.parse(ecfArray.buffer);
        console.log('Parsed ECF data:', parsedData);
        console.log('Number of records:', parsedData.records?.length);
        
        const classes: Record<number, any> = {};
        for (const classRecord of parsedData.records) {
          classes[classRecord.id] = classRecord;
        }
        console.log('Classes object created, keys:', Object.keys(classes).length);
        
        const classesArray = recordToArray(classes);
        console.log('Classes array created, length:', classesArray.length);
        const classesPath = `${projectFolder}/classes.json`;
        const writeResult = await window.electronAPI.writeTextFile(classesPath, JSON.stringify(classesArray, null, 2));
        console.log('Classes write result:', writeResult);
        console.log('Classes imported during project creation');
        importedFiles.push('Classes');
      } else {
        console.error('Failed to read ECF file:', fileData.error);
      }
    }

    // Import ESF if provided
    if (esfPath) {
      console.log('Importing ESF from:', esfPath);
      const fileData = await window.electronAPI.readFile(esfPath);
      if (fileData.success) {
        const esfArray = new Uint8Array(fileData.data);
        console.log('ESF file read successfully, size:', esfArray.byteLength);
        const parsedData = ESFParser.parse(esfArray.buffer);
        console.log('Parsed ESF data:', parsedData);
        console.log('Number of records:', parsedData.records?.length);
        
        const skills: Record<number, any> = {};
        for (const skillRecord of parsedData.records) {
          skills[skillRecord.id] = skillRecord;
        }
        console.log('Skills object created, keys:', Object.keys(skills).length);
        
        const skillsArray = recordToArray(skills);
        console.log('Skills array created, length:', skillsArray.length);
        const skillsPath = `${projectFolder}/skills.json`;
        const writeResult = await window.electronAPI.writeTextFile(skillsPath, JSON.stringify(skillsArray, null, 2));
        console.log('Skills write result:', writeResult);
        console.log('Skills imported during project creation');
        importedFiles.push('Skills');
      } else {
        console.error('Failed to read ESF file:', fileData.error);
      }
    }

    // Import drops.txt if provided
    if (dropsPath) {
      console.log('Importing drops from:', dropsPath);
      const result = await window.electronAPI.readTextFile(dropsPath);
      if (result.success) {
        console.log('Drops file read successfully, length:', result.data.length);
        const content = result.data;
        const dropsMap = new Map();
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          const parts = trimmed.split('=');
          if (parts.length !== 2) continue;
          
          const npcId = parseInt(parts[0].trim());
          if (isNaN(npcId)) continue;
          
          const dropItems = [];
          const itemsStr = parts[1].trim();
          const itemParts = itemsStr.split(',').map(s => s.trim());
          
          for (let i = 0; i + 3 < itemParts.length; i += 4) {
            const itemId = parseInt(itemParts[i]);
            const min = parseInt(itemParts[i + 1]);
            const max = parseInt(itemParts[i + 2]);
            const percentage = parseFloat(itemParts[i + 3]);
            
            if (!isNaN(itemId) && !isNaN(min) && !isNaN(max) && !isNaN(percentage)) {
              dropItems.push({ itemId, min, max, percentage });
            }
          }
          
          if (dropItems.length > 0) {
            dropsMap.set(npcId, dropItems);
          }
        }
        
        console.log('Drops parsed, entries:', dropsMap.size);
        const dropsArray = Array.from(dropsMap.entries()).map(([npcId, drops]) => ({ npcId, drops }));
        console.log('Drops array created, length:', dropsArray.length);
        const dropsJsonPath = `${projectFolder}/drops.json`;
        const writeResult = await window.electronAPI.writeTextFile(dropsJsonPath, JSON.stringify(dropsArray, null, 2));
        console.log('Drops write result:', writeResult);
        console.log('Drops imported during project creation');
        importedFiles.push('Drops');
      } else {
        console.error('Failed to read drops file:', result.error);
      }
    }

    // Update state
    setCurrentProject(projectFolder);
    setProjectName(projectName);
    setGfxFolder(gfxPath);
  }, [oaktreeDir]);

  const selectProject = useCallback(async (projectName: string): Promise<ProjectData | null> => {
    if (!oaktreeDir || !isElectron || !window.electronAPI) return null;

    try {
      console.log(`Selecting project: "${projectName}" in folder: ${oaktreeDir}`);
      
      const projectFolder = `${oaktreeDir}/${projectName}`;
      const projectData: ProjectData = {};
      let jsonFilesFound = false;
      
      // Load config to get gfxPath
      const configPath = `${projectFolder}/config.json`;
      const configResult = await window.electronAPI.readTextFile(configPath);
      if (configResult.success) {
        const config: ProjectConfig = JSON.parse(configResult.data);
        console.log('Loaded config:', config);
        setGfxFolder(config.gfxPath);
        
        // Load tab order, with default fallback
        if (config.tabOrder && Array.isArray(config.tabOrder)) {
          setTabOrder(config.tabOrder);
        } else {
          // Use default order if not present in config
          setTabOrder(['items', 'npcs', 'classes', 'skills', 'inns', 'quests']);
        }
      }
      
      // Load items.json
      const itemsPath = `${projectFolder}/items.json`;
      let result = await window.electronAPI.readTextFile(itemsPath);
      if (result.success) {
        const itemsData = JSON.parse(result.data);
        if (Array.isArray(itemsData)) {
          projectData.items = arrayToRecord(itemsData);
          console.log('items.json loaded successfully');
        } else {
          projectData.items = {};
          console.log('items.json is not an array, initialized as empty');
        }
        jsonFilesFound = true;
      } else {
        projectData.items = {};
        console.log('items.json not found, initialized as empty');
      }
      
      // Load npcs.json
      const npcsPath = `${projectFolder}/npcs.json`;
      result = await window.electronAPI.readTextFile(npcsPath);
      if (result.success) {
        const npcsData = JSON.parse(result.data);
        if (Array.isArray(npcsData)) {
          projectData.npcs = arrayToRecord(npcsData);
          console.log('npcs.json loaded successfully');
        } else {
          projectData.npcs = {};
          console.log('npcs.json is not an array, initialized as empty');
        }
        jsonFilesFound = true;
      } else {
        projectData.npcs = {};
        console.log('npcs.json not found, initialized as empty');
      }
      
      // Load classes.json
      const classesPath = `${projectFolder}/classes.json`;
      result = await window.electronAPI.readTextFile(classesPath);
      if (result.success) {
        const classesData = JSON.parse(result.data);
        if (Array.isArray(classesData)) {
          projectData.classes = arrayToRecord(classesData);
          console.log('classes.json loaded successfully');
        } else {
          projectData.classes = {};
          console.log('classes.json is not an array, initialized as empty');
        }
        jsonFilesFound = true;
      } else {
        projectData.classes = {};
        console.log('classes.json not found, initialized as empty');
      }
      
      // Load skills.json
      const skillsPath = `${projectFolder}/skills.json`;
      result = await window.electronAPI.readTextFile(skillsPath);
      if (result.success) {
        const skillsData = JSON.parse(result.data);
        if (Array.isArray(skillsData)) {
          projectData.skills = arrayToRecord(skillsData);
          console.log('skills.json loaded successfully');
        } else {
          projectData.skills = {};
          console.log('skills.json is not an array, initialized as empty');
        }
        jsonFilesFound = true;
      } else {
        projectData.skills = {};
        console.log('skills.json not found, initialized as empty');
      }
      
      // Load inns.json
      const innsPath = `${projectFolder}/inns.json`;
      result = await window.electronAPI.readTextFile(innsPath);
      if (result.success) {
        const innsData = JSON.parse(result.data);
        if (Array.isArray(innsData)) {
          projectData.inns = innsData;
          console.log('inns.json loaded successfully');
        } else {
          projectData.inns = [];
          console.log('inns.json is not an array, initialized as empty');
        }
        jsonFilesFound = true;
      } else {
        projectData.inns = [];
        console.log('inns.json not found, initialized as empty');
      }
      
      // Load drops.json
      const dropsPath = `${projectFolder}/drops.json`;
      result = await window.electronAPI.readTextFile(dropsPath);
      if (result.success) {
        const dropsData = JSON.parse(result.data);
        // Handle both array format and old object format
        if (Array.isArray(dropsData)) {
          // New format: [{npcId: 1, drops: [...]}, {npcId: 2, drops: [...]}]
          projectData.drops = new Map(dropsData.map((item: any) => [item.npcId, item.drops]));
          console.log('drops.json loaded successfully (array format)');
        } else if (typeof dropsData === 'object' && dropsData !== null) {
          // Old format: {"1": [...], "2": [...]}
          projectData.drops = new Map(
            Object.entries(dropsData).map(([npcId, drops]) => [parseInt(npcId), drops as any[]])
          );
          console.log('drops.json loaded successfully (legacy object format - will be converted on save)');
        } else {
          // If neither array nor object, initialize as empty Map
          projectData.drops = new Map();
          console.log('drops.json is invalid format, initialized as empty');
        }
        jsonFilesFound = true;
      } else {
        // If file doesn't exist, initialize as empty Map
        projectData.drops = new Map();
        console.log('drops.json not found, initialized as empty');
      }
      
      // Load equipment.json
      const equipmentPath = `${projectFolder}/equipment.json`;
      result = await window.electronAPI.readTextFile(equipmentPath);
      if (result.success) {
        projectData.equipment = JSON.parse(result.data);
        console.log('equipment.json loaded successfully');
        jsonFilesFound = true;
      } else {
        console.log('equipment.json not found');
      }

      // Load quests.json
      const questsPath = `${projectFolder}/quests.json`;
      result = await window.electronAPI.readTextFile(questsPath);
      if (result.success) {
        const questsData = JSON.parse(result.data);
        if (Array.isArray(questsData)) {
          projectData.quests = arrayToRecord(questsData);
          console.log('quests.json loaded successfully');
        } else {
          projectData.quests = {};
          console.log('quests.json is not an array, initialized as empty');
        }
        jsonFilesFound = true;
      } else {
        projectData.quests = {};
        console.log('quests.json not found, initialized as empty');
      }
      
      // Update state
      setCurrentProject(projectFolder);
      setProjectName(projectName);
      localStorage.setItem('currentProject', projectName);
      
      // Update window title
      if (window.electronAPI) {
        await window.electronAPI.setTitle(`OakTree - EO Pub Editor - ${projectName}`);
      }
      
      if (jsonFilesFound) {
        console.log(`Project "${projectName}" loaded successfully`);
        return projectData;
      } else {
        console.warn(`Project "${projectName}" has no data files yet`);
        return null;
      }
    } catch (error) {
      console.error('Error selecting project:', error);
      throw error;
    }
  }, [oaktreeDir]);

  const updateProjectSettings = useCallback(async (settings: { projectName?: string; gfxPath?: string; pubDirectory?: string }) => {
    if (!currentProject || !isElectron || !window.electronAPI) {
      throw new Error('No active project');
    }

    const configPath = `${currentProject}/config.json`;
    const configResult = await window.electronAPI.readTextFile(configPath);
    
    if (!configResult.success) {
      throw new Error(`Failed to read config: ${configResult.error}`);
    }

    const config = JSON.parse(configResult.data);
    
    // Handle project rename
    if (settings.projectName && settings.projectName !== config.name) {
      const oldProjectPath = currentProject;
      const newProjectPath = `${oaktreeDir}/${settings.projectName}`;
      
      // Check if new project name already exists
      const exists = await window.electronAPI.pathExists(newProjectPath);
      if (exists) {
        throw new Error(`A project named "${settings.projectName}" already exists`);
      }
      
      // Rename the project directory
      await window.electronAPI.renameFile(oldProjectPath, newProjectPath);
      
      // Update state
      setCurrentProject(newProjectPath);
      setProjectName(settings.projectName);
      config.name = settings.projectName;
    }
    
    // Update GFX path
    if (settings.gfxPath !== undefined) {
      config.gfxPath = settings.gfxPath;
      setGfxFolder(settings.gfxPath);
    }
    
    // Update pub directory
    if (settings.pubDirectory !== undefined) {
      config.pubDirectory = settings.pubDirectory;
      setPubDirectory(settings.pubDirectory);
    }
    
    // Update last modified time
    config.lastModified = new Date().toISOString();
    
    // Write updated config
    const writeResult = await window.electronAPI.writeTextFile(
      `${currentProject}/config.json`,
      JSON.stringify(config, null, 2)
    );
    
    if (!writeResult.success) {
      throw new Error(`Failed to save config: ${writeResult.error}`);
    }
  }, [currentProject, oaktreeDir]);

  const deleteProject = useCallback(async (projectName: string) => {
    if (!oaktreeDir || !isElectron || !window.electronAPI) return;

    try {
      const projectFolder = `${oaktreeDir}/${projectName}`;
      await window.electronAPI.deleteDirectory(projectFolder);
      
      // If deleting the currently open project, clear state
      if (projectFolder === currentProject) {
        setCurrentProject('');
        setProjectName('');
        setGfxFolder('');
        localStorage.removeItem('currentProject');
        
        // Reset window title
        if (window.electronAPI) {
          await window.electronAPI.setTitle('OakTree - EO Pub Editor');
        }
      }
      
      console.log(`Project "${projectName}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }, [oaktreeDir, currentProject]);

  const createQuest = useCallback(async (templateName?: string): Promise<number> => {
    if (!currentProject || !isElectron || !window.electronAPI) {
      throw new Error('No project selected');
    }

    try {
      // Load existing quests to find next available ID
      const questsPath = `${currentProject}/quests.json`;
      let quests: Record<number, QuestData> = {};
      let nextId = 1;

      const questsResult = await window.electronAPI.readTextFile(questsPath);
      if (questsResult.success) {
        const questsArray = JSON.parse(questsResult.data);
        quests = arrayToRecord(questsArray);
        const ids = Object.keys(quests).map(k => parseInt(k));
        nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
      }

      // Create new quest with template if specified
      let newQuest: QuestData;
      if (templateName) {
        // Template will be imported in later step
        const { QUEST_TEMPLATES } = await import('../utils/questTemplates');
        const template = QUEST_TEMPLATES[templateName];
        if (template) {
          newQuest = { ...template, id: nextId };
        } else {
          throw new Error(`Template "${templateName}" not found`);
        }
      } else {
        // Create empty quest
        newQuest = {
          id: nextId,
          questName: `Quest ${nextId}`,
          version: 1,
          states: [{
            name: 'Begin',
            description: 'Quest start',
            actions: [],
            rules: []
          }],
          randomBlocks: []
        };
      }

      // Add to quests collection
      quests[nextId] = newQuest;

      // Save quests.json
      const questsArray = recordToArray(quests);
      const writeResult = await window.electronAPI.writeTextFile(
        questsPath,
        JSON.stringify(questsArray, null, 2)
      );

      if (!writeResult.success) {
        throw new Error(`Failed to save quest: ${writeResult.error}`);
      }

      console.log(`Created quest ${nextId}`);
      return nextId;
    } catch (error) {
      console.error('Error creating quest:', error);
      throw error;
    }
  }, [currentProject]);

  const updateQuest = useCallback(async (questId: number, updates: Partial<QuestData>) => {
    if (!currentProject || !isElectron || !window.electronAPI) {
      throw new Error('No project selected');
    }

    try {
      // Load quests
      const questsPath = `${currentProject}/quests.json`;
      const questsResult = await window.electronAPI.readTextFile(questsPath);
      
      if (!questsResult.success) {
        throw new Error('Quests file not found');
      }

      const questsArray = JSON.parse(questsResult.data);
      const quests = arrayToRecord(questsArray);

      if (!quests[questId]) {
        throw new Error(`Quest ${questId} not found`);
      }

      // Update quest
      quests[questId] = { ...quests[questId], ...updates, id: questId };

      // Save quests.json
      const updatedArray = recordToArray(quests);
      const writeResult = await window.electronAPI.writeTextFile(
        questsPath,
        JSON.stringify(updatedArray, null, 2)
      );

      if (!writeResult.success) {
        throw new Error(`Failed to update quest: ${writeResult.error}`);
      }

      console.log(`Updated quest ${questId}`);
    } catch (error) {
      console.error('Error updating quest:', error);
      throw error;
    }
  }, [currentProject]);

  const deleteQuest = useCallback(async (questId: number) => {
    if (!currentProject || !isElectron || !window.electronAPI) {
      throw new Error('No project selected');
    }

    try {
      // Load quests
      const questsPath = `${currentProject}/quests.json`;
      const questsResult = await window.electronAPI.readTextFile(questsPath);
      
      if (!questsResult.success) {
        throw new Error('Quests file not found');
      }

      const questsArray = JSON.parse(questsResult.data);
      const quests = arrayToRecord(questsArray);

      // Delete quest
      delete quests[questId];

      // Save quests.json
      const updatedArray = recordToArray(quests);
      const writeResult = await window.electronAPI.writeTextFile(
        questsPath,
        JSON.stringify(updatedArray, null, 2)
      );

      if (!writeResult.success) {
        throw new Error(`Failed to delete quest: ${writeResult.error}`);
      }

      console.log(`Deleted quest ${questId}`);
    } catch (error) {
      console.error('Error deleting quest:', error);
      throw error;
    }
  }, [currentProject]);

  const importQuest = useCallback(async (eqfPath: string): Promise<number> => {
    if (!currentProject || !isElectron || !window.electronAPI) {
      throw new Error('No project selected');
    }

    try {
      // Read EQF file
      const fileResult = await window.electronAPI.readTextFile(eqfPath);
      if (!fileResult.success) {
        throw new Error(`Failed to read quest file: ${fileResult.error}`);
      }

      // Extract quest ID from filename (e.g., 00013.eqf -> 13)
      const filename = eqfPath.split('/').pop() || eqfPath.split('\\').pop() || '';
      const match = filename.match(/(\d+)\.eqf$/i);
      let suggestedId = match ? parseInt(match[1], 10) : null;

      // Load existing quests
      const questsPath = `${currentProject}/quests.json`;
      let quests: Record<number, QuestData> = {};
      
      const questsResult = await window.electronAPI.readTextFile(questsPath);
      if (questsResult.success) {
        const questsArray = JSON.parse(questsResult.data);
        quests = arrayToRecord(questsArray);
      }

      // Assign next available ID if suggested ID is taken or invalid
      let questId = suggestedId;
      if (!questId || quests[questId]) {
        const ids = Object.keys(quests).map(k => parseInt(k));
        questId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
      }

      // Parse EQF file
      const parsedQuest = EQFParser.parse(fileResult.data, questId);

      // Add to quests collection
      quests[questId] = parsedQuest;

      // Save quests.json
      const questsArray = recordToArray(quests);
      const writeResult = await window.electronAPI.writeTextFile(
        questsPath,
        JSON.stringify(questsArray, null, 2)
      );

      if (!writeResult.success) {
        throw new Error(`Failed to save quest: ${writeResult.error}`);
      }

      console.log(`Imported quest ${questId} from ${eqfPath}`);
      return questId;
    } catch (error) {
      console.error('Error importing quest:', error);
      throw error;
    }
  }, [currentProject]);

  const exportQuest = useCallback(async (questId: number, savePath?: string) => {
    if (!currentProject || !isElectron || !window.electronAPI) {
      throw new Error('No project selected');
    }

    try {
      // Load quests
      const questsPath = `${currentProject}/quests.json`;
      const questsResult = await window.electronAPI.readTextFile(questsPath);
      
      if (!questsResult.success) {
        throw new Error('Quests file not found');
      }

      const questsArray = JSON.parse(questsResult.data);
      const quests = arrayToRecord(questsArray);

      if (!quests[questId]) {
        throw new Error(`Quest ${questId} not found`);
      }

      const quest = quests[questId];
      if (!quest || !('questName' in quest)) {
        throw new Error(`Invalid quest data for questId ${questId}`);
      }

      // Serialize to EQF format
      const eqfContent = EQFParser.serialize(quest as QuestData);

      // Generate filename
      const filename = String(questId).padStart(5, '0') + '.eqf';

      // Determine save path
      let finalPath = savePath;
      if (!finalPath) {
        // Open save dialog
        const result = await window.electronAPI.saveFile(filename, [
          { name: 'EQF Files', extensions: ['eqf'] }
        ]);
        if (!result) {
          console.log('Export cancelled');
          return;
        }
        finalPath = result;
      }

      // Write EQF file
      const writeResult = await window.electronAPI.writeTextFile(finalPath, eqfContent);

      if (!writeResult.success) {
        throw new Error(`Failed to export quest: ${writeResult.error}`);
      }

      console.log(`Exported quest ${questId} to ${finalPath}`);
    } catch (error) {
      console.error('Error exporting quest:', error);
      throw error;
    }
  }, [currentProject]);

  const duplicateQuest = useCallback(async (questId: number): Promise<number> => {
    if (!currentProject || !isElectron || !window.electronAPI) {
      throw new Error('No project selected');
    }

    try {
      // Load quests
      const questsPath = `${currentProject}/quests.json`;
      const questsResult = await window.electronAPI.readTextFile(questsPath);
      
      if (!questsResult.success) {
        throw new Error('Quests file not found');
      }

      const questsArray = JSON.parse(questsResult.data);
      const quests = arrayToRecord(questsArray);

      if (!quests[questId]) {
        throw new Error(`Quest ${questId} not found`);
      }

      // Find next available ID
      const ids = Object.keys(quests).map(k => parseInt(k));
      const newId = Math.max(...ids) + 1;

      // Create duplicate
      const original = quests[questId];
      if (!original || !('questName' in original)) {
        throw new Error(`Invalid quest data for duplication: ${questId}`);
      }
      
      const duplicate: QuestData = {
        ...JSON.parse(JSON.stringify(original)), // Deep clone
        id: newId,
        questName: `${(original as QuestData).questName} (Copy)`
      };

      quests[newId] = duplicate;

      // Save quests.json
      const updatedArray = recordToArray(quests);
      const writeResult = await window.electronAPI.writeTextFile(
        questsPath,
        JSON.stringify(updatedArray, null, 2)
      );

      if (!writeResult.success) {
        throw new Error(`Failed to duplicate quest: ${writeResult.error}`);
      }

      console.log(`Duplicated quest ${questId} to ${newId}`);
      return newId;
    } catch (error) {
      console.error('Error duplicating quest:', error);
      throw error;
    }
  }, [currentProject]);

  const saveTabOrder = useCallback(async (newTabOrder: TabType[]) => {
    if (!currentProject || !isElectron || !window.electronAPI) {
      throw new Error('No active project');
    }

    try {
      const configPath = `${currentProject}/config.json`;
      const configResult = await window.electronAPI.readTextFile(configPath);
      
      if (!configResult.success) {
        throw new Error(`Failed to read config: ${configResult.error}`);
      }

      const config: ProjectConfig = JSON.parse(configResult.data);
      config.tabOrder = newTabOrder;
      config.lastModified = new Date().toISOString();

      const writeResult = await window.electronAPI.writeTextFile(
        configPath,
        JSON.stringify(config, null, 2)
      );

      if (!writeResult.success) {
        throw new Error(`Failed to save tab order: ${writeResult.error}`);
      }

      setTabOrder(newTabOrder);
      console.log('Tab order saved:', newTabOrder);
    } catch (error) {
      console.error('Error saving tab order:', error);
      throw error;
    }
  }, [currentProject]);

  return {
    currentProject,
    projectName,
    gfxFolder,
    pubDirectory,
    tabOrder,
    createProject,
    selectProject,
    deleteProject,
    updateProjectSettings,
    saveTabOrder,
    setCurrentProject,
    setGfxFolder,
    setPubDirectory,
    createQuest,
    updateQuest,
    deleteQuest,
    importQuest,
    exportQuest,
    duplicateQuest
  };
};
