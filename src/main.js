`use strict`;

import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  dialog,
  Menu,
  shell,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from 'node:url';
import { EventEmitter } from "node:events";
import {
  APP_NAME,
  APP_PATH,
  IS_LINUX,
  IS_MAC,
  IS_WIN,
  alert,
  confirm,
  createMenu,
  setMenu,
  getDisplay,
} from "./js/electron-util.js";

// ESM file path fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Change max concurrent event count.
// default: 10
// EventEmitter.defaultMaxListeners = 10;

const READ_URLS = [
  `https://x.com/hashtag/%E3%83%97%E3%83%AD%E3%82%BB%E3%82%AB%E5%8B%9F%E9%9B%86?src=hashtag_click&f=live`,
  `https://x.com/hashtag/%E3%83%97%E3%83%AD%E3%82%BB%E3%82%AB%E5%8D%94%E5%8A%9B?src=hashtag_click&f=live`,
  // `https://x.com/hashtag/${encodeURIComponent("プロセカ募集")}?src=hashtag_click&f=live`,
  // `https://x.com/hashtag/${encodeURIComponent("プロセカ協力")}?src=hashtag_click&f=live`
];

// const TEST_URL = `https://x.com/intent/post?text=${encodeURIComponent("Lorem ipsum")}`;
const WRITE_URL = "https://x.com/intent/post?hashtags=%E3%83%97%E3%83%AD%E3%82%BB%E3%82%AB%E5%8B%9F%E9%9B%86,%E3%83%97%E3%83%AD%E3%82%BB%E3%82%AB%E5%8D%94%E5%8A%9B&text=";
const DEBUG = false;

if (!DEBUG) {
  Menu.setApplicationMenu(false);
}

let mainWindow, 
    collectorWindow,
    writerWindow,
    updaterWindow,
    isInitialized = false,
    isLoggedIn = false,
    loginInterval;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 1024,
    webPreferences: {
      preload: path.join(__dirname, 'js', 'preload.js'),
      worldSafeExecuteJavaScript: true,
      // https://www.electronjs.org/docs/latest/tutorial/security
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL('https://x.com/home');
  // mainWindow.webContents.openDevTools();

  // Set event listeners.
  mainWindow.webContents.on("did-finish-load", onWindowLoad);
  mainWindow.webContents.on("close", onWindowClose);

  return mainWindow;
}

function createCollectorWindow() {
  collectorWindow = new BrowserWindow({
    width: 1200,
    height: 1024,
    webPreferences: {
      preload: path.join(__dirname, 'js', 'collector.js'),
      worldSafeExecuteJavaScript: true,
      // https://www.electronjs.org/docs/latest/tutorial/security
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: DEBUG,
  });
  collectorWindow.loadURL(READ_URLS[0]);
  // collectorWindow.webContents.openDevTools();
}

function createWriterWindow(url) {
  return new Promise(function(resolve, reject) {
    writerWindow = new BrowserWindow({
      width: 1024,
      height: 1024,
      webPreferences: {
        preload: path.join(__dirname, 'js', 'writer.js'),
        worldSafeExecuteJavaScript: true,
        // https://www.electronjs.org/docs/latest/tutorial/security
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: DEBUG,
    });
    writerWindow.loadURL(url);
    // writerWindow.webContents.openDevTools();
    writerWindow.webContents.on("did-finish-load", resolve);
  });
}

function closeWriterWindow() {
  if (writerWindow) {
    writerWindow.close();
    writerWindow = null;
  }
}

function createUpdaterWindow(url) {
  return new Promise(function(resolve, reject) {
    updaterWindow = new BrowserWindow({
      width: 1024,
      height: 1024,
      webPreferences: {
        preload: path.join(__dirname, 'js', 'update.js'),
        worldSafeExecuteJavaScript: true,
        // https://www.electronjs.org/docs/latest/tutorial/security
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: DEBUG,
    });
    updaterWindow.loadURL(url);
    // updaterWindow.webContents.openDevTools();
    updaterWindow.webContents.on("did-finish-load", resolve);
  });
}

function closeUpdaterWindow() {
  if (updaterWindow) {
    updaterWindow.close();
    updaterWindow = null;
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // if (process.platform !== 'darwin') {
  //   app.quit();
  // }

  app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


/**
 * 
 */
function onWindowLoad() {
  console.log(`${APP_NAME} window loaded.`);

  if (!isLoggedIn && !isInitialized) {
    loginInterval = setInterval(function() {
      sendMsg("chk-login");
    }, 1000);

    isInitialized = true;
  }
}
/**
 * 
 */
function onWindowClose() {
  console.log(`${APP_NAME} window closed.`);

  app.quit();
}
/**
 * 
 * @param {string} channel 
 * @param {any} req 
 */
function sendMsg(channel, req) {
  mainWindow.webContents.send(channel, null, req);
}
/**
 * 
 * @param {string} channel 
 * @param {error} err 
 */
function sendErr(channel, err) {
  mainWindow.webContents.send(channel, err);
}
/**
 * 
 * @param {string} channel 
 * @param {function} listener err, req, event
 */
function getMsg(channel, listener) {
  ipcMain.on(channel, function(event, err, req) {
    return listener(err, req, event);
  });
}
/**
 * 
 * @param {string} channel 
 * @param {function} listener err, req | error, event
 */
function waitMsg(channel, listener) {
  ipcMain.handle(channel, function(event, req) {
    const isError = typeof req === "object" && req.stack && req.message;
    if (isError) {
      return listener(req, null, event);
    } else {
      return listener(null, req, event);
    }
  });
}

getMsg("open-git", function(err, msg) {
  if (err) {
    console.error(err);
    return;
  }
  shell.openExternal("https://github.com/shinich39/pjsk-pr");
});

getMsg("login", function(err, msg) {
  if (err) {
    console.error(err);
    return;
  }

  if (msg) {
    console.log("twitter login successful.");
    clearInterval(loginInterval);
    isLoggedIn = true;
    mainWindow.loadFile('src/views/index.html');
    createCollectorWindow();
  }
});

getMsg("collect", function(err, msg) {
  if (err) {
    console.error(err);
    return;
  }
  sendMsg("collect", msg);
});

getMsg("set-collector", function(err, msg) {
  if (err) {
    console.error(err);
    return;
  }
  if (collectorWindow && collectorWindow.webContents) {
    collectorWindow.webContents.send("set-collector", null, msg);
  }
});

getMsg("write-post", async function(err, msg) {
  if (err) {
    console.error(err);
    return;
  }
  await createWriterWindow(`${WRITE_URL}${encodeURIComponent(msg)}`);
});

getMsg("update-post", async function(err, msg) {
  if (err) {
    console.error(err);
    return;
  }
  await createUpdaterWindow(`${WRITE_URL}${encodeURIComponent(msg)}`);
});

getMsg("write", async function(err, msg) {
  closeWriterWindow();
  
  if (err) {
    console.error(err);
    sendErr("write", err);
  } else {
    sendMsg("write");
  }
});

getMsg("update", async function(err, msg) {
  closeUpdaterWindow();
  
  if (err) {
    console.error(err);
    sendErr("update", err);
  } else {
    sendMsg("update");
  }
});

getMsg("debug", function(err, msg) {
  if (err) {
    console.error(err);
    return;
  }
  if (collectorWindow.isVisible()) {
    collectorWindow.hide();
  } else {
    collectorWindow.show();
  }
});

getMsg("console", function(err, msg) {
  if (err) {
    console.error(err);
    return;
  }
  if (mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.closeDevTools();
  } else {
    mainWindow.webContents.openDevTools();
  }
  if (collectorWindow.webContents.isDevToolsOpened()) {
    collectorWindow.webContents.closeDevTools();
  } else {
    collectorWindow.webContents.openDevTools();
  }
});