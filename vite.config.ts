import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function partiturasPlugin(): Plugin {
  return {
    name: 'partituras-api',
    configureServer(server) {
      const partiturasDir = path.resolve(__dirname, 'partituras');

      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // 1. GET /api/partituras - List all hymns
        if (url === '/api/partituras' && req.method === 'GET') {
          try {
            if (!fs.existsSync(partiturasDir)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }

            const files = fs.readdirSync(partiturasDir);
            const pdfFiles = files.filter((f) => f.toLowerCase().endsWith('.pdf'));

            const items = pdfFiles.map((file) => {
              const fullPath = path.join(partiturasDir, file);
              const stats = fs.statSync(fullPath);

              // Parse name e.g. himno_001_santo_santo_santo.pdf
              const match = file.match(/^himno_(\d+)_(.+)\.pdf$/i);
              let number = '';
              let title = file.replace(/\.pdf$/i, '').replace(/_/g, ' ');

              if (match) {
                number = match[1];
                title = match[2]
                  .split('_')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');
              }

              // Check if .notes.json exists
              const notesJsonPath = path.join(partiturasDir, `${file}.notes.json`);
              let hasSavedNotes = false;
              let savedNotesCount = 0;
              let savedOriginalKey = '';

              if (fs.existsSync(notesJsonPath)) {
                try {
                  const raw = fs.readFileSync(notesJsonPath, 'utf-8');
                  const parsed = JSON.parse(raw);
                  hasSavedNotes = true;
                  savedNotesCount = Array.isArray(parsed.notes) ? parsed.notes.length : 0;
                  savedOriginalKey = parsed.originalKey || '';
                } catch {
                  // ignore corrupt
                }
              }

              return {
                filename: file,
                number: number || '0',
                title: number ? `Himno ${parseInt(number, 10)} - ${title}` : title,
                sizeBytes: stats.size,
                hasSavedNotes,
                savedNotesCount,
                savedOriginalKey,
              };
            });

            // Sort by hymn number
            items.sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(items));
            return;
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
            return;
          }
        }

        // 2. GET /api/partituras/file/:filename - Serve PDF file
        if (url.startsWith('/api/partituras/file/') && req.method === 'GET') {
          const filename = decodeURIComponent(url.replace('/api/partituras/file/', ''));
          const filePath = path.join(partiturasDir, filename);

          if (fs.existsSync(filePath) && filePath.startsWith(partiturasDir)) {
            const stat = fs.statSync(filePath);
            res.writeHead(200, {
              'Content-Type': 'application/pdf',
              'Content-Length': stat.size,
              'Access-Control-Allow-Origin': '*',
            });
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
            return;
          } else {
            res.statusCode = 404;
            res.end('File not found');
            return;
          }
        }

        // 3. GET /api/partituras/data/:filename - Get saved notes JSON
        if (url.startsWith('/api/partituras/data/') && req.method === 'GET') {
          const filename = decodeURIComponent(url.replace('/api/partituras/data/', ''));
          const jsonPath = path.join(partiturasDir, `${filename}.notes.json`);

          if (fs.existsSync(jsonPath) && jsonPath.startsWith(partiturasDir)) {
            const data = fs.readFileSync(jsonPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(data);
            return;
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'No saved notes for this score' }));
            return;
          }
        }

        // 4. POST /api/partituras/save/:filename - Save project notes to disk
        if (url.startsWith('/api/partituras/save/') && req.method === 'POST') {
          const filename = decodeURIComponent(url.replace('/api/partituras/save/', ''));
          const jsonPath = path.join(partiturasDir, `${filename}.notes.json`);

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', () => {
            try {
              // Ensure directory exists
              if (!fs.existsSync(partiturasDir)) {
                fs.mkdirSync(partiturasDir, { recursive: true });
              }
              fs.writeFileSync(jsonPath, body, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, savedAt: Date.now() }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(err) }));
            }
          });
          return;
        }

        // 5. GET /api/partituras/backup - Download all saved notes as single JSON
        if (url === '/api/partituras/backup' && req.method === 'GET') {
          try {
            const files = fs.readdirSync(partiturasDir);
            const notesFiles = files.filter((f) => f.endsWith('.notes.json'));
            const backup: Record<string, unknown> = {};

            notesFiles.forEach((f) => {
              try {
                const content = JSON.parse(fs.readFileSync(path.join(partiturasDir, f), 'utf-8'));
                backup[f.replace('.notes.json', '')] = content;
              } catch {
                // skip
              }
            });

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="notascore_respaldo_himnos.json"');
            res.end(JSON.stringify({ exportedAt: Date.now(), totalScores: Object.keys(backup).length, backup }, null, 2));
            return;
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
            return;
          }
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), partiturasPlugin()],
  server: {
    host: true, // Listen on all local IPs (0.0.0.0) so phone and tablet on Wi-Fi can connect
  },
});
