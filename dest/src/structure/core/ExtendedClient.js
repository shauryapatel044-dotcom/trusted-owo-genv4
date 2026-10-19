import { Client } from "discord.js-selfbot-v13";
import { logger } from "../../utils/logger.js";
import { ranInt } from "../../utils/math.js";
import { dashboardState } from "../../dashboard/DashboardState.js";
export class ExtendedClient extends Client {
    constructor(options = {}) {
        super(options);
    }
    registerEvents = () => {
        this.on("debug", logger.debug);
        this.on("warn", logger.warn);
        this.on("error", logger.error);
        this.on("rateLimit", (rateLimitData) => {
            logger.warn(`⚠️ [RateLimit] Discord rate limit on route: ${rateLimitData?.route || 'global'}. Backing off for ${Math.round((rateLimitData?.timeout || 2000) / 1000)}s...`);
        });
    };
    sendMessage = async (message, { channel, prefix = "", typing, skipLogging = false, }) => {
        // Human Etiquette: If another account in our farm is typing in this channel, pause & take turns
        if (dashboardState.activeTypingChannels.has(channel.id)) {
            await this.sleep(ranInt(1600, 3200));
        }
        dashboardState.activeTypingChannels.add(channel.id);
        try {
            // Human reaction pause before starting to type
            await this.sleep(ranInt(250, 600));
            await channel.sendTyping();
            // Realistic typing duration based on message length and human variance
            const humanTypingDuration = typing !== undefined
                ? typing
                : ranInt(850, 1600) + Math.min(message.length * ranInt(50, 95), 1800);
            await this.sleep(humanTypingDuration);
            // Rare Realistic Typo Simulation (~1.2% chance: simulate human keystroke slip and immediate correction)
            if (Math.random() < 0.012 && message.length > 2) {
                const typoMap = { "o": "p", "w": "e", "h": "j", "b": "v" };
                const charToReplace = message[0];
                const replaced = typoMap[charToReplace] || "x";
                const typoMsg = `${prefix ? prefix + " " : ""}${replaced}${message.slice(1)}`;
                channel.send(typoMsg);
                if (!skipLogging)
                    logger.sent(`${typoMsg} [Simulated Typo]`);
                // Human reaction time to notice typo (~400-800ms)
                await this.sleep(ranInt(450, 850));
                await channel.sendTyping();
                await this.sleep(ranInt(600, 1100));
            }
            const command = message.startsWith(prefix) ? message : `${prefix} ${message}`;
            channel.send(command);
            if (!skipLogging)
                logger.sent(command);
        }
        finally {
            dashboardState.activeTypingChannels.delete(channel.id);
        }
    };
    checkAccount = (token) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.off("debug", onDebug);
                this.off("error", onLoginError);
                reject(new Error("Login timed out after 35 seconds. Your server may be having difficulty reaching Discord's Gateway or Discord is requesting human verification."));
            }, 35000);
            const onDebug = (info) => {
                if (typeof info === "string") {
                    if (info.includes("Connecting to Discord Gateway") || info.includes("send packet '{\"op\":2") || info.includes("READY") || info.includes("all its guilds")) {
                        logger.info(`[Discord] ${info.slice(0, 100)}`);
                    }
                }
            };
            this.on("debug", onDebug);
            const onLoginError = (error) => {
                clearTimeout(timer);
                this.off("debug", onDebug);
                this.off("error", onLoginError);
                reject(error);
            };
            this.once("error", onLoginError);
            this.once("ready", () => {
                clearTimeout(timer);
                this.off("debug", onDebug);
                this.off("error", onLoginError);
                logger.info(`[INFO] Verified account: ${this.user?.tag || this.user?.username || this.user?.id}`);
                resolve(this.user?.id);
            });
            try {
                if (token) {
                    this.login(token).catch(onLoginError);
                }
                else {
                    this.QRLogin().catch(onLoginError);
                }
            }
            catch (error) {
                clearTimeout(timer);
                this.off("debug", onDebug);
                this.off("error", onLoginError);
                reject(error);
            }
        });
    };
}
