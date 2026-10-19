import { Schematic } from "../structure/Schematic.js";
import { logger } from "../utils/logger.js";
import { ranInt } from "../utils/math.js";
import { dashboardState } from "../dashboard/DashboardState.js";
export default Schematic.registerFeature({
    name: "autoCash",
    cooldown: () => ranInt(20 * 60 * 1000, 35 * 60 * 1000),
    condition: async ({ agent: { config } }) => {
        return Boolean(config.autoCash ?? true);
    },
    run: async ({ agent }) => {
        const cashMsg = await agent.awaitResponse({
            trigger: () => agent.send("cash"),
            filter: (m) => m.author.id === agent.owoID
                && (m.content.includes(agent.client.user?.username)
                    || m.content.includes(m.guild?.members.me?.displayName)
                    || /cowoncy|currently have/i.test(m.content)),
            time: 15_000,
            expectResponse: false
        });
        if (cashMsg) {
            const rawContent = cashMsg.content + " " + (cashMsg.embeds[0]?.description || "");
            const match = rawContent.match(/(?:you\s+(?:currently\s+)?have|balance:?|you\s+now\s+have)\s*([0-9,]+)\s*(?:cowoncy|<:cowoncy:\d+>)?/i);
            if (match) {
                const amount = parseInt(match[1].replace(/,/g, ""), 10);
                if (!isNaN(amount)) {
                    agent.cowoncy = amount;
                    logger.info(`💰 [Cowoncy Audit] ${agent.client.user?.username} currently holds ${amount.toLocaleString()} cowoncy!`);
                    dashboardState.broadcastStatus();
                }
            }
        }
        return ranInt(20 * 60 * 1000, 35 * 60 * 1000);
    }
});
