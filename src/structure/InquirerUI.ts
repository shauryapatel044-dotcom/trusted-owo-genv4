import path from "node:path";
import fs from "node:fs";

import { logger } from "@/utils/logger.js";
import { Configuration } from "@/schemas/ConfigSchema.js";
import { t } from "@/utils/locales.js";

import { ConfigPrompter } from "./ConfigPrompter.js";
import { ExtendedClient } from "./core/ExtendedClient.js";
import { ConfigManager } from "./core/ConfigManager.js";

export class InquirerUI {
    private static client: ExtendedClient<true>;
    private static config: Partial<Configuration> = {};
    private static configManager = new ConfigManager();
    private static configPrompter: ConfigPrompter;

    static editConfig = async () => {
        if (!this.client || !this.client.isReady()) {
            throw new Error("Client is not ready. Please initialize the client before editing the config.");
        }

        this.config.username = this.client.user.username;
        this.config.token = this.client.token;

        const guildCache = this.client.guilds.cache;
        const guild = await this.configPrompter.listGuilds(guildCache, this.config.guildID);
        this.config.guildID = guild.id;
        this.config.channelID = await this.configPrompter.listChannels(guild, this.config.channelID);

        this.config.wayNotify = await this.configPrompter.getWayNotify(this.config.wayNotify);
        if (this.config.wayNotify.includes("webhook")) {
            this.config.webhookURL = await this.configPrompter.getWebhookURL(this.config.webhookURL);
        }
        if (this.config.wayNotify.some(w => (<Configuration["wayNotify"]>["webhook", "call", "dms"]).includes(w))) {
            this.config.adminID = await this.configPrompter.getAdminID(guild, this.config.adminID);
        }
        if (this.config.wayNotify.includes("music")) {
            this.config.musicPath = await this.configPrompter.getMusicPath(this.config.musicPath);
        }

        this.config.captchaAPI = await this.configPrompter.getCaptchaAPI(this.config.captchaAPI);
        if (this.config.captchaAPI) {
            this.config.apiKey = await this.configPrompter.getCaptchaAPIKey(this.config.apiKey);
        }

        this.config.prefix = await this.configPrompter.getPrefix(this.config.prefix);

        this.config.autoGem = await this.configPrompter.getGemUsage(this.config.autoGem);
        if (this.config.autoGem) {
            this.config.gemTier = await this.configPrompter.getGemTier(this.config.gemTier);
            this.config.autoLootbox = await this.configPrompter.trueFalse(
                t("ui.toggleOptions.autoLootbox"),
                this.config.autoLootbox
            );
            this.config.autoFabledLootbox = await this.configPrompter.trueFalse(
                t("ui.toggleOptions.autoFabledLootbox"),
                this.config.autoFabledLootbox
            );
        }

        this.config.autoHuntbot = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.autoHuntbot"),
            this.config.autoHuntbot
        );

        if (this.config.autoHuntbot) {
            this.config.autoTrait = await this.configPrompter.getTrait(this.config.autoTrait);
            this.config.useAdotfAPI = await this.configPrompter.getHuntbotSolver(this.config.useAdotfAPI);
        }

        this.config.autoCookie = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.autoCookie"),
            this.config.autoCookie
        );
        this.config.autoClover = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.autoClover"),
            this.config.autoClover
        );
        if (
            (this.config.autoCookie || this.config.autoClover)
            && !this.config.adminID
        ) {
            this.config.adminID = await this.configPrompter.getAdminID(guild, this.config.adminID);
        }

        this.config.autoPray = await this.configPrompter.getPrayCurse(this.config.autoPray);
        this.config.autoQuote = await this.configPrompter.getQuoteAction(this.config.autoQuote);
        this.config.autoRPP = await this.configPrompter.getRPPAction(this.config.autoRPP);

        this.config.autoDaily = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.autoDaily"),
            this.config.autoDaily
        );
        this.config.autoSleep = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.autoSleep"),
            this.config.autoSleep
        );
        this.config.autoReload = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.autoReload"),
            this.config.autoReload
        );
        this.config.useCustomPrefix = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.useCustomPrefix"),
            this.config.useCustomPrefix
        );
        this.config.autoSell = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.autoSell"),
            this.config.autoSell
        );
        this.config.showRPC = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.showRPC"),
            this.config.showRPC
        );
        this.config.autoResume = await this.configPrompter.trueFalse(
            t("ui.toggleOptions.autoResume"),
            this.config.autoResume
        );
    }

    static prompt = async (initialClient?: ExtendedClient<true>): Promise<{ accounts: { client: ExtendedClient<true>; config: Configuration }[] }> => {
        const client = initialClient || new ExtendedClient();
        this.client = client;
        this.configPrompter = new ConfigPrompter({ client, getConfig: () => this.config });

        // Retrieve any saved tokens to prefill as convenient defaults
        const savedKeys = this.configManager.getAllKeys();
        const savedTokens = savedKeys.map(k => this.configManager.get(k)?.token).filter(Boolean) as string[];

        // 1. Ask for up to 3 tokens directly
        const tokens = await this.configPrompter.getMultiTokens(savedTokens);
        if (tokens.length === 0) {
            logger.error("No tokens provided. At least 1 token is required.");
            process.exit(1);
        }

        // 2. Verify all tokens with Discord Gateway
        logger.info(`\n[Multi-Token] Verifying ${tokens.length} account(s) with Discord Gateway...`);
        const verifiedAccounts: { client: ExtendedClient<true>; token: string }[] = [];

        for (let i = 0; i < tokens.length; i++) {
            const tok = tokens[i];
            const accClient = new ExtendedClient();
            try {
                logger.info(`[Account ${i + 1}/${tokens.length}] Connecting...`);
                await accClient.checkAccount(tok);
                verifiedAccounts.push({ client: accClient, token: tok });
                logger.info(`[Account ${i + 1}/${tokens.length}] Connected as: ${accClient.user?.username}!`);
            } catch (err: any) {
                logger.error(`[Account ${i + 1}/${tokens.length}] Failed to connect: ${err.message}`);
            }
        }

        if (verifiedAccounts.length === 0) {
            logger.error("Failed to authenticate any of the provided accounts. Please check your tokens.");
            process.exit(1);
        }

        // 3. Single 1-time unified config edit
        this.client = verifiedAccounts[0].client;
        this.configPrompter = new ConfigPrompter({ client: this.client, getConfig: () => this.config });

        // Check if any existing config exists to prefill
        for (const acc of verifiedAccounts) {
            const existing = this.configManager.get(acc.client.user.id);
            if (existing) {
                this.config = { ...existing };
                break;
            }
        }

        logger.info(`\n${"=".repeat(62)}\n  [1-TIME CONFIGURATION] Set up settings ONCE for ALL ${verifiedAccounts.length} accounts:\n${"=".repeat(62)}`);
        await this.editConfig();

        // 4. Assign single config to all verified accounts
        const finalAccounts: { client: ExtendedClient<true>; config: Configuration }[] = [];
        for (const acc of verifiedAccounts) {
            const accConfig = {
                ...this.config,
                token: acc.token,
                username: acc.client.user.username,
            } as Configuration;
            this.configManager.set(acc.client.user.id, accConfig);
            finalAccounts.push({ client: acc.client, config: accConfig });
        }

        logger.info(`\n⚡ Successfully configured ${finalAccounts.length} accounts! Starting concurrent farming...`);
        return { accounts: finalAccounts };
    }
}