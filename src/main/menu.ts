import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import type { MenuCommand } from '../shared/ipc'

export function buildMenu(send: (command: MenuCommand) => void, checkForUpdates: () => void): void {
  const item = (label: string, command: MenuCommand, accelerator?: string): MenuItemConstructorOptions => ({ label, accelerator, click: () => send(command) })
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { label: 'Check for Updates…', click: checkForUpdates },
        { type: 'separator' },
        item('Settings…', 'settings', 'CmdOrCtrl+,'),
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { label: 'File', submenu: [item('New Todo', 'new-todo', 'CmdOrCtrl+N'), item('New Event', 'new-event', 'Shift+CmdOrCtrl+N'), { type: 'separator' }, { role: 'close' }] },
    {
      label: 'Edit',
      submenu: [
        item('Undo', 'undo', 'CmdOrCtrl+Z'),
        item('Redo', 'redo', 'Shift+CmdOrCtrl+Z'),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        item('Week', 'view-week', 'CmdOrCtrl+1'),
        item('Month', 'view-month', 'CmdOrCtrl+2'),
        item('Review', 'view-review', 'CmdOrCtrl+3'),
        { type: 'separator' },
        item('Today', 'today', 'CmdOrCtrl+T'),
        item('Previous', 'previous', 'CmdOrCtrl+['),
        item('Next', 'next', 'CmdOrCtrl+]'),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
