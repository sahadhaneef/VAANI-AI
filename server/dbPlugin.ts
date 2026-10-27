import type { Plugin } from 'vite';
import { dbService } from './db.js';

export function dbPlugin(): Plugin {
  return {
    name: 'vaani-db-backend',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        
        // --- REMINDERS API ---
        if (url.startsWith('/api/reminders')) {
          res.setHeader('Content-Type', 'application/json');
          const userId = 'default_user'; // Mock auth
          
          if (req.method === 'GET') {
            try {
              const reminders = dbService.getReminders(userId);
              res.statusCode = 200;
              res.end(JSON.stringify(reminders));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
            return;
          }
          
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (c) => bodyStr += c);
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr);
                const reminder = dbService.createReminder({ ...body, userId });
                res.statusCode = 201;
                res.end(JSON.stringify(reminder));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }

          if (req.method === 'DELETE') {
            const id = url.split('/').pop();
            if (id) {
              const success = dbService.deleteReminder(id, userId);
              res.statusCode = success ? 200 : 404;
              res.end(JSON.stringify({ success }));
            } else {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing ID' }));
            }
            return;
          }
        }
        
        // --- MEMORIES API ---
        if (url.startsWith('/api/memories')) {
          res.setHeader('Content-Type', 'application/json');
          const userId = 'default_user';
          
          if (req.method === 'GET') {
            try {
              const memories = dbService.getAllMemories(userId);
              res.statusCode = 200;
              res.end(JSON.stringify(memories));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
            return;
          }
          
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (c) => bodyStr += c);
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr);
                const memory = dbService.saveMemory(userId, body.key, body.value, body.category);
                res.statusCode = 201;
                res.end(JSON.stringify(memory));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
        }

        next();
      });
    }
  };
}
