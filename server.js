const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ properties: [], activity: [] }));

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // 1. API ROUTES (Simulating api.php)
    if (req.url.startsWith('/api.php')) {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const action = urlParams.get('action');

        // GET DATA
        if (action === 'getData' && req.method === 'GET') {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(data);
        }

        // SAVE DATA
        if (action === 'saveData' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                fs.writeFileSync(DATA_FILE, body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true }));
            });
            return;
        }

        // UPLOAD IMAGE (Simple multipart simulation)
        if (action === 'uploadImage' && req.method === 'POST') {
            let body = Buffer.alloc(0);
            req.on('data', chunk => body = Buffer.concat([body, chunk]));
            req.on('end', () => {
                // Extremely primitive multipart parsing just for local testing the blob
                const boundary = req.headers['content-type'].split('boundary=')[1];
                const parts = body.toString('binary').split(boundary);
                let savedUrl = '';

                for (let part of parts) {
                    if (part.includes('filename="')) {
                        const fileMatch = part.match(/filename="(.*?)"/);
                        if (fileMatch) {
                            const ext = path.extname(fileMatch[1]) || '.png';
                            const newName = 'img_' + Date.now() + ext;

                            // Extract just the actual file data (strip headers)
                            const headerEnd = part.indexOf('\r\n\r\n') + 4;
                            const fileData = part.substring(headerEnd, part.lastIndexOf('\r\n--'));

                            fs.writeFileSync(path.join(UPLOADS_DIR, newName), fileData, 'binary');
                            savedUrl = 'uploads/' + newName;
                            break;
                        }
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ url: savedUrl }));
            });
            return;
        }
    }

    // 2. STATIC FILE SERVER
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath).toLowerCase();

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(content, ext === '.json' ? 'utf8' : 'binary');
        }
    });
});

server.listen(PORT, () => console.log(`Test server running at http://localhost:${PORT}`));
