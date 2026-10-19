import { Schematic } from "@/structure/Schematic.js";
import { formatTime } from "@/utils/time.js";
import { logger } from "@/utils/logger.js";
import { ranInt } from "@/utils/math.js";
import { dashboardState } from "@/dashboard/DashboardState.js";

export default Schematic.registerFeature({
    name: "autoSleep",
    cooldown: () => 30 * 1000,
    condition: async ({ agent }) => {
        if (!agent.config.autoSleep) return false;

        const commandsSinceLastSleep = agent.totalCommands - agent.lastSleepAt;
        return commandsSinceLastSleep >= agent.autoSleepThreshold;
    },
    run: async ({ agent }) => {
        const commandsSinceLastSleep = agent.totalCommands - agent.lastSleepAt;

        // Break duration: Exactly 10 minutes with subtle human jitter (~9m 50s to 10m 15s)
        const sleepTime = (10 * 60 * 1000) + ranInt(-10000, 15000);

        // Next threshold jittered around 100 commands (98 to 103)
        const nextThreshold = ranInt(98, 103);
        agent.lastSleepAt = agent.totalCommands;
        agent.autoSleepThreshold = nextThreshold;
        agent.breakUntil = Date.now() + sleepTime;

        const resumeDate = new Date(agent.breakUntil);
        const resumeTimeStr = resumeDate.toLocaleTimeString();

        logger.info(`☕ [10m Break] Account ${agent.client.user?.username} completed ${commandsSinceLastSleep} commands! Taking a 10-minute break to ensure 100% human stealth.`);
        logger.info(`⏳ [10m Break] Account ${agent.client.user?.username} will resume 24/7 farming at ${resumeTimeStr} (Next break after ~${nextThreshold} commands).`);

        dashboardState.broadcastStatus();

        await agent.client.sleep(sleepTime);

        agent.breakUntil = 0;
        dashboardState.broadcastStatus();

        logger.info(`⚡ [10m Break] Account ${agent.client.user?.username} 10-minute break completed! Resuming 24/7 farming loop immediately.`);

        return 30 * 1000;
    }
});