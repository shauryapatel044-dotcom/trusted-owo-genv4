import { Schematic } from "@/structure/Schematic.js";
import { ranInt } from "@/utils/math.js";
import { logger } from "@/utils/logger.js";
import { dashboardState } from "@/dashboard/DashboardState.js";

export default Schematic.registerFeature({
    name: "autoQuest",
    cooldown: () => ranInt(25 * 60 * 1000, 45 * 60 * 1000),
    condition: async ({ agent: { config } }) => {
        return Boolean(config.autoQuest ?? true);
    },
    run: async ({ agent }) => {
        const questMsg = await agent.awaitResponse({
            trigger: () => agent.send("quest"),
            filter: (m) => m.author.id === agent.owoID && Boolean(
                m.content.toLowerCase().includes("quest") ||
                (m.embeds.length > 0 && (
                    m.embeds[0].title?.toLowerCase().includes("quest") ||
                    m.embeds[0].author?.name?.toLowerCase().includes("quest") ||
                    m.embeds[0].description?.toLowerCase().includes("quest")
                ))
            ),
            time: 15_000,
            expectResponse: false
        });

        if (!questMsg) {
            return ranInt(20 * 60 * 1000, 30 * 60 * 1000);
        }

        const embed = questMsg.embeds[0];
        const rawText = (
            questMsg.content + " " +
            (embed?.title || "") + " " +
            (embed?.description || "") + " " +
            (embed?.fields?.map(f => f.name + " " + f.value).join(" ") || "")
        ).replace(/[*`_]/g, "");

        // 1. Check if all daily quests are finished
        if (
            rawText.toLowerCase().includes("finished all your quests") ||
            rawText.toLowerCase().includes("come back tomorrow") ||
            rawText.toLowerCase().includes("no more quests")
        ) {
            agent.activeQuests = ["All quests completed! 🎉"];
            logger.info(`📜 [Auto-Quest] All daily quests finished for ${agent.client.user?.username}! (Checking again in 1 hour)`);
            dashboardState.broadcastStatus();
            return ranInt(60 * 60 * 1000, 90 * 60 * 1000);
        }

        // 2. Parse Quest List Lines
        const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
        const parsedQuests: string[] = [];

        for (const line of lines) {
            if (/(\[[\sx]\]|\d+\.\s*\[|\(\d+\/\d+\))/i.test(line)) {
                parsedQuests.push(line);
            }
        }

        if (parsedQuests.length > 0) {
            agent.activeQuests = parsedQuests;
            logger.info(`📜 [Auto-Quest] Active quests for ${agent.client.user?.username}:\n  - ${parsedQuests.join("\n  - ")}`);
            dashboardState.broadcastStatus();
        }

        // 3. Auto-solve actionable micro-quests with 100% stop-loss safety (1 cowoncy bets)
        for (const questLine of (parsedQuests.length > 0 ? parsedQuests : [rawText])) {
            const lower = questLine.toLowerCase();

            // A. Coinflip / Gamble Quest (e.g., "Gamble 5 times (2/5)" or "Flip a coin 3 times")
            if (lower.includes("gamble") || lower.includes("coinflip") || lower.includes("flip a coin")) {
                const match = questLine.match(/\((\d+)\/(\d+)\)/);
                let needed = 3;
                if (match) {
                    const current = parseInt(match[1], 10);
                    const total = parseInt(match[2], 10);
                    needed = Math.max(0, total - current);
                }

                if (needed > 0) {
                    const toExecute = Math.min(needed, 5);
                    logger.info(`🎲 [Quest Solver] Auto-completing gamble quest for ${agent.client.user?.username} (${toExecute} micro-bets of 1 cowoncy)...`);
                    for (let i = 0; i < toExecute; i++) {
                        await agent.client.sleep(ranInt(3500, 6000));
                        await agent.send("cf 1");
                    }
                    await agent.client.sleep(ranInt(2000, 4000));
                }
            }

            // B. Slots Quest (e.g., "Play slots 5 times (1/5)")
            if (lower.includes("slot")) {
                const match = questLine.match(/\((\d+)\/(\d+)\)/);
                let needed = 3;
                if (match) {
                    const current = parseInt(match[1], 10);
                    const total = parseInt(match[2], 10);
                    needed = Math.max(0, total - current);
                }

                if (needed > 0) {
                    const toExecute = Math.min(needed, 5);
                    logger.info(`🎰 [Quest Solver] Auto-completing slots quest for ${agent.client.user?.username} (${toExecute} micro-bets of 1 cowoncy)...`);
                    for (let i = 0; i < toExecute; i++) {
                        await agent.client.sleep(ranInt(3500, 6000));
                        await agent.send("s 1");
                    }
                    await agent.client.sleep(ranInt(2000, 4000));
                }
            }

            // C. Cookie a friend quest
            if ((lower.includes("cookie") && lower.includes("friend")) || lower.includes("send a cookie")) {
                if (agent.config.adminID) {
                    logger.info(`🍪 [Quest Solver] Sending cookie to admin to fulfill cookie quest for ${agent.client.user?.username}...`);
                    await agent.client.sleep(ranInt(2000, 4500));
                    await agent.send(`cookie <@${agent.config.adminID}>`);
                }
            }
        }

        return ranInt(25 * 60 * 1000, 40 * 60 * 1000);
    }
});
