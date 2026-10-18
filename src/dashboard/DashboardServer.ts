import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dashboardState } from "./DashboardState.js";
import { logger } from "@/utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DashboardServer {
    private server?: http.Server;
    private port: number;

    constructor(port?: number) {
        this.port = port || (process.env.PORT ? parseInt(process.env.PORT) : (process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 3000));
    }

    public start(): Promise<number> {
        return new Promise((resolve) => {
            this.server = http.createServer((req, res) => {
                const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
                const pathname = parsedUrl.pathname;

                // CORS headers
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type");

                if (req.method === "OPTIONS") {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                // 1. Serve Dashboard HTML
                if (pathname === "/" || pathname === "/dashboard") {
                    const candidatePaths = [
                        path.join(__dirname, "public", "index.html"),
                        path.join(process.cwd(), "dest", "src", "dashboard", "public", "index.html"),
                        path.join(process.cwd(), "src", "dashboard", "public", "index.html"),
                    ];
                    const htmlPath = candidatePaths.find(p => fs.existsSync(p));

                    if (htmlPath) {
                        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                        fs.createReadStream(htmlPath).pipe(res);
                    } else {
                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.end("<h1>Trusted OwO Gen v4 Dashboard</h1><p>Dashboard HTML loading...</p>");
                    }
                    return;
                }

                // 2. API Status
                if (pathname === "/api/status" && req.method === "GET") {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        accounts: dashboardState.getAccountsInfo(),
                        stats: dashboardState.getGlobalStats(),
                        config: dashboardState.sharedConfig
                    }));
                    return;
                }

                // 3. API Logs
                if (pathname === "/api/logs" && req.method === "GET") {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(dashboardState.logs));
                    return;
                }

                // 4. Server-Sent Events (SSE) Stream
                if (pathname === "/api/events" && req.method === "GET") {
                    res.writeHead(200, {
                        "Content-Type": "text/event-stream",
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive"
                    });
                    res.write("\n");
                    dashboardState.addSseClient(res);

                    req.on("close", () => {
                        dashboardState.removeSseClient(res);
                    });
                    return;
                }

                // 5. API Pause
                if (pathname === "/api/accounts/pause" && req.method === "POST") {
                    const id = parsedUrl.searchParams.get("id");
                    if (id === "all" || !id) {
                        dashboardState.pauseAll();
                    } else {
                        dashboardState.pauseAccount(id);
                    }
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true }));
                    return;
                }

                // 6. API Resume
                if (pathname === "/api/accounts/resume" && req.method === "POST") {
                    const id = parsedUrl.searchParams.get("id");
                    if (id === "all" || !id) {
                        dashboardState.resumeAll();
                    } else {
                        dashboardState.resumeAccount(id);
                    }
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true }));
                    return;
                }

                // 7. API Update Config
                if (pathname === "/api/config" && req.method === "POST") {
                    let body = "";
                    req.on("data", chunk => body += chunk);
                    req.on("end", () => {
                        try {
                            const newConfig = JSON.parse(body);
                            dashboardState.updateSharedConfig(newConfig);
                            res.writeHead(200, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ success: true, config: dashboardState.sharedConfig }));
                        } catch (e: any) {
                            res.writeHead(400, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                    return;
                }

                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not Found");
            });

            this.server.listen(this.port, "0.0.0.0", () => {
                logger.info(`[Dashboard] Red Enterprise Dashboard running at http://0.0.0.0:${this.port}`);
                resolve(this.port);
            });

            this.server.on("error", (err: any) => {
                if (err.code === "EADDRINUSE") {
                    logger.warn(`[Dashboard] Port ${this.port} in use, trying ${this.port + 1}...`);
                    this.port += 1;
                    this.server?.listen(this.port, "0.0.0.0");
                } else {
                    logger.error(`[Dashboard] Server error: ${err.message}`);
                }
            });
        });
    }

    public stop() {
        if (this.server) {
            this.server.close();
        }
    }
}
