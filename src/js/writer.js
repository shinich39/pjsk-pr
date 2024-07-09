const {
  contextBridge,
  ipcRenderer,
} = require('electron');

const TIMEOUT = 1000 * 20; // 20s

window.addEventListener('DOMContentLoaded', async function() {
  let tweetButton = document.querySelector("button[data-testid='tweetButton']"),
      startedAt = Date.now();
  while(!tweetButton) {
    if (Date.now() - startedAt > TIMEOUT) {
      sendErr("write", new Error("WriteError"));
      return;
    }

    await wait(256);
    tweetButton = document.querySelector("button[data-testid='tweetButton']");
  }

  tweetButton.click();
  await wait(512);

  let currentURL = getCurrentURL();
  while(currentURL !== 'https://x.com/home') {
    if (Date.now() - startedAt > TIMEOUT) {
      sendErr("write", new Error("WriteError"));
      return;
    }

    await wait(256);
    currentURL = getCurrentURL();
  }

  sendMsg("write");
});

function sendMsg(channel, req) {
  ipcRenderer.send(channel, null, req);
}

function sendErr(channel, err) {
  ipcRenderer.send(channel, err);
}

function getMsg(channel, listener) {
  ipcRenderer.on(channel, function(event, err, req) {
    return listener(err, req, event);
  });
}

function getCurrentURL() {
  return window.location.href;
}

function wait(delay) {
  return new Promise(function(resolve) {
    return setTimeout(resolve, delay);
  });
}