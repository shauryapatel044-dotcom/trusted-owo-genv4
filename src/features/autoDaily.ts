import { Schematic } from "@/structure/Schematic.js";
import { ranInt } from "@/utils/math.js";
import { logger } from "@/utils/logger.js";
import { dashboardState } from "@/dashboard/DashboardState.js";

export default Schematic.registerFeature({
    name: "autoDaily",
    cooldown: () => {
        const now = new Date();
        const nextDay = new Date(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1,
            ranInt(0, 1),
            ranInt(1, 15),
            ranInt(0, 59)
        );
        return Math.max(nextDay.getTime() - now.getTime(), 30 * 60 * 1000);
    },
    condition: async ({ agent: { config } }) => {
        return Boolean(config.autoDaily);
    },
    run: async ({ agent }) => {
        const dailyMsg = await agent.awaitResponse({
            trigger: () => agent.send("daily"),
            filter: (m) => m.author.id === agent.owoID && Boolean(
                m.content.toLowerCase().includes("daily") ||
                (m.embeds.length > 0 && (
                    m.embeds[0].title?.toLowerCase().includes("daily") ||
                    m.embeds[0].author?.name?.toLowerCase().includes("daily") ||
                    m.embeds[0].description?.toLowerCase().includes("daily")
                ))
            ),
            time: 15_000,
            expectResponse: false
        });

        if (dailyMsg) {
            const rawContent = dailyMsg.content + " " + (dailyMsg.embeds[0]?.description || "") + " " + (dailyMsg.embeds[0]?.author?.name || "");

            // 1. Streak Tracker Regex (e.g. "Streak: 15" or "15 days streak")
            const streakMatch = rawContent.match(/streak:?\s*(\d+)/i) || rawContent.match(/(\d+)\s*days?\s*streak/i);
            if (streakMatch) {
                agent.dailyStreak = parseInt(streakMatch[1], 10);
                logger.info(`📅 [Auto-Daily] ${agent.client.user.username} claimed daily! Current Streak: ${agent.dailyStreak} days 🔥`);
                dashboardState.broadcastStatus();
            }

            // 2. Cooldown Detection (e.g. "claim your daily in 14 hours and 20 minutes")
            const hoursMatch = rawContent.match(/(\d+)\s*h(?:our)?s?/i);
            const minsMatch = rawContent.match(/(\d+)\s*m(?:inute)?s?/i);
            const secsMatch = rawContent.match(/(\d+)\s*s(?:econd)?s?/i);

            if (hoursMatch || minsMatch) {
                const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
                const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
                const secs = secsMatch ? parseInt(secsMatch[1], 10) : 0;
                const waitTimeMs = (hours * 3600 + mins * 60 + secs) * 1000 + ranInt(60000, 180000);
                agent.nextDailyAt = Date.now() + waitTimeMs;
                logger.info(`📅 [Auto-Daily] ${agent.client.user.username} daily already on cooldown. Next claim in ${hours}h ${mins}m (at ${new Date(agent.nextDailyAt).toLocaleTimeString()}).`);
                return waitTimeMs;
            }
        }

        // Next UTC Reset (~24 hours with small human jitter)
        const now = new Date();
        const nextDay = new Date(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1,
            ranInt(0, 1),
            ranInt(2, 10),
            ranInt(0, 59)
        );
        const cooldown = Math.max(nextDay.getTime() - now.getTime(), 60 * 60 * 1000);
        agent.nextDailyAt = Date.now() + cooldown;
        return cooldown;
    }
});