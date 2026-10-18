import { DashboardServer } from "./DashboardServer.js";
import { dashboardState } from "./DashboardState.js";
import { logger } from "@/utils/logger.js";
import { Configuration } from "@/schemas/ConfigSchema.js";

const port = process.env.PORT ? parseInt(process.env.PORT) : 25613;
const server = new DashboardServer(port);

// Mock Accounts for interactive panel testing
const mockConfig: Configuration = {
    token: "mfa.W92kd81-demo-token-alphax991",
    guildID: "112233445566778899",
    channelID: ["998877665544332211"],
    wayNotify: ["webhook"],
    musicPath: "assets/music.mp3",
    webhookURL: "https://discord.com/api/webhooks/demo/sample",
    adminID: "123456789012345678",
    captchaAPI: "2captcha",
    apiKey: "demo_api_key_2captcha",
    prefix: "owo ",
    autoGem: 1,
    gemTier: ["common", "uncommon", "rare"],
    autoClover: true,
    autoDaily: true,
    autoSell: false,
    autoQuote: ["owo", "quote"],
    autoRPP: ["run", "pup"],
    autoPray: ["pray"],
    autoSleep: true,
    autoReload: true,
    autoResume: true,
    autoCookie: true,
    autoHuntbot: true,
    useCustomPrefix: false,
    showRPC: true,
    autoLootbox: true,
    autoFabledLootbox: false,
    autoTrait: "efficiency",
    username: "OwoMaster"
};

// Account 1
const mockAcc1: any = {
    client: {
        user: { id: "1001", username: "OwoMaster", tag: "OwoMaster#1024" },
        ws: { ping: 32 },
        isReady: () => true,
    },
    agent: {
        captchaDetected: false,
        farmLoopPaused: false,
        activeChannel: { id: "998877665544332211", name: "owo-grind-main" },
        totalCommands: 1420,
        totalCaptchaSolved: 12,
        totalCaptchaFailed: 0,
        config: { ...mockConfig },
    },
    config: { ...mockConfig },
    startedAt: Date.now() - 3600000 * 2.5
};

// Account 2
const mockAcc2: any = {
    client: {
        user: { id: "1002", username: "GemFarmer", tag: "GemFarmer#4082" },
        ws: { ping: 45 },
        isReady: () => true,
    },
    agent: {
        captchaDetected: false,
        farmLoopPaused: false,
        activeChannel: { id: "998877665544332211", name: "owo-grind-main" },
        totalCommands: 1385,
        totalCaptchaSolved: 9,
        totalCaptchaFailed: 1,
        config: { ...mockConfig, token: "mfa.J819dk2-demo-token-betax772", username: "GemFarmer" },
    },
    config: { ...mockConfig, token: "mfa.J819dk2-demo-token-betax772", username: "GemFarmer" },
    startedAt: Date.now() - 3600000 * 2.2
};

// Account 3
const mockAcc3: any = {
    client: {
        user: { id: "1003", username: "NightCrawler", tag: "NightCrawler#9911" },
        ws: { ping: 28 },
        isReady: () => true,
    },
    agent: {
        captchaDetected: false,
        farmLoopPaused: true,
        activeChannel: { id: "998877665544332222", name: "bot-spam" },
        totalCommands: 940,
        totalCaptchaSolved: 6,
        totalCaptchaFailed: 0,
        config: { ...mockConfig, token: "mfa.L002mk8-demo-token-gammax334", username: "NightCrawler" },
    },
    config: { ...mockConfig, token: "mfa.L002mk8-demo-token-gammax334", username: "NightCrawler" },
    startedAt: Date.now() - 3600000 * 1.5
};

dashboardState.accounts.set("1001", mockAcc1);
dashboardState.accounts.set("1002", mockAcc2);
dashboardState.accounts.set("1003", mockAcc3);
dashboardState.sharedConfig = { ...mockConfig };

// Feed initial logs
logger.info("[System] Initializing Red Theme Enterprise Dashboard...");
logger.info("[System] Running in interactive test / preview mode.");
logger.info("[Gateway] Connected 3 accounts concurrently to Discord Gateway.");
logger.sent("[OwoMaster] Sent 'owo hunt' in #owo-grind-main");
logger.sent("[GemFarmer] Sent 'owo battle' in #owo-grind-main");
logger.info("[Safety] Randomized human typing latency: 840ms. Anti-ban active.");

await server.start();
console.log(`\n============================================================`);
console.log(`🔴 RED THEME ENTERPRISE DASHBOARD IS LIVE!`);
console.log(`🌐 Open in your browser: http://localhost:${port}`);
console.log(`============================================================\n`);

// Simulate live incoming events & commands to test real-time SSE stream
const commands = ["owo hunt", "owo battle", "owo pray", "owo inv", "owo lb all"];
const accounts = [mockAcc1, mockAcc2, mockAcc3];

setInterval(() => {
    const acc = accounts[Math.floor(Math.random() * accounts.length)];
    if (acc.agent.farmLoopPaused) return;

    const cmd = commands[Math.floor(Math.random() * commands.length)];
    acc.agent.totalCommands += 1;
    acc.client.ws.ping = Math.floor(Math.random() * 30) + 20;

    logger.sent(`[${acc.client.user.username}] Executed '${cmd}' in #${acc.agent.activeChannel.name}`);
    dashboardState.broadcastStatus();
}, 4000);
