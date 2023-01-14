import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, {Request, Response} from 'express';
import { createServer as createViteServer } from 'vite';

// Get constants
const DIR_NAME = path.dirname(fileURLToPath(import.meta.url));
const APP_PORT = process.env.APP_PORT || 3000;

// Initialize server
async function createServer() {
    // Create express app
    const app = express();

    // Get vite object
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom'
    });

    // Use vite's middleware
    app.use(vite.middlewares);

    // Serve all other requests
    app.use('/', async (req: Request, res: Response) => {
        // Get url
        const url = req.originalUrl;
        try {
            // Read index.html template
            let template = fs.readFileSync(
                path.resolve(DIR_NAME, 'index.html'),
                'utf-8',
            );

            // Apply vite's transformations
            template = await vite.transformIndexHtml(url, template);

            // Load server module's render method
            const { render } = await vite.ssrLoadModule('/src/server.tsx');

            // Place content in index with rendered html
            const html = await template.replace(`<!--ssr-->`, await render(url));

            // Serve rendered index page
            res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (e: any) {
            // correct the stacktrace
            vite.ssrFixStacktrace(e);

            // Log and serve error
            console.error(e);
            res.status(500).end(e.message);
        }
    });

    // Begin serving on https://localhost:3000 (or whichever port you set)
    app.listen(APP_PORT);

    // Log server url
    console.info(`Server running at http://localhost:${APP_PORT}`);
}

createServer();
