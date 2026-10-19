import { Schematic } from "@/structure/Schematic.js";
import { formatTime } from "@/utils/time.js";
import { logger } from "@/utils/logger.js";
import { ranInt } from "@/utils/math.js";
import { dashboardState } from "@/dashboard/DashboardState.js";
import { WebhookNotifier } from "@/services/notifiers/WebhookNotifier.js";

export default Schematic.registerFeature({
    name: "autoSleep",
    cooldown: () => 30 * 1000,
    condition: async ({ agent }) => {
        if (!agent.config.autoSleep) return false;

        const targetThreshold = agent.config.sleepCommandsThreshold || 100;
        const commandsSinceLastSleep = agent.totalCommands - agent.lastSleepAt;
        return commandsSinceLastSleep >= (agent.autoSleepThreshold || targetThreshold);
    },
    run: async ({ agent }) => {
        const commandsSinceLastSleep = agent.totalCommands - agent.lastSleepAt;
        const breakMinutes = agent.config.sleepDurationMinutes || 10;

        // Break duration customizable (default 10 mins with human jitter)
        const sleepTime = Math.max(60 * 1000, (breakMinutes * 60 * 1000) + ranInt(-10000, 15000));

        // Threshold customizable (default ~100 commands with human jitter)
        const targetThreshold = agent.config.sleepCommandsThreshold || 100;
        const nextThreshold = ranInt(Math.max(10, targetThreshold - 3), targetThreshold + 3);
        agent.lastSleepAt = agent.totalCommands;
        agent.autoSleepThreshold = nextThreshold;
        agent.breakUntil = Date.now() + sleepTime;

        const resumeDate = new Date(agent.breakUntil);
        const resumeTimeStr = resumeDate.toLocaleTimeString();

        logger.info(`☕ [Rest Break] Account ${agent.client.user?.username} completed ${commandsSinceLastSleep} commands! Taking a ${breakMinutes}-minute break for human stealth.`);
        logger.info(`⏳ [Rest Break] Account ${agent.client.user?.username} will resume 24/7 farming at ${resumeTimeStr} (Next break after ~${nextThreshold} commands).`);

        // Discord Presence Cycling: Go Idle during break (realistic human AFK)
        try { agent.client.user?.setStatus("idle"); } catch {}

        dashboardState.broadcastStatus();
        WebhookNotifier.sendBreakNotice(agent, commandsSinceLastSleep, resumeTimeStr).catch(() => {});

        await agent.client.sleep(sleepTime);

        // Discord Presence Cycling: Return to Online after break
        try { agent.client.user?.setStatus("online"); } catch {}

        agent.breakUntil = 0;
        dashboardState.broadcastStatus();
        WebhookNotifier.sendBreakResume(agent).catch(() => {});

        logger.info(`⚡ [Rest Break] Account ${agent.client.user?.username} finished break! Resuming 24/7 farming loop immediately.`);

        return 30 * 1000;
    }
});