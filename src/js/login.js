const {
  contextBridge,
  ipcRenderer,
} = require('electron');

window.addEventListener('DOMContentLoaded', function() {
  // check login
  ;(function() {
    function sendMsg(channel, req) {
      ipcRenderer.send(channel, null, req);
    }
    function getCurrentURL() {
      return window.location.href;
    }
    function getCurrentCookies() {
      return document.cookie.split(';').map(function(item) {
        return {
          key: item.split("=")[0].trim(),
          value: item.split("=")[1].trim(),
        }
      });
    }
    async function isLoggedIn() {
      return getCurrentURL() === "https://x.com/home";
    }
    const interval = setInterval(async function() {
      if (await isLoggedIn()) {
        sendMsg("login", true);
        clearInterval(interval);
      } else {
        sendMsg("show-login");
      }
    }, 1000);
  })();
});

// window.electron 
contextBridge.exposeInMainWorld('electron', {
  getProcess: function() {
    return {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron,
    }
  },
  /**
   * 
   * @param {string} channel 
   * @param {any} req 
   */
  sendMsg: function(channel, req) {
    ipcRenderer.send(channel, null, req);
  },
  /**
   * 
   * @param {string} channel 
   * @param {error} err 
   */
  sendErr: function(channel, err) {
    ipcRenderer.send(channel, err);
  },
  /**
   * 
   * @param {string} channel 
   * @param {function} listener 
   */
  getMsg: function(channel, listener) {
    ipcRenderer.on(channel, function(event, err, req) {
      return listener(err, req, event);
    });
  },
  /**
   * 
   * @param {string} channel 
   * @param {any} req 
   * @returns {Promise<any>}
   */
  waitMsg: function(channel, req) {
    return new Promise(function(resolve, reject) {
      ipcRenderer.invoke(channel, req)
        .then(function(res) {
          if (typeof res === "object" && res.stack && res.message) {
            reject(res);
          } else {
            resolve(res);
          }
        });
    });
  },
});