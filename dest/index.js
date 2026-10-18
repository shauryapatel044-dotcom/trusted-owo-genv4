import dns from "node:dns";
try {
    dns.setDefaultResultOrder("ipv4first");
}
catch { }
import { UpdateFeature } from "./src/services/UpdateService.js";
import { BaseAgent } from "./src/structure/BaseAgent.js";
import { ExtendedClient } from "./src/structure/core/ExtendedClient.js";
import { InquirerUI } from "./src/structure/InquirerUI.js";
import { logger } from "./src/utils/logger.js";
import { confirm } from "@inquirer/prompts";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import packageJSON from "./package.json" with { type: "json" };
process.title = `Advanced Discord OwO Tool Farm v${packageJSON.version} - Copyright 2025 © Elysia x Kyou Izumi`;
console.clear();
import { DashboardServer } from "./src/dashboard/DashboardServer.js";
import { ConfigPrompter } from "./src/structure/ConfigPrompter.js";
const updateFeature = new UpdateFeature();
const client = new ExtendedClient();
const argv = await yargs(hideBin(process.argv))
    .scriptName("adotf")
    .usage("$0 <command> [options]")
    .commandDir("./src/cli", {
    extensions: ["ts", "js"],
})
    .option("verbose", {
    alias: "v",
    type: "boolean",
    description: "Enable verbose logging",
    default: false,
})
    .option("skip-check-update", {
    alias: "s",
    type: "boolean",
    description: "Skip the update check",
    default: false,
})
    .option("language", {
    alias: "l",
    type: "string",
    description: "Set the language for the application",
    choices: ["en", "tr", "vi"],
    default: "en",
})
    .help()
    .epilogue(`For more information, visit ${packageJSON.homepage}`)
    .parse();
logger.setLevel(argv.verbose || process.env.NODE_ENV === "development" ? "debug" : "sent");
process.env.LOCALE = argv.language || "en";
if (!argv._.length) {
    if (!argv.skipCheckUpdate) {
        const updateAvailable = await updateFeature.checkForUpdates();
        if (updateAvailable) {
            const shouldUpdate = await confirm({
                message: "An update is available. Do you want to update now?",
                default: true,
            });
            if (shouldUpdate) {
                await updateFeature.performUpdate();
            }
        }
        await client.sleep(1000); // Wait for update to complete
    }
    // 1. Ask for Red Dashboard Port first!
    const prompter = new ConfigPrompter({ client, getConfig: () => ({}) });
    const port = await prompter.getDashboardPort();
    // Start Red Theme Professional Dashboard Server on requested port
    const dashboardServer = new DashboardServer(port);
    await dashboardServer.start();
    logger.info(`🔴 Red Theme Professional Dashboard online at http://localhost:${port}`);
    // 2. Prompt for 3 tokens, verify them, and configure single unified settings
    const { accounts } = await InquirerUI.prompt(client);
    logger.info(`⚡ Starting concurrent farming loop for ${accounts.length} account(s)...`);
    for (const acc of accounts) {
        await BaseAgent.initialize(acc.client, acc.config);
    }
}
