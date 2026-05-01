const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

const CONFIG = require('./config.json');

let mainWindow = null;
let tray = null;

ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
    if (mainWindow) {
        mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
});

function createWindow() {
    const { width, height, transparent, frame, alwaysOnTop, clickThrough } = CONFIG.window;

    mainWindow = new BrowserWindow({
        width,
        height,
        x: 0,
        y: 0,
        transparent,
        frame,
        alwaysOnTop,
        skipTaskbar: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    if (clickThrough) {
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, CONFIG.model.path, `${CONFIG.model.name}.png`);
    let trayIcon = null;

    try {
        trayIcon = nativeImage.createFromPath(iconPath);
        if (!trayIcon || trayIcon.isEmpty()) {
            trayIcon = nativeImage.createEmpty();
        } else {
            trayIcon = trayIcon.resize({ width: 16, height: 16 });
        }
    } catch (error) {
        console.error('Failed to create tray icon:', error);
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示/隐藏',
            click: () => {
                if (mainWindow && mainWindow.isVisible()) {
                    mainWindow.hide();
                } else if (mainWindow) {
                    mainWindow.show();
                }
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Spine Renderer');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow && mainWindow.isVisible()) {
            mainWindow.hide();
        } else if (mainWindow) {
            mainWindow.show();
        }
    });

    tray.on('right-click', () => {
        tray.popUpContextMenu();
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
