import { NotificationService } from "../services/NotificationService.js";
import { t } from "../utils/locales.js";
import { logger } from "../utils/logger.js";
import { dashboardState } from "../dashboard/DashboardState.js";
import { WebhookNotifier } from "../services/notifiers/WebhookNotifier.js";
export class CriticalEventHandler {
    static handleRejection(params) {
        process.on("unhandledRejection", (reason, promise) => {
            logger.runtime("Unhandled Rejection at:");
            logger.runtime(`Promise: ${promise}`);
            logger.runtime(`Reason: ${reason}`);
        });
        process.on("uncaughtException", (error) => {
            logger.error("Uncaught Exception:");
            logger.error(error);
            // Optionally, you can notify the user or log to a file
            // consoleNotify("Uncaught Exception", `Error: ${error.message}\nStack: ${error.stack}`);
        });
        process.on("SIGINT", () => {
            logger.info(t("events.sigint"));
            NotificationService.consoleNotify(params);
            // Optionally, you can notify the user or log to a file
            // consoleNotify("Stopping Selfbot", "Received SIGINT. Stopping selfbot...");
            process.exit(0);
        });
        process.on("SIGTERM", () => {
            logger.info(t("events.sigterm"));
            NotificationService.consoleNotify(params);
            process.exit(0);
        });
    }
    static handleBan({ agent, t }) {
        const username = agent.client.user?.username || "Account";
        logger.alert(`Account ${username}: ${t("status.states.banned")}, pausing this worker to protect other accounts.`);
        agent.farmLoopPaused = true;
        agent.farmLoopRunning = false;
        dashboardState.broadcastStatus();
        WebhookNotifier.sendRichEmbed(agent, {
            title: `⛔ Account Banned: ${username}`,
            description: `This account was marked banned by OwO bot and has been safely isolated. All other active accounts continue farming normally.`,
            color: "#EF4444"
        }).catch(() => { });
        // Isolated worker pause: do not terminate entire panel process
    }
    static async handleNoMoney(params) {
        const { agent, t } = params;
        const username = agent.client.user?.username || "Account";
        if (agent.config.autoSell) {
            logger.warn(t("handlers.criticalEvent.noMoney.attemptingSell"));
            const sellResponse = await agent.awaitResponse({
                trigger: () => agent.send("sell all"),
                filter: (msg) => msg.author.id === agent.owoID && msg.content.includes(msg.guild?.members.me?.displayName)
                    && (/sold.*for a total of/.test(msg.content) || msg.content.includes("You don't have enough animals!")),
            });
            if (!sellResponse) {
                logger.error("Failed to sell items. No response received.");
                return;
            }
            if (/sold.*for a total of/.test(sellResponse.content)) {
                logger.data(sellResponse.content.replace(/<a?:(\w+):\d+>/g, '$1').replace("**", "")); // Replace emojis with their names
            }
            else {
                logger.warn(`Account ${username}: ${t("handlers.criticalEvent.noMoney.noItems")}. Pausing this account.`);
                agent.farmLoopPaused = true;
                dashboardState.broadcastStatus();
                WebhookNotifier.sendRichEmbed(agent, {
                    title: `💸 Out of Cowoncy: ${username}`,
                    description: `Account has insufficient cowoncy and no animals available to sell. This account has been paused while other accounts continue farming.`,
                    color: "#F59E0B"
                }).catch(() => { });
                if (dashboardState.accounts.size <= 1) {
                    process.exit(-1);
                }
            }
        }
        else {
            logger.warn(`Account ${username}: ${t("handlers.criticalEvent.noMoney.autoSellDisabled")}. Pausing this account.`);
            agent.farmLoopPaused = true;
            dashboardState.broadcastStatus();
            WebhookNotifier.sendRichEmbed(agent, {
                title: `💸 Out of Cowoncy: ${username}`,
                description: `Account has insufficient cowoncy and autoSell is disabled. This account has been paused while other accounts continue farming.`,
                color: "#F59E0B"
            }).catch(() => { });
            if (dashboardState.accounts.size <= 1) {
                process.exit(-1);
            }
        }
    }
}
