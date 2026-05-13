/**
 * Texas File Manager Test
 *
 * Verifies file organization read/write behavior in an isolated temp desktop.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function loadWithElectronStub(request, parent, isMain) {
    if (request === 'electron') {
        return {
            ipcMain: {
                handle() {}
            }
        };
    }
    return originalLoad.apply(this, arguments);
};

const { FileManager } = require('./Texas/src/modules/file-manager');

Module._load = originalLoad;

class TempDesktopFileManager extends FileManager {
    constructor(tempDesktopPath) {
        super();
        this.tempDesktopPath = tempDesktopPath;
    }

    getDesktopPath() {
        return this.tempDesktopPath;
    }
}

function makeTempDesktop() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'ark-file-manager-desktop-'));
}

function writeFile(filePath, content = 'test') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

async function testOrganizeFiles() {
    const tempDesktop = makeTempDesktop();
    const incoming = path.join(tempDesktop, 'incoming');
    const report = path.join(incoming, 'report.md');
    const image = path.join(incoming, 'photo.png');
    const script = path.join(incoming, 'tool.js');
    const unknown = path.join(incoming, 'sample.unknown');

    writeFile(report, '# report');
    writeFile(image, 'png');
    writeFile(script, 'console.log("ok");');
    writeFile(unknown, 'unknown');

    const manager = new TempDesktopFileManager(tempDesktop);
    const result = await manager.organizeFiles([report, image, script, unknown]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.moved.length, 4);
    assert.ok(fs.existsSync(path.join(tempDesktop, 'Documents', 'report.md')));
    assert.ok(fs.existsSync(path.join(tempDesktop, 'Images', 'photo.png')));
    assert.ok(fs.existsSync(path.join(tempDesktop, 'Code', 'tool.js')));
    assert.ok(fs.existsSync(path.join(tempDesktop, 'Others', 'sample.unknown')));
}

async function testDuplicateNameHandling() {
    const tempDesktop = makeTempDesktop();
    const incoming = path.join(tempDesktop, 'incoming');
    const first = path.join(incoming, 'notes.txt');
    const second = path.join(incoming, 'notes-copy.txt');

    writeFile(path.join(tempDesktop, 'Documents', 'notes.txt'), 'existing');
    writeFile(first, 'new');
    writeFile(second, 'copy');

    const manager = new TempDesktopFileManager(tempDesktop);
    const result = await manager.organizeFiles([first, second]);

    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(result.moved.length, 2);
    assert.ok(result.moved.some((item) => item.to.includes('notes_') && item.to.endsWith('.txt')));
    assert.ok(fs.existsSync(path.join(tempDesktop, 'Documents', 'notes-copy.txt')));
}

async function testMissingFileError() {
    const tempDesktop = makeTempDesktop();
    const missing = path.join(tempDesktop, 'missing.pdf');
    const manager = new TempDesktopFileManager(tempDesktop);
    const result = await manager.organizeFiles([missing]);

    assert.strictEqual(result.moved.length, 0);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0].error, 'File not found');
}

async function main() {
    await testOrganizeFiles();
    await testDuplicateNameHandling();
    await testMissingFileError();
    console.log('Texas file manager test passed.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
