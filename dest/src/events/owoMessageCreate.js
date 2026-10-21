import { CriticalEventHandler } from "../handlers/CriticalEventHandler.js";
import { CaptchaService } from "../services/CaptchaService.js";
import { Schematic } from "../structure/Schematic.js";
import { NORMALIZE_REGEX } from "../typings/constants.js";
import { logger } from "../utils/logger.js";
import { WebhookNotifier } from "../services/notifiers/WebhookNotifier.js";
import { dashboardState } from "../dashboard/DashboardState.js";
export default Schematic.registerEvent({
    name: "owoMessageEvent",
    event: "messageCreate",
    handler: async (params, message) => {
        const { agent, t, locale } = params;
        if (message.author.id !== agent.owoID)
            return;
        const normalizedContent = message.content.normalize("NFC").replace(NORMALIZE_REGEX, "");
        const isForThisUser = message.channel.type === "DM" ||
            normalizedContent.includes(message.client.user?.id) ||
            normalizedContent.includes(message.client.user?.username) ||
            normalizedContent.includes(message.client.user?.displayName) ||
            normalizedContent.includes(message.guild?.members.me?.displayName);
        if (!isForThisUser)
            return;
        // 1. Comprehensive Check for Captchas, Verification Warnings, and Links
        const isCaptchaOrWarning = /are you a real human/i.test(normalizedContent) ||
            /(?:check|verify) that you are.{1,3}human/i.test(normalizedContent) ||
            /complete (?:this|the|your) captcha/i.test(normalizedContent) ||
            /warning has been issued/i.test(normalizedContent) ||
            /owobot\.com\/captcha/i.test(normalizedContent) ||
            (message.embeds || []).some(e => /captcha|warning|verify/i.test((e.title || "") + " " + (e.description || ""))) ||
            (message.components || []).some(row => row.components?.some((btn) => btn.url && (/owobot\.com/i.test(btn.url) || /408785106942164992/.test(btn.url))));
        if (isCaptchaOrWarning) {
            const chName = (message.channel.type === "DM" ? message.channel.recipient?.displayName : message.channel.name) || "DM/Channel";
            logger.alert(`🚨 Captcha or Ban Warning detected for account ${agent.client.user?.username} in ${chName}!`);
            // Immediately halt this specific account to protect it
            agent.captchaDetected = true;
            agent.farmLoopPaused = true;
            agent.farmLoopRunning = false;
            dashboardState.broadcastStatus();
            WebhookNotifier.sendCaptchaAlert(agent, chName).catch(() => { });
            return CaptchaService.handleCaptcha({ agent, t, locale }, message);
        }
        // 2. Check for Captcha Success / Resolution
        if (/verified that you are.{1,3}human!/igm.test(normalizedContent)) {
            logger.info(`✅ CAPTCHA RESOLVED for ${agent.client.user?.username}! Resuming farming loop...`);
            WebhookNotifier.sendCaptchaResolved(agent).catch(() => { });
            agent.captchaDetected = false;
            agent.farmLoopPaused = false;
            agent.farmLoop();
            dashboardState.broadcastStatus();
        }
        // 3. Check for Ban / Suspension
        if (/have been banned|have been suspended/i.test(normalizedContent)) {
            agent.captchaDetected = true;
            agent.farmLoopPaused = true;
            agent.farmLoopRunning = false;
            dashboardState.broadcastStatus();
            return CriticalEventHandler.handleBan(params);
        }
        // 4. Check for No Money
        if (normalizedContent.includes("You don't have enough cowoncy!")) {
            return CriticalEventHandler.handleNoMoney(params);
        }
        // 5. Check for Rare Catch Alert
        if (/found a|caught a|you found|you caught/i.test(normalizedContent)) {
            if (/mythical|legendary|fabled|special|gem/i.test(normalizedContent)) {
                WebhookNotifier.sendRareCatch(agent, normalizedContent).catch(() => { });
            }
        }
    }
});
