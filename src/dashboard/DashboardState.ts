import { ExtendedClient } from "@/structure/core/ExtendedClient.js";
import { BaseAgent } from "@/structure/BaseAgent.js";
import { Configuration } from "@/schemas/ConfigSchema.js";
import { logger, LogLevel } from "@/utils/logger.js";
import http from "node:http";

export interface AccountInfo {
    id: string;
    username: string;
    tag: string;
    token: string;
    channelName: string;
    channelId: string;
    status: "running" | "paused" | "captcha" | "connecting" | "error" | "break";
    ping: number;
    totalCommands: number;
    totalCaptchaSolved: number;
    totalCaptchaFailed: number;
    uptime: number;
    startedAt: number;
    dailyStreak?: number;
    breakUntil?: number;
    cowoncy?: number;
    activeQuests?: string[];
}

export interface LogEntry {
    id: number;
    level: LogLevel;
    message: string;
    timestamp: string;
    account?: string;
}

export class DashboardState {
    private static instance: DashboardState;

    public accounts: Map<string, { client: ExtendedClient<true>; agent: BaseAgent; config: Configuration; startedAt: number }> = new Map();
    public verifiedClients: Map<string, ExtendedClient<true>> = new Map();
    public isRunning: boolean = false;
    public logs: LogEntry[] = [];
    private logCounter = 0;
    public sseClients: Set<http.ServerResponse> = new Set();
    public sharedConfig: Partial<Configuration> = {};
    public startTime = Date.now();
    public activeTypingChannels: Set<string> = new Set();

    private constructor() {
        logger.addListener((entry) => {
            const logEntry: LogEntry = {
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

    public static getInstance(): DashboardState {
        if (!DashboardState.instance) {
            DashboardState.instance = new DashboardState();
        }
        return DashboardState.instance;
    }

    public registerAccount(client: ExtendedClient<true>, agent: BaseAgent, config: Configuration) {
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

    public getAccountsInfo(): AccountInfo[] {
        const list: AccountInfo[] = [];
        for (const [id, item] of this.accounts.entries()) {
            const { client, agent } = item;
            let status: AccountInfo["status"] = "running";
            if (agent.captchaDetected) {
                status = "captcha";
            } else if (agent.breakUntil > Date.now()) {
                status = "break";
            } else if (agent.farmLoopPaused) {
                status = "paused";
            } else if (!client.isReady()) {
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
                cowoncy: agent.cowoncy || 0,
                activeQuests: agent.activeQuests
            });
        }
        return list;
    }

    public getGlobalStats() {
        let totalCommands = 0;
        let totalCaptchaSolved = 0;
        let totalCaptchaFailed = 0;
        let totalCowoncy = 0;
        let activeCount = 0;

        for (const [, item] of this.accounts.entries()) {
            totalCommands += item.agent.totalCommands;
            totalCaptchaSolved += item.agent.totalCaptchaSolved;
            totalCaptchaFailed += item.agent.totalCaptchaFailed;
            totalCowoncy += (item.agent.cowoncy || 0);
            if (!item.agent.farmLoopPaused && !item.agent.captchaDetected) {
                activeCount++;
            }
        }

        return {
            isRunning: this.isRunning,
            totalAccounts: this.accounts.size,
            activeCount,
            totalCommands,
            totalCowoncy,
            totalCaptchaSolved,
            totalCaptchaFailed,
            globalUptime: Math.floor((Date.now() - this.startTime) / 1000)
        };
    }

    public stopAll() {
        for (const [, item] of this.accounts.entries()) {
            item.agent.farmLoopPaused = true;
            item.agent.farmLoopRunning = false;
        }
        this.accounts.clear();
        this.isRunning = false;
        this.broadcastStatus();
        logger.warn("[Dashboard] Stopped all farming accounts.");
    }

    public pauseAccount(id: string): boolean {
        const acc = this.accounts.get(id);
        if (acc) {
            acc.agent.farmLoopPaused = true;
            this.broadcastStatus();
            logger.warn(`[Dashboard] Paused account: ${acc.client.user?.username || id}`);
            return true;
        }
        return false;
    }

    public resumeAccount(id: string): boolean {
        const acc = this.accounts.get(id);
        if (acc) {
            acc.agent.farmLoopPaused = false;
            this.broadcastStatus();
            logger.info(`[Dashboard] Resumed account: ${acc.client.user?.username || id}`);
            return true;
        }
        return false;
    }

    public pauseAll() {
        for (const [, item] of this.accounts.entries()) {
            item.agent.farmLoopPaused = true;
        }
        this.broadcastStatus();
        logger.warn("[Dashboard] Paused ALL accounts.");
    }

    public resumeAll() {
        for (const [, item] of this.accounts.entries()) {
            item.agent.farmLoopPaused = false;
        }
        this.broadcastStatus();
        logger.info("[Dashboard] Resumed ALL accounts.");
    }

    public updateSharedConfig(newConfig: Partial<Configuration>) {
        this.sharedConfig = { ...this.sharedConfig, ...newConfig };
        for (const [, item] of this.accounts.entries()) {
            Object.assign(item.config, newConfig);
            Object.assign(item.agent.config, newConfig);
        }
        this.broadcast("configUpdated", this.sharedConfig);
        logger.info("[Dashboard] Shared configuration updated and applied to all accounts.");
    }

    public addSseClient(res: http.ServerResponse) {
        this.sseClients.add(res);
        res.write(`data: ${JSON.stringify({ type: "init", isRunning: this.isRunning, accounts: this.getAccountsInfo(), stats: this.getGlobalStats(), config: this.sharedConfig })}\n\n`);
    }

    public removeSseClient(res: http.ServerResponse) {
        this.sseClients.delete(res);
    }

    public broadcast(type: string, data: any) {
        const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
        for (const client of this.sseClients) {
            try {
                client.write(payload);
            } catch {
                this.sseClients.delete(client);
            }
        }
    }

    public broadcastStatus() {
        this.broadcast("status", {
            isRunning: this.isRunning,
            accounts: this.getAccountsInfo(),
            stats: this.getGlobalStats(),
            config: this.sharedConfig
        });
    }
}

export const dashboardState = DashboardState.getInstance();
