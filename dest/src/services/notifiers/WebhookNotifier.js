import { logger } from "../../utils/logger.js";
import { MessageEmbed, WebhookClient } from "discord.js-selfbot-v13";
export class WebhookNotifier {
    async execute({ agent }, payload) {
        if (!agent.config.webhookURL) {
            logger.warn("Webhook URL is not configured, skipping Webhook Notifier execution.");
            return;
        }
        try {
            const { title, description, urgency, sourceUrl, imageUrl, content, fields } = payload;
            const webhook = new WebhookClient({ url: agent.config.webhookURL });
            const embed = new MessageEmbed()
                .setTitle(title)
                .setURL(sourceUrl ?? "")
                .setDescription(description)
                .setColor(urgency === "critical"
                ? "#EF4444"
                : "#10B981")
                .setFooter({
                text: "Trusted OwO GEnv4 • Enterprise Farm",
                iconURL: "https://i.imgur.com/EqChQK1.png",
            })
                .setTimestamp();
            if (imageUrl)
                embed.setImage(imageUrl);
            if (fields)
                embed.addFields(fields);
            await webhook.send({
                username: "Trusted OwO GEnv4 Controller",
                content,
                avatarURL: agent.client.user?.displayAvatarURL() ??
                    "https://i.imgur.com/9wrvM38.png",
                embeds: [embed],
            });
        }
        catch (error) {
            logger.error("Failed to send webhook notification:");
            logger.error(error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Send formatted rich embeds for any farming event
     */
    static async sendRichEmbed(agent, data) {
        if (!agent.config.webhookURL)
            return;
        try {
            const webhook = new WebhookClient({ url: agent.config.webhookURL });
            const embed = new MessageEmbed()
                .setTitle(data.title)
                .setColor(data.color ?? "#EF4444")
                .setFooter({
                text: data.footerText ?? `Trusted OwO GEnv4 • Account: ${agent.client.user?.username || "Worker"}`,
                iconURL: agent.client.user?.displayAvatarURL() ?? "https://i.imgur.com/EqChQK1.png"
            })
                .setTimestamp();
            if (data.description)
                embed.setDescription(data.description);
            if (data.authorName) {
                embed.setAuthor({
                    name: data.authorName,
                    iconURL: data.authorIcon ?? agent.client.user?.displayAvatarURL()
                });
            }
            if (data.imageUrl)
                embed.setImage(data.imageUrl);
            if (data.fields && data.fields.length > 0) {
                embed.addFields(data.fields);
            }
            await webhook.send({
                username: "Trusted OwO Farm Monitor",
                avatarURL: agent.client.user?.displayAvatarURL() ?? "https://i.imgur.com/9wrvM38.png",
                embeds: [embed]
            });
        }
        catch (err) {
            logger.error(`[Webhook Alert] Failed to send rich embed: ${err.message}`);
        }
    }
    /**
     * 1. Captcha Alert (Critical Red)
     */
    static async sendCaptchaAlert(agent, channelName) {
        await this.sendRichEmbed(agent, {
            title: "🚨 CAPTCHA DETECTED - Farm Paused",
            description: `A security captcha has been triggered on account **${agent.client.user?.username}** in channel **#${channelName}**. The farming loop has been safely frozen.`,
            color: "#EF4444",
            fields: [
                { name: "👤 Account", value: `\`${agent.client.user?.tag || agent.client.user?.username}\``, inline: true },
                { name: "📍 Channel", value: `\`#${channelName}\``, inline: true },
                { name: "⚙️ Solver", value: agent.config.captchaAPI ? `\`${agent.config.captchaAPI}\`` : "`Auto / Mirai Free`", inline: true },
                { name: "🛡️ Action", value: "Solving in background, farm paused until verified.", inline: false }
            ]
        });
    }
    /**
     * 2. Captcha Resolved (Emerald Green)
     */
    static async sendCaptchaResolved(agent) {
        await this.sendRichEmbed(agent, {
            title: "✅ CAPTCHA RESOLVED - Resuming 24/7 Farm",
            description: `The captcha verification was successfully passed for **${agent.client.user?.username}**! Normal 24/7 automation has resumed.`,
            color: "#10B981",
            fields: [
                { name: "👤 Account", value: `\`${agent.client.user?.username}\``, inline: true },
                { name: "🎯 Total Solved", value: `\`${agent.totalCaptchaSolved + 1}\``, inline: true },
                { name: "⚡ Status", value: "`RUNNING 24/7`", inline: true }
            ]
        });
    }
    /**
     * 3. Daily Streak Claimed (Gold / Amber)
     */
    static async sendDailyClaimed(agent, streak) {
        await this.sendRichEmbed(agent, {
            title: "📅 Daily Streak Claimed!",
            description: `**${agent.client.user?.username}** has claimed today's daily Cowoncy reward!`,
            color: "#F59E0B",
            fields: [
                { name: "👤 Account", value: `\`${agent.client.user?.username}\``, inline: true },
                { name: "🔥 Current Streak", value: `**${streak} Days**`, inline: true },
                { name: "⏳ Next Claim", value: "In ~24 hours (Midnight UTC)", inline: true }
            ]
        });
    }
    /**
     * 4. 10-Minute Rest Break Alert (Indigo / Blue)
     */
    static async sendBreakNotice(agent, commands, resumeTimeStr) {
        await this.sendRichEmbed(agent, {
            title: "☕ 10-Minute Rest Break Started",
            description: `Account **${agent.client.user?.username}** completed **${commands} commands** and is taking a natural 10-minute rest break for anti-ban stealth.`,
            color: "#6366F1",
            fields: [
                { name: "👤 Account", value: `\`${agent.client.user?.username}\``, inline: true },
                { name: "📊 Commands Completed", value: `\`${commands}\``, inline: true },
                { name: "⏳ Resumes At", value: `\`${resumeTimeStr}\``, inline: true }
            ]
        });
    }
    /**
     * 5. Rest Break Completed & Resumed (Cyan)
     */
    static async sendBreakResume(agent) {
        await this.sendRichEmbed(agent, {
            title: "⚡ 10-Minute Break Completed - Resumed",
            description: `Account **${agent.client.user?.username}** finished its rest break and has seamlessly resumed 24/7 grinding loop!`,
            color: "#06B6D4",
            fields: [
                { name: "👤 Account", value: `\`${agent.client.user?.username}\``, inline: true },
                { name: "🔄 Next Break", value: "After next ~100 commands", inline: true }
            ]
        });
    }
    /**
     * 6. Rare Catch Alert (Purple)
     */
    static async sendRareCatch(agent, animalText) {
        await this.sendRichEmbed(agent, {
            title: "🌟 Rare / Mythical Animal Caught!",
            description: `**${agent.client.user?.username}** caught a rare catch during hunting!`,
            color: "#A855F7",
            fields: [
                { name: "👤 Account", value: `\`${agent.client.user?.username}\``, inline: true },
                { name: "🦁 Catch Details", value: `\`${animalText.slice(0, 150)}\``, inline: false }
            ]
        });
    }
}
