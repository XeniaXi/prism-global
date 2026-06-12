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
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.ogg': 'video/ogg'
};

const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv', '.ogg'];

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

        // UPLOAD IMAGE / VIDEO (Simple multipart simulation)
        if ((action === 'uploadImage' || action === 'uploadVideo') && req.method === 'POST') {
            let body = Buffer.alloc(0);
            req.on('data', chunk => body = Buffer.concat([body, chunk]));
            req.on('end', () => {
                // Extremely primitive multipart parsing just for local testing the blob
                const boundary = req.headers['content-type'].split('boundary=')[1];
                const parts = body.toString('binary').split(boundary);
                let savedUrl = '';
                const isVideo = action === 'uploadVideo';

                for (let part of parts) {
                    if (part.includes('filename="')) {
                        const fileMatch = part.match(/filename="(.*?)"/);
                        if (fileMatch) {
                            const ext = (path.extname(fileMatch[1]) || (isVideo ? '.mp4' : '.png')).toLowerCase();
                            const prefix = isVideo ? 'vid_' : 'img_';
                            const newName = prefix + Date.now() + ext;

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
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Range request support — needed for HTML5 <video> seeking / streaming
    if (VIDEO_EXTS.includes(ext) && req.headers.range) {
        fs.stat(filePath, (err, stat) => {
            if (err) {
                res.writeHead(err.code === 'ENOENT' ? 404 : 500);
                return res.end(err.code === 'ENOENT' ? 'File Not Found' : 'Server Error');
            }
            const range = req.headers.range;
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType
            });
            fs.createReadStream(filePath, { start, end }).pipe(res);
        });
        return;
    }

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
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, ext === '.json' ? 'utf8' : 'binary');
        }
    });
});

server.listen(PORT, () => console.log(`Test server running at http://localhost:${PORT}`));
