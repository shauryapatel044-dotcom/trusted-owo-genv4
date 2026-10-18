import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dashboardState } from "./DashboardState.js";
import { logger } from "@/utils/logger.js";
import { ConfigManager } from "@/structure/core/ConfigManager.js";
import { ExtendedClient } from "@/structure/core/ExtendedClient.js";
import { BaseAgent } from "@/structure/BaseAgent.js";
import { Configuration } from "@/schemas/ConfigSchema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DashboardServer {
    private server?: http.Server;
    private port: number;
    private configManager = new ConfigManager();

    constructor(port?: number) {
        this.port = port || (process.env.PORT ? parseInt(process.env.PORT) : (process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 25613));
    }

    public start(): Promise<number> {
        return new Promise((resolve) => {
            this.server = http.createServer(async (req, res) => {
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

                // Helper to parse JSON body
                const getBody = (): Promise<any> => {
                    return new Promise((resolveBody, rejectBody) => {
                        let body = "";
                        req.on("data", chunk => body += chunk);
                        req.on("end", () => {
                            if (!body) return resolveBody({});
                            try {
                                resolveBody(JSON.parse(body));
                            } catch (e) {
                                rejectBody(e);
                            }
                        });
                    });
                };

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

                // 2. API Status & Saved Config
                if (pathname === "/api/status" && req.method === "GET") {
                    const savedKeys = this.configManager.getAllKeys();
                    const savedTokens = savedKeys.map(k => this.configManager.get(k)?.token).filter(Boolean) as string[];
                    let savedConfig: any = {};
                    if (savedKeys.length > 0) {
                        savedConfig = this.configManager.get(savedKeys[0]) || {};
                    }

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        isRunning: dashboardState.isRunning,
                        accounts: dashboardState.getAccountsInfo(),
                        stats: dashboardState.getGlobalStats(),
                        config: dashboardState.sharedConfig,
                        saved: {
                            tokens: savedTokens,
                            config: savedConfig
                        }
                    }));
                    return;
                }

                // 3. API Verify Tokens
                if (pathname === "/api/setup/verify-tokens" && req.method === "POST") {
                    try {
                        const { tokens } = await getBody();
                        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
                            res.writeHead(400, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ error: "No tokens provided" }));
                            return;
                        }

                        const verified: any[] = [];
                        for (let i = 0; i < tokens.length; i++) {
                            const tok = typeof tokens[i] === "string" ? tokens[i].trim() : "";
                            if (!tok) continue;

                            let client = dashboardState.verifiedClients.get(tok);
                            if (!client || !client.isReady()) {
                                client = new ExtendedClient();
                                try {
                                    await client.checkAccount(tok);
                                    dashboardState.verifiedClients.set(tok, client);
                                } catch (err: any) {
                                    logger.error(`[Setup] Token #${i + 1} verification failed: ${err.message}`);
                                    verified.push({
                                        token: tok,
                                        valid: false,
                                        error: err.message
                                    });
                                    continue;
                                }
                            }

                            const guilds = client.guilds.cache.map(g => ({
                                id: g.id,
                                name: g.name,
                                channels: g.channels.cache
                                    .filter(c => c.isText())
                                    .map(c => ({ id: c.id, name: c.name }))
                            }));

                            verified.push({
                                token: tok,
                                valid: true,
                                id: client.user.id,
                                username: client.user.username,
                                tag: client.user.tag,
                                avatar: client.user.displayAvatarURL(),
                                guilds
                            });
                        }

                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ success: true, verified }));
                    } catch (e: any) {
                        res.writeHead(500, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: e.message }));
                    }
                    return;
                }

                // 4. API Start Farming
                if (pathname === "/api/setup/start" && req.method === "POST") {
                    try {
                        const { tokens, config } = await getBody();
                        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
                            res.writeHead(400, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ error: "At least one token is required." }));
                            return;
                        }

                        logger.info(`[Setup] Launching multi-token farm for ${tokens.length} account(s)...`);
                        const launchedAccounts: string[] = [];

                        // Clean and normalize config to strictly satisfy ConfigSchema
                        const sanitizedConfig: any = { ...config };

                        // Webhook URL & wayNotify
                        if (sanitizedConfig.webhookURL && typeof sanitizedConfig.webhookURL === "string" && sanitizedConfig.webhookURL.trim()) {
                            sanitizedConfig.webhookURL = sanitizedConfig.webhookURL.trim();
                            if (!Array.isArray(sanitizedConfig.wayNotify)) sanitizedConfig.wayNotify = [];
                            if (!sanitizedConfig.wayNotify.includes("webhook")) sanitizedConfig.wayNotify.push("webhook");
                        } else {
                            delete sanitizedConfig.webhookURL;
                            if (Array.isArray(sanitizedConfig.wayNotify)) {
                                sanitizedConfig.wayNotify = sanitizedConfig.wayNotify.filter((w: string) => w !== "webhook");
                            } else {
                                sanitizedConfig.wayNotify = [];
                            }
                        }

                        // Admin ID
                        if (sanitizedConfig.adminID && typeof sanitizedConfig.adminID === "string" && sanitizedConfig.adminID.trim()) {
                            sanitizedConfig.adminID = sanitizedConfig.adminID.trim();
                        } else {
                            delete sanitizedConfig.adminID;
                            if (Array.isArray(sanitizedConfig.wayNotify)) {
                                sanitizedConfig.wayNotify = sanitizedConfig.wayNotify.filter((w: string) => w !== "dms" && w !== "call");
                            }
                        }

                        // Captcha API Key & captchaAPI
                        if (sanitizedConfig.captchaAPI && sanitizedConfig.apiKey && typeof sanitizedConfig.apiKey === "string" && sanitizedConfig.apiKey.trim()) {
                            sanitizedConfig.apiKey = sanitizedConfig.apiKey.trim();
                        } else {
                            delete sanitizedConfig.captchaAPI;
                            delete sanitizedConfig.apiKey;
                        }

                        // Music path
                        if (!sanitizedConfig.musicPath && Array.isArray(sanitizedConfig.wayNotify)) {
                            sanitizedConfig.wayNotify = sanitizedConfig.wayNotify.filter((w: string) => w !== "music");
                        }

                        // Gem Tier default
                        if (sanitizedConfig.autoGem && (!sanitizedConfig.gemTier || sanitizedConfig.gemTier.length === 0)) {
                            sanitizedConfig.gemTier = ["common", "uncommon", "rare", "epic", "mythical"];
                        }

                        // Array feature defaults
                        sanitizedConfig.autoQuote = Array.isArray(sanitizedConfig.autoQuote) && sanitizedConfig.autoQuote.length > 0 ? sanitizedConfig.autoQuote : ["owo"];
                        sanitizedConfig.autoRPP = Array.isArray(sanitizedConfig.autoRPP) && sanitizedConfig.autoRPP.length > 0 ? sanitizedConfig.autoRPP : ["run", "pup", "piku"];
                        sanitizedConfig.autoPray = Array.isArray(sanitizedConfig.autoPray) && sanitizedConfig.autoPray.length > 0 ? sanitizedConfig.autoPray : ["pray"];

                        for (const tok of tokens) {
                            const cleanToken = typeof tok === "string" ? tok.trim() : "";
                            if (!cleanToken) continue;

                            let client = dashboardState.verifiedClients.get(cleanToken);
                            if (!client || !client.isReady()) {
                                client = new ExtendedClient();
                                await client.checkAccount(cleanToken);
                                dashboardState.verifiedClients.set(cleanToken, client);
                            }

                            const accConfig = {
                                ...sanitizedConfig,
                                token: cleanToken,
                                username: client.user.username,
                            } as Configuration;

                            // Save to ConfigManager for persistent reload
                            this.configManager.set(client.user.id, accConfig);

                            // Initialize agent & register to dashboard
                            await BaseAgent.initialize(client, accConfig);
                            launchedAccounts.push(client.user.username);
                        }

                        dashboardState.isRunning = true;
                        dashboardState.sharedConfig = { ...config };
                        dashboardState.broadcastStatus();

                        logger.info(`[Setup] Successfully launched ${launchedAccounts.length} accounts: ${launchedAccounts.join(", ")}`);

                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({
                            success: true,
                            count: launchedAccounts.length,
                            accounts: launchedAccounts
                        }));
                    } catch (e: any) {
                        logger.error(`[Setup] Failed to start farm: ${e.message}`);
                        res.writeHead(500, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: e.message }));
                    }
                    return;
                }

                // 5. API Stop Farming
                if (pathname === "/api/setup/stop" && req.method === "POST") {
                    dashboardState.stopAll();
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true }));
                    return;
                }

                // 6. API Logs
                if (pathname === "/api/logs" && req.method === "GET") {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(dashboardState.logs));
                    return;
                }

                // 7. Server-Sent Events (SSE) Stream
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

                // 8. API Pause
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

                // 9. API Resume
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

                // 10. API Update Config
                if (pathname === "/api/config" && req.method === "POST") {
                    try {
                        const newConfig = await getBody();
                        dashboardState.updateSharedConfig(newConfig);
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ success: true, config: dashboardState.sharedConfig }));
                    } catch (e: any) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: e.message }));
                    }
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
