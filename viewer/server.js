const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const ROOT_DIR = path.join(__dirname, '..'); 

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/api/save-json' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const absolutePath = path.resolve(ROOT_DIR, data.filepath);
                
                const allowedBase = path.resolve(ROOT_DIR, 'databases', 'ayahinfo', 'warsh_muthamma');
                if (!absolutePath.startsWith(allowedBase)) {
                    res.writeHead(403);
                    return res.end(JSON.stringify({ error: 'Forbidden path' }));
                }

                fs.writeFileSync(absolutePath, JSON.stringify(data.content, null, 2), 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error("Save error:", err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (req.url === '/api/batch-pad-highlights' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { padLeft, padRight } = JSON.parse(body);
                const pagesDir = path.resolve(ROOT_DIR, 'databases', 'ayahinfo', 'warsh_muthamma', 'pages_json');
                
                if (!fs.existsSync(pagesDir)) {
                    res.writeHead(404);
                    return res.end(JSON.stringify({ error: 'pages_json directory not found' }));
                }

                const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.json'));
                let modifiedCount = 0;

                for (const file of files) {
                    const filepath = path.join(pagesDir, file);
                    let content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                    let changed = false;

                    if (content.ayah_highlights && Array.isArray(content.ayah_highlights)) {
                        content.ayah_highlights.forEach(h => {
                            if (padLeft !== 0) {
                                h.left = Math.max(0, h.left - padLeft);
                                changed = true;
                            }
                            if (padRight !== 0) {
                                h.right = Math.min(1, h.right + padRight);
                                changed = true;
                            }
                        });
                    }

                    if (changed) {
                        fs.writeFileSync(filepath, JSON.stringify(content, null, 2), 'utf8');
                        modifiedCount++;
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filesModified: modifiedCount }));
            } catch (err) {
                console.error("Batch pad error:", err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (req.url === '/api/batch-adjust-first-last-lines' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { padFirstTop, padLastBottom } = JSON.parse(body);
                const layoutDir = path.resolve(ROOT_DIR, 'databases', 'ayahinfo', 'warsh_muthamma', 'page_layout_json');
                
                if (!fs.existsSync(layoutDir)) {
                    res.writeHead(404);
                    return res.end(JSON.stringify({ error: 'page_layout_json directory not found' }));
                }

                const files = fs.readdirSync(layoutDir).filter(f => f.endsWith('.json'));
                let modifiedCount = 0;

                for (const file of files) {
                    const filepath = path.join(layoutDir, file);
                    let content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                    let changed = false;

                    if (content.lineBands && Array.isArray(content.lineBands) && content.lineBands.length > 0) {
                        const first = content.lineBands[0];
                        const last = content.lineBands[content.lineBands.length - 1];

                        if (padFirstTop !== 0) {
                            first.top = Math.max(0, first.top - padFirstTop);
                            first.center = Math.round((first.top + first.bottom) / 2);
                            changed = true;
                        }

                        if (padLastBottom !== 0) {
                            last.bottom = last.bottom + padLastBottom;
                            last.center = Math.round((last.top + last.bottom) / 2);
                            changed = true;
                        }
                    }

                    if (changed) {
                        fs.writeFileSync(filepath, JSON.stringify(content, null, 2), 'utf8');
                        modifiedCount++;
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filesModified: modifiedCount }));
            } catch (err) {
                console.error("Batch first-last layout adjustment error:", err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (req.url === '/api/progress' && req.method === 'GET') {
        try {
            const progressPath = path.resolve(ROOT_DIR, 'databases', 'ayahinfo', 'warsh_muthamma', 'progress.json');
            let progress = [];
            if (fs.existsSync(progressPath)) {
                progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ progress }));
        } catch (err) {
            console.error("GET progress error:", err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    if (req.url === '/api/progress/toggle' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const progressPath = path.resolve(ROOT_DIR, 'databases', 'ayahinfo', 'warsh_muthamma', 'progress.json');
                let progress = [];
                if (fs.existsSync(progressPath)) {
                    progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
                }
                
                if (data.pages && Array.isArray(data.pages)) {
                    const forceState = data.forceState;
                    data.pages.forEach(p => {
                        const index = progress.indexOf(p);
                        if (forceState === true && index === -1) {
                            progress.push(p);
                        } else if (forceState === false && index !== -1) {
                            progress.splice(index, 1);
                        } else if (forceState === undefined) {
                            if (index !== -1) progress.splice(index, 1);
                            else progress.push(p);
                        }
                    });
                    progress.sort((a, b) => a - b);
                } else if (data.page) {
                    const page = data.page;
                    const index = progress.indexOf(page);
                    if (index !== -1) {
                        progress.splice(index, 1);
                    } else {
                        progress.push(page);
                        progress.sort((a, b) => a - b);
                    }
                }

                fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, progress }));
            } catch (err) {
                console.error("POST progress toggle error:", err);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (req.url === '/api/sync' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { page, skipWindows, skipAndroid } = JSON.parse(body);
                const { spawn } = require('child_process');
                
                const psScript = path.resolve(ROOT_DIR, 'tools', 'sync_warsh_muthamma_ayahinfo.ps1');
                const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript];
                
                if (page === 'all') {
                    args.push('-All');
                } else {
                    args.push('-Page', String(page));
                }
                
                if (skipWindows) args.push('-SkipWindows');
                if (skipAndroid) args.push('-SkipAndroid');
                
                res.writeHead(200, {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Transfer-Encoding': 'chunked',
                    'Cache-Control': 'no-cache'
                });
                const syncProcess = spawn('powershell', args);
                
                res.on('close', () => {
                    if (!res.writableEnded && syncProcess) {
                        syncProcess.kill();
                    }
                });

                syncProcess.stdout.on('data', data => { 
                    if (!res.writableEnded && !res.destroyed) res.write(data.toString()); 
                });
                syncProcess.stderr.on('data', data => { 
                    if (!res.writableEnded && !res.destroyed) res.write(data.toString()); 
                });
                
                syncProcess.on('close', code => {
                    if (!res.writableEnded && !res.destroyed) {
                        res.end(`\n\n[PROCESS_EXIT_CODE:${code}]`);
                    }
                });
            } catch (err) {
                console.error("POST sync error:", err);
                if (!res.headersSent) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: err.message }));
                } else {
                    res.end(`\n\n[ERROR: ${err.message}]`);
                }
            }
        });
        return;
    }

    let reqUrl = req.url.split('?')[0]; 
    let filePath = path.join(ROOT_DIR, reqUrl);
    
    if (reqUrl === '/') {
        res.writeHead(302, { 'Location': '/viewer/' });
        res.end();
        return;
    }
    
    if (reqUrl === '/viewer' || reqUrl === '/viewer/') {
        filePath = path.join(ROOT_DIR, 'viewer', 'index.html');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end(`File not found: ${reqUrl}`);
            } else {
                res.writeHead(500);
                res.end(`Server error: ${err.code}`);
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==============================================`);
    console.log(`🚀 Quran Viewer & Editor Server is running`);
    console.log(`👉 http://localhost:${PORT}/viewer/`);
    console.log(`==============================================\n`);
});
