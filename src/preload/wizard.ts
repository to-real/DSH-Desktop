import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('dshDesktop', {
  wizard: {
    submit: (data: { apiKey: string; workspace: string }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('wizard:submit', data),
    onError: (cb: (msg: string) => void): void => {
      ipcRenderer.on('wizard:error', (_e, msg) => cb(msg))
    },
    pickWorkspace: (): Promise<string | null> => ipcRenderer.invoke('wizard:pick-workspace'),
  },
  engineError: {
    onInfo: (cb: (msg: string) => void): void => {
      ipcRenderer.on('engine-error:info', (_e, msg) => cb(msg))
    },
    restart: (): Promise<void> => ipcRenderer.invoke('engine-error:restart'),
  },
})
