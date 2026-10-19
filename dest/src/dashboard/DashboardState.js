import { logger } from "../utils/logger.js";
export class DashboardState {
    static instance;
    accounts = new Map();
    verifiedClients = new Map();
    isRunning = false;
    logs = [];
    logCounter = 0;
    sseClients = new Set();
    sharedConfig = {};
    startTime = Date.now();
    activeTypingChannels = new Set();
    constructor() {
        logger.addListener((entry) => {
            const logEntry = {
                id: ++this.logCounter,
                level: entry.level,
                message: entry.message,
                timestamp: entry.timestamp,
            };
            this.logs.push(logEntry);
            if (this.logs.length > 500) {
                this.logs.shift();
            }
            this.broadcast("log", logEntry);
        });
    }
    static getInstance() {
        if (!DashboardState.instance) {
            DashboardState.instance = new DashboardState();
        }
        return DashboardState.instance;
    }
    registerAccount(client, agent, config) {
        this.accounts.set(client.user.id, {
            client,
            agent,
            config,
            startedAt: Date.now()
        });
        this.isRunning = true;
        this.sharedConfig = { ...config };
        this.broadcastStatus();
    }
    getAccountsInfo() {
        const list = [];
        for (const [id, item] of this.accounts.entries()) {
            const { client, agent } = item;
            let status = "running";
            if (agent.captchaDetected) {
                status = "captcha";
            }
            else if (agent.breakUntil > Date.now()) {
                status = "break";
            }
            else if (agent.farmLoopPaused) {
                status = "paused";
            }
            else if (!client.isReady()) {
                status = "connecting";
            }
            list.push({
                id,
                username: client.user?.username || "Unknown",
                tag: client.user?.tag || client.user?.username || id,
                token: item.config.token ? `${item.config.token.slice(0, 15)}...${item.config.token.slice(-6)}` : "hidden",
                channelName: agent.activeChannel?.name || "None",
                channelId: agent.activeChannel?.id || "None",
                status,
                ping: client.ws?.ping ?? 0,
                totalCommands: agent.totalCommands,
                totalCaptchaSolved: agent.totalCaptchaSolved,
                totalCaptchaFailed: agent.totalCaptchaFailed,
                uptime: Math.floor((Date.now() - item.startedAt) / 1000),
                startedAt: item.startedAt,
                dailyStreak: agent.dailyStreak,
                breakUntil: agent.breakUntil,
                activeQuests: agent.activeQuests
            });
        }
        return list;
    }
    getGlobalStats() {
        let totalCommands = 0;
        let totalCaptchaSolved = 0;
        let totalCaptchaFailed = 0;
        let activeCount = 0;
        for (const [, item] of this.accounts.entries()) {
            totalCommands += item.agent.totalCommands;
            totalCaptchaSolved += item.agent.totalCaptchaSolved;
            totalCaptchaFailed += item.agent.totalCaptchaFailed;
            if (!item.agent.farmLoopPaused && !item.agent.captchaDetected) {
                activeCount++;
            }
        }
        return {
            isRunning: this.isRunning,
            totalAccounts: this.accounts.size,
            activeCount,
            totalCommands,
            totalCaptchaSolved,
            totalCaptchaFailed,
            globalUptime: Math.floor((Date.now() - this.startTime) / 1000)
        };
    }
    stopAll() {
        for (const [, item] of this.accounts.entries()) {
            item.agent.farmLoopPaused = true;
            item.agent.farmLoopRunning = false;
        }
        this.accounts.clear();
        this.isRunning = false;
        this.broadcastStatus();
        logger.warn("[Dashboard] Stopped all farming accounts.");
    }
    pauseAccount(id) {
        const acc = this.accounts.get(id);
        if (acc) {
            acc.agent.farmLoopPaused = true;
            this.broadcastStatus();
            logger.warn(`[Dashboard] Paused account: ${acc.client.user?.username || id}`);
            return true;
        }
        return false;
    }
    resumeAccount(id) {
        const acc = this.accounts.get(id);
        if (acc) {
            acc.agent.farmLoopPaused = false;
            this.broadcastStatus();
            logger.info(`[Dashboard] Resumed account: ${acc.client.user?.username || id}`);
            return true;
        }
        return false;
    }
    pauseAll() {
        for (const [, item] of this.accounts.entries()) {
            item.agent.farmLoopPaused = true;
        }
        this.broadcastStatus();
        logger.warn("[Dashboard] Paused ALL accounts.");
    }
    resumeAll() {
        for (const [, item] of this.accounts.entries()) {
            item.agent.farmLoopPaused = false;
        }
        this.broadcastStatus();
        logger.info("[Dashboard] Resumed ALL accounts.");
    }
    updateSharedConfig(newConfig) {
        this.sharedConfig = { ...this.sharedConfig, ...newConfig };
        for (const [, item] of this.accounts.entries()) {
            Object.assign(item.config, newConfig);
            Object.assign(item.agent.config, newConfig);
        }
        this.broadcast("configUpdated", this.sharedConfig);
        logger.info("[Dashboard] Shared configuration updated and applied to all accounts.");
    }
    addSseClient(res) {
        this.sseClients.add(res);
        res.write(`data: ${JSON.stringify({ type: "init", isRunning: this.isRunning, accounts: this.getAccountsInfo(), stats: this.getGlobalStats(), config: this.sharedConfig })}\n\n`);
    }
    removeSseClient(res) {
        this.sseClients.delete(res);
    }
    broadcast(type, data) {
        const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
        for (const client of this.sseClients) {
            try {
                client.write(payload);
            }
            catch {
                this.sseClients.delete(client);
            }
        }
    }
    broadcastStatus() {
        this.broadcast("status", {
            isRunning: this.isRunning,
            accounts: this.getAccountsInfo(),
            stats: this.getGlobalStats(),
            config: this.sharedConfig
        });
    }
}
export const dashboardState = DashboardState.getInstance();
