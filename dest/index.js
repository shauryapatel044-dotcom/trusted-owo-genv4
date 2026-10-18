import dns from "node:dns";
try {
    dns.setDefaultResultOrder("ipv4first");
}
catch { }
import { UpdateFeature } from "./src/services/UpdateService.js";
import { ExtendedClient } from "./src/structure/core/ExtendedClient.js";
import { logger } from "./src/utils/logger.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import packageJSON from "./package.json" with { type: "json" };
import { DashboardServer } from "./src/dashboard/DashboardServer.js";
process.title = `Advanced Discord OwO Tool Farm v${packageJSON.version} - Copyright 2025 © Elysia x Kyou Izumi`;
console.clear();
const updateFeature = new UpdateFeature();
const client = new ExtendedClient();
const argv = await yargs(hideBin(process.argv))
    .scriptName("adotf")
    .usage("$0 <command> [options]")
    .commandDir("./src/cli", {
    extensions: ["ts", "js"],
})
    .option("port", {
    alias: "p",
    type: "number",
    description: "Web Dashboard Port (default: 3000)",
    default: process.env.PORT ? parseInt(process.env.PORT) : (process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 3000),
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
    default: true,
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
        try {
            await updateFeature.checkForUpdates();
        }
        catch { }
    }
    // Launch Red Theme Professional Dashboard Web Controller directly
    const port = argv.port || (process.env.PORT ? parseInt(process.env.PORT) : (process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 3000));
    const dashboardServer = new DashboardServer(port);
    const actualPort = await dashboardServer.start();
    console.log(`\n========================================================================`);
    console.log(`🔴 TRUSTED OWO GEN V4 - WEB DASHBOARD CONTROLLER IS RUNNING`);
    console.log(`========================================================================`);
    console.log(`🌐 Control Panel URL: http://localhost:${actualPort}`);
    console.log(`👉 Open the URL in your browser to enter tokens and configure all accounts!`);
    console.log(`💡 Zero terminal interaction required — everything is handled in the Web UI.`);
    console.log(`========================================================================\n`);
}
