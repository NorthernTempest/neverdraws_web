import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Request, Response } from "express";
import helmet from "helmet";
import { ViteDevServer, createServer as createViteServer } from "vite";
import csurf from "tiny-csrf";
import session from "express-session";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get constants
const NODE_ENV = process.env.NODE_ENV || "development";
const APP_PORT =
    process.env.APP_PORT === undefined ? 40000 : parseInt(process.env.APP_PORT);
const IS_TEST =
    process.env.VITEST === undefined
        ? process.env.IS_TEST === undefined
            ? false
            : process.env.IS_TEST
        : process.env.VITEST === "true";
const DIR_NAME = path.dirname(fileURLToPath(import.meta.url));

// Secrets
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const CSRF_SECRET = process.env.CSRF_SECRET;

// Initialize server
async function createServer() {
    // Create express app
    const app = express();
    app.disable("x-powered-by");
    app.use(helmet());

    // Session and cookie middleware
    app.use(express.urlencoded({ extended: false }));
    if (COOKIE_SECRET !== undefined) app.use(cookieParser(COOKIE_SECRET));
    if (SESSION_SECRET !== undefined)
        app.use(
            session({
                secret: SESSION_SECRET,
                resave: false,
                saveUninitialized: true,
            })
        );
    if (CSRF_SECRET !== undefined) app.use(csurf(CSRF_SECRET));

    let vite: ViteDevServer | undefined = undefined;
    if (NODE_ENV === "development") {
        // Get vite object
        vite = await createViteServer({
            root: DIR_NAME,
            logLevel: IS_TEST ? "error" : "info",
            server: {
                middlewareMode: true,
                cors: {
                    origin: ".neverdraws.com",
                    optionsSuccessStatus: 200,
                },
            },
            appType: "custom",
        });
        // Use vite's middleware
        app.use(vite.middlewares);
    } else {
        app.use(
            (await import("serve-static")).default(
                path.resolve("dist/client"),
                {
                    index: false,
                }
            )
        );
    }

    // Serve all other requests
    app.use("*", async (req: Request, res: Response) => {
        // Get url
        const url = req.originalUrl;
        try {
            let template: string = "";
            let render: (url: string) => Promise<string>;

            if (NODE_ENV === "development" && vite !== undefined) {
                // Read index.html template
                template = fs.readFileSync(
                    path.resolve(DIR_NAME, "index.html"),
                    "utf-8"
                );
                // Apply vite's transformations
                template = await vite.transformIndexHtml(url, template);

                // Load server module's render method
                render = (await vite.ssrLoadModule("/src/server-app.tsx"))
                    .render;
            } else {
                template = fs.readFileSync(
                    path.resolve(DIR_NAME, "dist/client/index.html"),
                    "utf-8"
                );
                // @ts-ignore
                render = (await import("./dist/server/server-app.js")).render;
            }

            // Place content in index with rendered html
            const html = template.replace(`<!--ssr-->`, await render(url));

            // Serve rendered index page
            res.status(200)
                .set({
                    "Content-Type": "text/html",
                    "Access-Control-Allow-Origin": "api.neverdraws.com",
                })
                .end(html);
        } catch (e: any) {
            if (vite !== undefined) {
                // correct the stacktrace
                vite.ssrFixStacktrace(e);
            }

            // Log and serve error
            console.error(e);
            if (IS_TEST || NODE_ENV === "development") {
                res.status(500).end(e.message);
            } else {
                res.status(500).end("Internal Server Error");
            }
        }
    });

    return { app, vite };
}

if (!IS_TEST) {
    // Start server
    createServer()
        .then(({ app }) => {
            // Begin serving content
            app.listen(APP_PORT, () => {
                console.log(`Listening on port ${APP_PORT}`);
            });
        })
        .catch((e: any) => console.error(e));
}
