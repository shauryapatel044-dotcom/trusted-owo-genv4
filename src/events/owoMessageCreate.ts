import { CriticalEventHandler } from "@/handlers/CriticalEventHandler.js";
import { CaptchaService } from "@/services/CaptchaService.js";
import { Schematic } from "@/structure/Schematic.js";
import { NORMALIZE_REGEX } from "@/typings/constants.js";
import { logger } from "@/utils/logger.js";
import { WebhookNotifier } from "@/services/notifiers/WebhookNotifier.js";
import { dashboardState } from "@/dashboard/DashboardState.js";

export default Schematic.registerEvent({
    name: "owoMessageEvent",
    event: "messageCreate",
    handler: async (params, message) => {
        const { agent, t, locale } = params;

        if (message.author.id !== agent.owoID) return;

        const normalizedContent = message.content.normalize("NFC").replace(NORMALIZE_REGEX, "");

        const isForThisUser = message.channel.type === "DM" ||
            normalizedContent.includes(message.client.user?.id!) ||
            normalizedContent.includes(message.client.user?.username!) ||
            normalizedContent.includes(message.client.user?.displayName!) ||
            normalizedContent.includes(message.guild?.members.me?.displayName!);

        if (!isForThisUser) return;

        // 1. Check for Captcha
        if (/are you a real human|(check|verify) that you are.{1,3}human!/img.test(normalizedContent)) {
            const chName = (message.channel.type === "DM" ? message.channel.recipient?.displayName : message.channel.name) || "DM/Channel";
            logger.alert(`Captcha detected in channel: ${chName}!`);
            agent.captchaDetected = true;
            WebhookNotifier.sendCaptchaAlert(agent, chName).catch(() => {});
            return CaptchaService.handleCaptcha({ agent, t, locale }, message);
        }

        // 2. Check for Captcha Success
        if (/verified that you are.{1,3}human!/igm.test(normalizedContent)) {
            logger.info(`CAPTCHA HAS BEEN RESOLVED, ${agent.config.autoResume ? "RESTARTING SELFBOT" : "STOPPING SELFBOT"}...`)
            WebhookNotifier.sendCaptchaResolved(agent).catch(() => {});
            if (!agent.config.autoResume) process.exit(0)
            agent.captchaDetected = false
            agent.farmLoop()
        }

        // 3. Check for Ban
        if (/have been banned/.test(normalizedContent)) {
            return CriticalEventHandler.handleBan(params);
        }

        // 4. Check for No Money
        if (normalizedContent.includes("You don't have enough cowoncy!")) {
            return CriticalEventHandler.handleNoMoney(params);
        }

        // 5. Check for Rare Catch Alert
        if (/found a|caught a|you found|you caught/i.test(normalizedContent)) {
            if (/mythical|legendary|fabled|special|gem/i.test(normalizedContent)) {
                WebhookNotifier.sendRareCatch(agent, normalizedContent).catch(() => {});
            }
        }

        // 6. Track Cowoncy Balance dynamically
        const cowoncyMatch = normalizedContent.match(/(?:you\s+(?:currently\s+)?have|balance:?|you\s+now\s+have)\s*([0-9,]+)\s*(?:cowoncy|<:cowoncy:\d+>)?/i);
        if (cowoncyMatch) {
            const rawVal = cowoncyMatch[1].replace(/,/g, "");
            const parsedAmount = parseInt(rawVal, 10);
            if (!isNaN(parsedAmount) && parsedAmount >= 0) {
                agent.cowoncy = parsedAmount;
                dashboardState.broadcastStatus();
            }
        }
    }
})