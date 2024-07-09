const {
  contextBridge,
  ipcRenderer,
} = require('electron');

window.addEventListener('DOMContentLoaded', function() {
  // DOM loaded...
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
  sendMsg: function(channel, req) {
    ipcRenderer.send(channel, null, req);
  },
  sendErr: function(channel, err) {
    ipcRenderer.send(channel, err);
  },
  getMsg: function(channel, listener) {
    ipcRenderer.on(channel, function(event, err, req) {
      return listener(err, req, event);
    });
  },
  // callback
  // waitMsg: function(channel, req, listener) {
  //   ipcRenderer.invoke(channel, req)
  //     .then(function(res) {
  //       if (typeof res === "object" && res.stack && res.message) {
  //         return listener(res, null);
  //       } else {
  //         return listener(null, res);
  //       }
  //     })
  //     .catch(function(err) {
  //       return listener(err, null);
  //     })
  // },
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