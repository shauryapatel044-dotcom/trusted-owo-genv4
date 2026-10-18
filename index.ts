import dns from "node:dns";
try {
    dns.setDefaultResultOrder("ipv4first");
} catch {}

import { UpdateFeature } from "@/services/UpdateService.js";
import { ExtendedClient } from "@/structure/core/ExtendedClient.js";
import { logger } from "@/utils/logger.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import packageJSON from "./package.json" with { type: "json" };
import { Locale } from "@/utils/locales.js";
import { DashboardServer } from "@/dashboard/DashboardServer.js";
import { exec } from "node:child_process";
import { input } from "@inquirer/prompts";

function openBrowser(url: string) {
    try {
        const platform = process.platform;
        if (platform === "win32") {
            exec(`start "" "${url}"`);
        } else if (platform === "darwin") {
            exec(`open "${url}"`);
        } else {
            exec(`xdg-open "${url}"`);
        }
    } catch {}
}

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
        description: "Web Dashboard Port (default: 25613)",
        default: process.env.PORT ? parseInt(process.env.PORT) : (process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 25613),
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
process.env.LOCALE = argv.language as Locale || "en";

if (!argv._.length) {
    if (!argv.skipCheckUpdate) {
        try {
            await updateFeature.checkForUpdates();
        } catch {}
    }

    // 1. Determine Port (Default: 25613 or panel-assigned SERVER_PORT)
    let port = argv.port || (process.env.PORT ? parseInt(process.env.PORT) : (process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 25613));

    // Only prompt in interactive terminal on local machines (Windows/Mac), NEVER on headless Linux hosting containers
    const isHosting = process.platform === "linux" || !process.stdin.isTTY || !!process.env.SERVER_PORT || !!process.env.P_SERVER_UUID;

    if (!isHosting && process.stdin.isTTY && !process.env.PORT && !process.env.SERVER_PORT) {
        try {
            const portAnswer = await input({
                message: "🔴 Enter Dashboard Port:",
                default: port.toString(),
                validate: (val) => {
                    const p = parseInt(val ? val.trim() : port.toString());
                    return (!isNaN(p) && p > 0 && p < 65536) || "Please enter a valid port between 1 and 65535";
                }
            });
            port = parseInt(portAnswer.trim());
        } catch {
            // Fallback to default port if prompt canceled
        }
    }

    // 2. Start Red Theme Dashboard Server on chosen port & open browser if local
    const dashboardServer = new DashboardServer(port);
    const actualPort = await dashboardServer.start();
    if (!isHosting) {
        openBrowser(`http://localhost:${actualPort}`);
    }

    console.log(`\n========================================================================`);
    console.log(`🔴 TRUSTED OWO GEN V4 - WEB DASHBOARD CONTROLLER IS RUNNING`);
    console.log(`========================================================================`);
    console.log(`🌐 Local URL:  http://localhost:${actualPort}`);
    console.log(`🌐 Public URL: http://<YOUR_SERVER_IP>:${actualPort}`);
    console.log(`💡 On Visihost: Open http://<YOUR_SERVER_IP>:${actualPort} in your browser!`);
    console.log(`========================================================================\n`);
}
