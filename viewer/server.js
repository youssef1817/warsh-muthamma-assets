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
            res.writeHead(200, { 'Content-Type': contentType });
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
