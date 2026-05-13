/**
 * Amiya Software Monitoring Test
 *
 * Verifies local AI software/service monitoring without requiring real Ollama
 * or LM Studio processes on the user's machine.
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function loadWithElectronStub(request, parent, isMain) {
    if (request === 'electron') {
        return {
            ipcMain: {
                handle() {}
            },
            dialog: {
                async showOpenDialog() {
                    return { canceled: true, filePaths: [] };
                }
            },
            shell: {
                async openExternal() {}
            }
        };
    }
    return originalLoad.apply(this, arguments);
};

const { AIConfigManager } = require('./Amiya/src/modules/ai/ai-config');

Module._load = originalLoad;

function makeTempAppData() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'ark-ai-monitor-'));
}

function startJsonServer(routes) {
    return new Promise((resolve) => {
        const server = http.createServer((request, response) => {
            const route = routes[request.url];
            if (!route) {
                response.writeHead(404, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'not found' }));
                return;
            }

            response.writeHead(route.status || 200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(route.body));
        });

        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({
                server,
                endpoint: `http://127.0.0.1:${port}`
            });
        });
    });
}

async function withServer(routes, testFn) {
    const { server, endpoint } = await startJsonServer(routes);
    try {
        await testFn(endpoint);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function testConfigReadWrite() {
    const manager = new AIConfigManager(makeTempAppData());

    assert.strictEqual(manager.getConfig().provider, 'ollama');
    assert.strictEqual(manager.updateConfig({
        provider: 'lmstudio',
        endpoint: 'http://127.0.0.1:1234///',
        model: 'local-model '
    }), true);

    const saved = manager.getConfig();
    assert.strictEqual(saved.provider, 'lmstudio');
    assert.strictEqual(saved.endpoint, 'http://127.0.0.1:1234');
    assert.strictEqual(saved.model, 'local-model');
}

async function testOllamaConnectionMonitoring() {
    await withServer({
        '/api/tags': {
            body: {
                models: [
                    { name: 'qwen2.5:7b', size: '4.7GB' }
                ]
            }
        }
    }, async (endpoint) => {
        const manager = new AIConfigManager(makeTempAppData());
        const success = await manager.testConnection({
            provider: 'ollama',
            endpoint,
            model: 'qwen2.5:7b'
        });
        assert.strictEqual(success.success, true);
        assert.strictEqual(success.models.length, 1);

        const missing = await manager.testConnection({
            provider: 'ollama',
            endpoint,
            model: 'missing-model'
        });
        assert.strictEqual(missing.success, false);
        assert.ok(missing.message.includes('missing-model'));
        assert.strictEqual(missing.models.length, 1);
    });
}

async function testOpenAICompatibleMonitoring() {
    await withServer({
        '/models': {
            body: {
                data: [
                    { id: 'local-chat-model' }
                ]
            }
        }
    }, async (endpoint) => {
        const manager = new AIConfigManager(makeTempAppData());
        const result = await manager.testConnection({
            provider: 'custom',
            endpoint,
            model: 'local-chat-model',
            apiKey: 'test-key'
        });

        assert.strictEqual(result.success, true);
    });
}

function testModelParsingAndProgress() {
    const manager = new AIConfigManager(makeTempAppData());
    const models = manager.parseOllamaList([
        'NAME              ID              SIZE      MODIFIED',
        'qwen2.5:7b        abc123          4.7 GB    2 days ago',
        'deepseek-r1:8b    def456          5.2 GB    1 hour ago'
    ].join('\n'));

    assert.strictEqual(models.length, 2);
    assert.strictEqual(models[0].name, 'qwen2.5:7b');
    assert.strictEqual(models[1].size, '5.2 GB');

    const progress = manager.parsePullProgress('\u001b[2Kpulling manifest 42%');
    assert.strictEqual(progress.percent, 42);
    assert.strictEqual(progress.status, 'pulling manifest 42%');

    const clamped = manager.parsePullProgress('download 150%');
    assert.strictEqual(clamped.percent, 100);
}

async function main() {
    await testConfigReadWrite();
    await testOllamaConnectionMonitoring();
    await testOpenAICompatibleMonitoring();
    testModelParsingAndProgress();
    console.log('Amiya software monitoring test passed.');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
