import { Collection, Message, RichPresence } from "discord.js-selfbot-v13";
import path from "node:path";
import { ranInt } from "../utils/math.js";
import { logger } from "../utils/logger.js";
import { watchConfig } from "../utils/watcher.js";
import featuresHandler from "../handlers/featuresHandler.js";
import { t, getCurrentLocale } from "../utils/locales.js";
import { shuffleArray } from "../utils/array.js";
import commandsHandler from "../handlers/commandsHandler.js";
import eventsHandler from "../handlers/eventsHandler.js";
import { CooldownManager } from "./core/CooldownManager.js";
import { fileURLToPath } from "node:url";
import { CriticalEventHandler } from "../handlers/CriticalEventHandler.js";
import { dashboardState } from "../dashboard/DashboardState.js";
export class BaseAgent {
    rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    miraiID = "1205422490969579530";
    client;
    config;
    cache;
    authorizedUserIDs = [];
    commands = new Collection();
    cooldownManager = new CooldownManager();
    features = new Collection();
    owoID = "408785106942164992";
    prefix = "owo";
    activeChannel;
    totalCaptchaSolved = 0;
    totalCaptchaFailed = 0;
    totalCommands = 0;
    totalTexts = 0;
    invalidResponseCount = 0;
    invalidResponseThreshold = 5;
    gem1Cache;
    gem2Cache;
    gem3Cache;
    starCache;
    channelChangeThreshold = ranInt(17, 56);
    autoSleepThreshold = ranInt(98, 102); // break after ~100 commands
    nextDistractionAt = ranInt(22, 38); // Alt-tab distraction pause every 22-38 cmds
    distractionCounter = 0;
    lastSleepAt = 0;
    breakUntil = 0;
    dailyStreak = 0;
    nextDailyAt = 0;
    cowoncy = 0;
    activeQuests = [];
    jitterOffset = ranInt(1500, 5000);
    captchaDetected = false;
    farmLoopRunning = false;
    farmLoopPaused = false;
    expectResponseOnAllAwaits = false;
    constructor(client, config) {
        this.client = client;
        this.cache = structuredClone(config);
        this.config = watchConfig(config, (key, oldValue, newValue) => {
            logger.debug(`Configuration updated: ${key} changed from ${oldValue} to ${newValue}`);
        });
        this.authorizedUserIDs.push(this.client.user.id, ...(this.config.adminID ? [this.config.adminID] : []));
        this.client.options.sweepers = {
            messages: {
                interval: 60 * 60,
                lifetime: 60 * 60 * 24,
            },
            users: {
                interval: 60 * 60,
                filter: () => (user) => this.authorizedUserIDs.includes(user.id),
            },
        };
    }
    setActiveChannel = async (id) => {
        const rawChannelIDs = this.config.channelID;
        if (!rawChannelIDs || (Array.isArray(rawChannelIDs) && rawChannelIDs.length === 0)) {
            logger.error(`Account ${this.client.user?.username}: No channel IDs provided in the configuration.`);
            return undefined;
        }
        const channelIDs = (Array.isArray(rawChannelIDs) ? rawChannelIDs : [rawChannelIDs])
            .map(c => String(c).trim())
            .filter(Boolean);
        if (channelIDs.length === 0)
            return undefined;
        const targetChannelID = id || channelIDs[ranInt(0, channelIDs.length)];
        try {
            // 1. Try Discord client cache first
            let channel = this.client.channels.cache.get(targetChannelID);
            // 2. Fetch directly from Discord API if not in cache (essential for selfbots)
            if (!channel) {
                channel = await this.client.channels.fetch(targetChannelID).catch(() => null);
            }
            // 3. If still not found, fetch guild first
            if (!channel && this.config.guildID) {
                const cleanGuildId = String(this.config.guildID).trim();
                const guild = this.client.guilds.cache.get(cleanGuildId)
                    || await this.client.guilds.fetch(cleanGuildId).catch(() => null);
                if (guild) {
                    channel = await guild.channels.fetch(targetChannelID).catch(() => null);
                }
            }
            if (channel && channel.isText()) {
                this.activeChannel = channel;
                logger.info(t("agent.messages.activeChannelSet", { channelName: this.activeChannel.name }));
                return this.activeChannel;
            }
            // 4. Try any of the other configured channel IDs
            for (const fallbackId of channelIDs) {
                if (fallbackId === targetChannelID)
                    continue;
                let fbChannel = this.client.channels.cache.get(fallbackId)
                    || await this.client.channels.fetch(fallbackId).catch(() => null);
                if (fbChannel && fbChannel.isText()) {
                    this.activeChannel = fbChannel;
                    logger.info(`[Channel Sync] Set active channel to fallback: #${this.activeChannel.name}`);
                    return this.activeChannel;
                }
            }
            // 5. Fallback: Find any readable & writable text channel in the guild
            if (this.config.guildID) {
                const cleanGuildId = String(this.config.guildID).trim();
                const guild = this.client.guilds.cache.get(cleanGuildId)
                    || await this.client.guilds.fetch(cleanGuildId).catch(() => null);
                if (guild) {
                    const availableChannels = await guild.channels.fetch().catch(() => null);
                    if (availableChannels) {
                        const sendableChannel = availableChannels.find((c) => c && c.isText() && c.permissionsFor(this.client.user)?.has("SEND_MESSAGES"));
                        if (sendableChannel) {
                            this.activeChannel = sendableChannel;
                            logger.warn(`[Channel Sync] Target channel ${targetChannelID} not found. Auto-fallback to guild text channel: #${this.activeChannel.name} (${this.activeChannel.id})`);
                            return this.activeChannel;
                        }
                    }
                }
            }
            logger.error(`Account ${this.client.user?.username}: Cannot access channel ${targetChannelID} or find text channel in server ${this.config.guildID}. Make sure the account has joined the server and can see the channel.`);
        }
        catch (error) {
            logger.error(`Failed to fetch channel with ID ${targetChannelID}: ${error}`);
        }
        return undefined;
    };
    reloadConfig = () => {
        for (const key of Object.keys(this.cache)) {
            this.config[key] = this.cache[key];
        }
        logger.info(t("agent.messages.configReloaded"));
    };
    send = async (content, options = {
        channel: this.activeChannel,
        prefix: this.prefix,
    }) => {
        if (!this.activeChannel) {
            await this.setActiveChannel();
        }
        if (!this.activeChannel) {
            logger.warn(t("agent.messages.noActiveChannel"));
            return;
        }
        this.client.sendMessage(content, options);
        if (!!options.prefix)
            this.totalCommands++;
        else
            this.totalTexts++;
    };
    isBotOnline = async () => {
        try {
            if (!this.activeChannel) {
                await this.setActiveChannel();
            }
            if (!this.activeChannel)
                return false;
            const owo = await this.activeChannel.guild.members.fetch(this.owoID).catch(() => null);
            return !!owo;
        }
        catch (error) {
            logger.warn(t("agent.messages.owoStatusCheckFailed"));
            return false;
        }
    };
    awaitResponse = (options) => {
        return new Promise((resolve, reject) => {
            let { channel = this.activeChannel, filter, time = 30_000, max = 1, trigger, expectResponse = false, } = options;
            if (!channel && this.activeChannel) {
                channel = this.activeChannel;
            }
            // Guard: resolve undefined safely if no channel can be resolved
            if (!channel) {
                logger.warn("[awaitResponse] No active channel available yet, skipping awaitResponse.");
                return resolve(undefined);
            }
            const collector = channel.createMessageCollector({
                filter,
                time,
                max,
            });
            collector.once("collect", (message) => {
                resolve(message);
            });
            collector.once("end", (collected) => {
                if (collected.size === 0) {
                    if (expectResponse || this.expectResponseOnAllAwaits) {
                        this.invalidResponseCount++;
                        logger.debug(`No response received within the specified time (${this.invalidResponseCount}/${this.invalidResponseThreshold}).`);
                    }
                    if (this.invalidResponseCount >= this.invalidResponseThreshold) {
                        logger.warn(`[awaitResponse] Consecutive commands without response exceeded threshold (${this.invalidResponseCount}). Resetting.`);
                        this.invalidResponseCount = 0;
                    }
                    resolve(undefined);
                }
                else {
                    logger.debug(`Response received: ${collected.first()?.content.slice(0, 35)}...`);
                    this.invalidResponseCount = 0;
                }
            });
            trigger();
        });
    };
    awaitSlashResponse = async (options) => {
        const { channel = this.activeChannel, bot = this.owoID, command, args = [], time = 30_000, } = options;
        if (!channel) {
            throw new Error("awaitSlashResponse requires a channel, but none was provided or set as active.");
        }
        const message = await channel.sendSlash(bot, command, ...args);
        if (!(message instanceof Message)) {
            throw new Error("Unsupported message type returned from sendSlash.");
        }
        if (message.flags.has("LOADING"))
            return new Promise((resolve, reject) => {
                let timeout;
                const listener = async (...args) => {
                    const [_, m] = args;
                    if (_.id !== message.id)
                        return;
                    cleanup();
                    if (m.partial) {
                        try {
                            const fetchedMessage = await m.fetch();
                            return resolve(fetchedMessage);
                        }
                        catch (error) {
                            logger.error("Failed to fetch partial message");
                            reject(error);
                        }
                    }
                    else {
                        resolve(m);
                    }
                };
                const cleanup = () => {
                    message.client.off("messageUpdate", listener);
                    clearTimeout(timeout);
                };
                message.client.on("messageUpdate", listener);
                timeout = setTimeout(() => {
                    cleanup();
                    reject(new Error("AwaitSlashResponse timed out"));
                }, time);
            });
        return Promise.resolve(message);
    };
    loadPresence = () => {
        const rpc = new RichPresence(this.client)
            .setApplicationId(this.miraiID)
            .setType("PLAYING")
            .setName("Mirai Kuriyama")
            .setDetails("The day the emperor returns!")
            .setStartTimestamp(this.client.readyTimestamp)
            .setAssetsLargeImage("1312264004382621706")
            .setAssetsLargeText("Advanced Discord OwO Tool Farm")
            .setAssetsSmallImage("1306938859552247848")
            .setAssetsSmallText("Copyright © Kyou-Izumi 2025")
            .addButton("GitHub", "https://github.com/Kyou-Izumi/advanced-discord-owo-tool-farm")
            .addButton("YouTube", "https://www.youtube.com/@daongotau");
        this.client.user.setPresence({ activities: [rpc] });
    };
    farmLoop = async () => {
        if (this.farmLoopRunning) {
            logger.debug("Double farm loop detected, skipping this iteration.");
            return;
        }
        if (this.farmLoopPaused) {
            logger.debug("Farm loop is paused, skipping this iteration.");
            return;
        }
        if (this.breakUntil > Date.now()) {
            const remaining = this.breakUntil - Date.now();
            logger.debug(`[Break] Account ${this.client.user?.username} is resting, resuming in ${Math.ceil(remaining / 1000)}s...`);
            setTimeout(() => {
                this.farmLoop();
            }, Math.min(remaining + ranInt(1000, 2500), 20000));
            return;
        }
        // Optional Circadian Night Sleep Simulation
        if (this.config.nightMode) {
            const currentHour = new Date().getHours();
            const start = this.config.nightStartHour ?? 2;
            const end = this.config.nightEndHour ?? 7;
            const isNight = start < end
                ? (currentHour >= start && currentHour < end)
                : (currentHour >= start || currentHour < end);
            if (isNight) {
                logger.info(`🌙 [Night Sleep] Current hour ${currentHour}:00 is within night schedule (${start}:00 - ${end}:00) for ${this.client.user?.username}. Sleeping...`);
                try {
                    this.client.user?.setStatus("idle");
                }
                catch { }
                setTimeout(() => {
                    this.farmLoop();
                }, ranInt(10 * 60 * 1000, 15 * 60 * 1000));
                return;
            }
        }
        if (!this.activeChannel) {
            await this.setActiveChannel();
        }
        if (!this.activeChannel) {
            logger.warn(`Account ${this.client.user?.username}: No active channel is set or accessible. Retrying in 10s...`);
            setTimeout(() => {
                this.farmLoop();
            }, 10_000);
            return;
        }
        this.farmLoopRunning = true;
        try {
            const featureKeys = Array.from(this.features.keys());
            if (featureKeys.length === 0) {
                logger.warn(t("agent.messages.noFeaturesAvailable"));
                return;
            }
            for (const featureKey of shuffleArray(featureKeys)) {
                if (this.captchaDetected) {
                    logger.debug("Captcha detected, skipping feature execution.");
                    return;
                }
                if (this.breakUntil > Date.now()) {
                    logger.debug("Break triggered, pausing current farm iteration.");
                    break;
                }
                const botStatus = await this.isBotOnline();
                if (!botStatus) {
                    logger.warn(t("agent.messages.owoOfflineDetected"));
                    this.expectResponseOnAllAwaits = true;
                }
                else {
                    this.expectResponseOnAllAwaits = false;
                }
                const feature = this.features.get(featureKey);
                if (!feature) {
                    logger.warn(t("agent.messages.featureNotFound", { featureKey }));
                    continue;
                }
                try {
                    const shouldRun = await feature.condition({ agent: this, t, locale: getCurrentLocale() })
                        && this.cooldownManager.onCooldown("feature", feature.name) === 0;
                    if (!shouldRun)
                        continue;
                    const res = await feature.run({ agent: this, t, locale: getCurrentLocale() });
                    const baseCooldown = typeof res === "number" && !isNaN(res) ? res : feature.cooldown() || 30_000;
                    // Anti-ban cooldown jitter (+/- 8% to 15%)
                    const cdJitter = ranInt(-Math.floor(baseCooldown * 0.08), Math.floor(baseCooldown * 0.12));
                    this.cooldownManager.set("feature", feature.name, Math.max(baseCooldown + cdJitter, 8_000));
                    // Anti-ban human delay between commands
                    await this.client.sleep(ranInt(900, 4800));
                    // Natural human alt-tab distraction pause (every 22-38 commands)
                    if (this.config.humanizeDistraction !== false) {
                        this.distractionCounter++;
                        if (this.distractionCounter >= this.nextDistractionAt) {
                            this.distractionCounter = 0;
                            this.nextDistractionAt = ranInt(22, 38);
                            const pauseSec = ranInt(18, 42);
                            logger.info(`☕ [Humanize] Account ${this.client.user?.username} taking an alt-tab distraction pause (${pauseSec}s)...`);
                            await this.client.sleep(pauseSec * 1000);
                        }
                    }
                }
                catch (error) {
                    logger.error(`Error running feature ${feature.name}:`);
                    logger.error(error);
                }
            }
            if (!this.captchaDetected && !this.farmLoopPaused && this.breakUntil <= Date.now()) {
                setTimeout(() => {
                    this.farmLoop();
                }, ranInt(1500, 6800));
            }
        }
        catch (error) {
            logger.error("Error occurred during farm loop execution:");
            logger.error(error);
        }
        finally {
            this.farmLoopRunning = false;
        }
    };
    registerEvents = async () => {
        CriticalEventHandler.handleRejection({
            agent: this,
            t,
            locale: getCurrentLocale(),
        });
        await featuresHandler.run({
            agent: this,
            t,
            locale: getCurrentLocale(),
        });
        logger.info(t("agent.messages.featuresRegistered", { count: this.features.size }));
        await commandsHandler.run({
            agent: this,
            t,
            locale: getCurrentLocale(),
        });
        logger.info(t("agent.messages.commandsRegistered", { count: this.commands.size }));
        await eventsHandler.run({
            agent: this,
            t,
            locale: getCurrentLocale(),
        });
        if (this.config.showRPC)
            this.loadPresence();
    };
    syncBalance = async () => {
        if (!this.activeChannel)
            return undefined;
        try {
            const cashMsg = await this.awaitResponse({
                trigger: () => this.send("cash"),
                filter: (m) => m.author.id === this.owoID
                    && (m.content.includes(this.client.user?.id)
                        || (this.client.user?.username && m.content.toLowerCase().includes(this.client.user.username.toLowerCase()))
                        || (this.client.user?.displayName && m.content.toLowerCase().includes(this.client.user.displayName.toLowerCase()))
                        || (m.guild?.members.me?.displayName && m.content.toLowerCase().includes(m.guild.members.me.displayName.toLowerCase()))
                        || /cowoncy|currently have/i.test(m.content)),
                time: 15_000,
                expectResponse: false
            });
            if (cashMsg) {
                const embedContent = (cashMsg.embeds || []).map(e => `${e.title || ""} ${e.description || ""} ${e.fields?.map(f => `${f.name} ${f.value}`).join(" ") || ""}`).join(" ");
                const clean = (cashMsg.content + " " + embedContent)
                    .replace(/<a?:cowoncy:\d+>/gi, " cowoncy ")
                    .replace(/[*_`]/g, "")
                    .replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, " ");
                const m1 = clean.match(/([0-9,]+)\s*cowoncy/i);
                const m2 = clean.match(/(?:balance|cowoncy)\s*:?\s*([0-9,]+)/i);
                const m3 = clean.match(/(?:you\s+(?:currently\s+|now\s+)?have)\s*([0-9,]+)/i);
                const match = m1 || m2 || m3;
                if (match) {
                    const amount = parseInt(match[1].replace(/,/g, ""), 10);
                    if (!isNaN(amount) && amount >= 0) {
                        this.cowoncy = amount;
                        logger.info(`💰 [Balance Audit] Initial balance for ${this.client.user?.username}: ${amount.toLocaleString()} Cowoncy`);
                        dashboardState.broadcastStatus();
                        return amount;
                    }
                }
            }
        }
        catch (err) {
            logger.debug(`[Balance Audit] Initial balance check skipped: ${err}`);
        }
        return undefined;
    };
    static initialize = async (client, config) => {
        logger.debug("Initializing BaseAgent...");
        if (!client.isReady()) {
            throw new Error("Client is not ready. Ensure the client is logged in before initializing the agent.");
        }
        const agent = new BaseAgent(client, config);
        await agent.setActiveChannel();
        await agent.registerEvents();
        logger.debug("BaseAgent initialized successfully.");
        logger.info(t("agent.messages.loggedIn", { username: client.user.username }));
        // Register to Red Dashboard controller
        dashboardState.registerAccount(client, agent, config);
        // Anti-ban phase stagger offset on startup
        setTimeout(() => {
            agent.farmLoop();
        }, agent.jitterOffset);
        // Immediate proactive balance audit on startup (staggered by 3s to not collide with initial command)
        setTimeout(() => {
            agent.syncBalance().catch(() => { });
        }, agent.jitterOffset + 3500);
        return agent;
    };
}
