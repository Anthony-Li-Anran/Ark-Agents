/**
 * File Manager Module
 * Handles desktop file organization for Texas character
 */

const { ipcMain } = require('electron');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class FileManager {
    constructor() {
        this.isOrganizing = false;
        this.setupIPC();
    }

    setupIPC() {
        ipcMain.handle('file-manager-get-desktop-path', async () => {
            return this.getDesktopPath();
        });

        ipcMain.handle('file-manager-get-selected-files', async () => {
            return await this.getSelectedFiles();
        });

        ipcMain.handle('file-manager-get-desktop-files', async () => {
            return await this.getDesktopFiles();
        });

        ipcMain.handle('file-manager-organize-files', async (event, files) => {
            return await this.organizeFiles(files);
        });
    }

    getDesktopPath() {
        const homePath = process.env.USERPROFILE || process.env.HOME;
        return path.join(homePath, 'Desktop');
    }

    async getSelectedFiles() {
        return new Promise((resolve) => {
            const psScript = `$ErrorActionPreference = 'SilentlyContinue'; $shell = New-Object -ComObject Shell.Application; $desktopPath = [Environment]::GetFolderPath('Desktop'); $selected = @(); $windows = $shell.Windows(); for ($i = 0; $i -lt $windows.Count; $i++) { $w = $windows.Item($i); try { $loc = $w.LocationURL; if ($loc -match 'Desktop' -or $w.FullName -match 'explorer.exe') { $items = $w.Document.SelectedItems(); for ($j = 0; $j -lt $items.Count; $j++) { $selected += $items.Item($j).Path } } } catch {} } if ($selected.Count -eq 0) { $desktop = $shell.Namespace(0x0); $folderItems = $desktop.Items(); for ($k = 0; $k -lt $folderItems.Count; $k++) { $item = $folderItems.Item($k); if ($item.IsFolder -eq $false) { $selected += $item.Path } } } if ($selected.Count -gt 0) { $selected | Where-Object { $_ -ne '' } | Join-String -Separator '|' } else { '' }`;
            
            console.log('[FileManager] Running PowerShell to get selected files...');
            
            const ps = spawn('powershell', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-Command', psScript
            ]);
            
            let stdout = '';
            let stderr = '';
            
            ps.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            ps.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            ps.on('close', (code) => {
                console.log('[FileManager] PowerShell exit code:', code);
                console.log('[FileManager] PowerShell stdout:', stdout);
                if (stderr) console.log('[FileManager] PowerShell stderr:', stderr);
                
                if (code !== 0) {
                    resolve({ success: false, error: stderr || `Exit code: ${code}`, files: [] });
                    return;
                }
                
                const output = stdout.trim();
                if (!output) {
                    resolve({ success: true, files: [], message: 'No files selected' });
                    return;
                }
                
                const files = output.split('|').filter(f => f && f.trim());
                console.log('[FileManager] Found files:', files);
                resolve({ success: true, files });
            });
            
            ps.on('error', (error) => {
                console.error('[FileManager] Spawn error:', error);
                resolve({ success: false, error: error.message, files: [] });
            });
        });
    }

    async getDesktopFiles() {
        return new Promise((resolve) => {
            const desktopPath = this.getDesktopPath();
            
            try {
                const files = fs.readdirSync(desktopPath)
                    .map(name => {
                        const fullPath = path.join(desktopPath, name);
                        try {
                            const stats = fs.statSync(fullPath);
                            return {
                                name,
                                path: fullPath,
                                isDirectory: stats.isDirectory(),
                                extension: path.extname(name).toLowerCase()
                            };
                        } catch {
                            return null;
                        }
                    })
                    .filter(f => f !== null);

                resolve({ success: true, files, desktopPath });
            } catch (error) {
                resolve({ success: false, error: error.message, files: [] });
            }
        });
    }

    getFileCategory(extension) {
        const categories = {
            'Documents': ['.doc', '.docx', '.pdf', '.txt', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.rtf', '.csv', '.md'],
            'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff'],
            'Videos': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'],
            'Music': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
            'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'],
            'Code': ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.html', '.css', '.json', '.xml']
        };

        for (const [category, extensions] of Object.entries(categories)) {
            if (extensions.includes(extension.toLowerCase())) {
                return category;
            }
        }

        return 'Others';
    }

    async organizeFiles(files) {
        const desktopPath = this.getDesktopPath();
        const results = {
            success: true,
            moved: [],
            errors: [],
            categories: {}
        };

        for (const filePath of files) {
            try {
                if (!fs.existsSync(filePath)) {
                    results.errors.push({ file: filePath, error: 'File not found' });
                    continue;
                }

                const fileName = path.basename(filePath);
                const extension = path.extname(fileName).toLowerCase();
                const category = this.getFileCategory(extension);

                if (!results.categories[category]) {
                    results.categories[category] = [];
                }

                const categoryFolder = path.join(desktopPath, category);
                if (!fs.existsSync(categoryFolder)) {
                    fs.mkdirSync(categoryFolder, { recursive: true });
                }

                let destPath = path.join(categoryFolder, fileName);
                
                if (fs.existsSync(destPath)) {
                    const baseName = path.basename(fileName, extension);
                    const timestamp = Date.now();
                    destPath = path.join(categoryFolder, `${baseName}_${timestamp}${extension}`);
                }

                fs.renameSync(filePath, destPath);
                
                results.moved.push({
                    from: filePath,
                    to: destPath,
                    category
                });
                results.categories[category].push(fileName);

            } catch (error) {
                results.errors.push({ file: filePath, error: error.message });
            }
        }

        return results;
    }
}

module.exports = { FileManager };
