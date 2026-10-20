const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('fixdeskNative', {
  platform: process.platform,
  startAgent: code => ipcRenderer.invoke('agent:start', String(code)),
  stopAgent: () => ipcRenderer.invoke('agent:stop'),
});
