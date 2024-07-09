`use strict`;

import { app, BrowserWindow, ipcMain, screen, dialog, Menu, } from "electron";

// Process
const PROCESS_ID = process.pid;
const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const IS_LINUX = process.platform === 'linux';
const APP_NAME = app.name;
const APP_PATH = {
  APP: app.getPath("appData"),
  HOME: app.getPath("home"),
  USER: app.getPath("userData"),
  SESSION: app.getPath("sessionData"),
  TEMP: app.getPath("temp"),
  EXE: app.getPath("exe"),
  MODULE: app.getPath("module"),
  DESKTOP: app.getPath("desktop"),
  DOCUMENTS: app.getPath("documents"),
  DOWNLOADS: app.getPath("downloads"),
  PICTURES: app.getPath("pictures"),
  VIDEOS: app.getPath("videos"),
  MUSIC: app.getPath("music"),
  LOGS: app.getPath("logs"),
  DUMPS: app.getPath("crashDumps"),
};

async function alert(title, message) {
  await dialog.showMessageBox({
    title: message ? title : undefined,
    message: message ? message : title,
  });
}

async function confirm(title, message) {
  const { response } = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Yes', 'No'],
    cancelId: 1,
    defaultId: 0,
    title: message ? title : message,
    detail: message ? message : undefined,
  });

  return response === 0;
}

function createMenu() {
  const template = IS_MAC ? {
    // mac
    [app.name]: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ],
    File: [
      { role: 'close' }
    ],
    Edit: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { role: 'delete' },
      { role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Speech',
        submenu: [
          { role: 'startSpeaking' },
          { role: 'stopSpeaking' }
        ]
      }
    ],
    View: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ],
    Window: [
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' },
      { type: 'separator' },
      { role: 'window' }
    ],
    Help: [
      {
        label: 'Learn More',
        accelerator: "Cmd + H",
        click: async function() {
          const { shell } = require('electron');
          await shell.openExternal('https://electronjs.org')
        }
      }
    ]
  } : {
    // windows
    File: [
      { role: 'quit' }
    ],
    Edit: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'delete' },
      { type: 'separator' },
      { role: 'selectAll' }
    ],
    View: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ],
    Window: [
      { role: 'minimize' },
      { role: 'zoom' },
      { role: 'close' }
    ],
    Help: [
      {
        label: 'Learn More',
        accelerator: "Ctrl + H",
        click: async function() {
          const { shell } = require('electron');
          await shell.openExternal('https://electronjs.org')
        }
      }
    ]
  };
  
  const tmp = [];
  for (const label of Object.keys(template)) {
    tmp.push({
      label: label,
      submenu: template[label],
    });
  }
  
  const menu = Menu.buildFromTemplate(tmp);

  return menu;
}

function setMenu(menu) {
  Menu.setApplicationMenu(menu); 
}

function getDisplay() {
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.workArea; // { x, y, width, height }
}

export {
  PROCESS_ID,
  APP_NAME,
  APP_PATH,
  IS_MAC,
  IS_WIN,
  IS_LINUX,
  alert,
  confirm,
  createMenu,
  setMenu,
  getDisplay,
}