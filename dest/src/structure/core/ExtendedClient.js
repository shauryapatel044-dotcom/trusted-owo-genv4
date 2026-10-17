import { Client } from "discord.js-selfbot-v13";
import { logger } from "../../utils/logger.js";
import { ranInt } from "../../utils/math.js";
export class ExtendedClient extends Client {
    constructor(options = {}) {
        super(options);
    }
    registerEvents = () => {
        this.on("debug", logger.debug);
        this.on("warn", logger.warn);
        this.on("error", logger.error);
    };
    sendMessage = async (message, { channel, prefix = "", typing = ranInt(500, 1000), skipLogging = false, }) => {
        await channel.sendTyping();
        await this.sleep(typing);
        const command = message.startsWith(prefix) ? message : `${prefix} ${message}`;
        channel.send(command);
        if (!skipLogging)
            logger.sent(command);
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
