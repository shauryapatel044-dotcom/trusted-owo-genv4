import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";
import { ranInt } from "@/utils/math.js";
import { dashboardState } from "@/dashboard/DashboardState.js";

export default Schematic.registerFeature({
    name: "autoCash",
    cooldown: () => ranInt(5 * 60 * 1000, 10 * 60 * 1000),
    condition: async ({ agent: { config } }) => {
        return Boolean(config.autoCash ?? true);
    },
    run: async ({ agent }) => {
        try {
            const cashMsg = await agent.awaitResponse({
                trigger: () => agent.send("cash"),
                filter: (m) => m.author.id === agent.owoID
                    && (
                        m.content.includes(agent.client.user?.id!)
                        || (agent.client.user?.username && m.content.toLowerCase().includes(agent.client.user.username.toLowerCase()))
                        || (agent.client.user?.displayName && m.content.toLowerCase().includes(agent.client.user.displayName.toLowerCase()))
                        || (m.guild?.members.me?.displayName && m.content.toLowerCase().includes(m.guild.members.me.displayName.toLowerCase()))
                        || /cowoncy|currently have/i.test(m.content)
                        || m.embeds.some(e => /cowoncy|balance/i.test(e.description || "") || /cowoncy|balance/i.test(e.title || ""))
                    ),
                time: 15_000,
                expectResponse: false
            });

            if (cashMsg) {
                const embedContent = (cashMsg.embeds || []).map(e => `${e.title || ""} ${e.description || ""} ${e.fields?.map(f => `${f.name} ${f.value}`).join(" ") || ""}`).join(" ");
                const cleanContent = (cashMsg.content + " " + embedContent)
                    .replace(/<a?:cowoncy:\d+>/gi, " cowoncy ")
                    .replace(/[*_`]/g, "")
                    .replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, " ");

                // 1. "1,234,567 cowoncy" or "you currently have 1,234,567 cowoncy"
                const m1 = cleanContent.match(/([0-9,]+)\s*cowoncy/i);
                // 2. "balance: 1,234,567" or "cowoncy: 1,234,567"
                const m2 = cleanContent.match(/(?:balance|cowoncy)\s*:?\s*([0-9,]+)/i);
                // 3. "you currently have 1,234,567"
                const m3 = cleanContent.match(/(?:you\s+(?:currently\s+|now\s+)?have)\s*([0-9,]+)/i);

                const match = m1 || m2 || m3;

                if (match) {
                    const amount = parseInt(match[1].replace(/,/g, ""), 10);
                    if (!isNaN(amount) && amount >= 0) {
                        agent.cowoncy = amount;
                        logger.info(`💰 [OwO Cash] ${agent.client.user?.username} verified balance: ${amount.toLocaleString()} Cowoncy`);
                        dashboardState.broadcastStatus();
                    }
                }
            }

            return ranInt(5 * 60 * 1000, 10 * 60 * 1000);
        } catch (err) {
            logger.debug(`[autoCash] Skipped: ${err}`);
            return ranInt(5 * 60 * 1000, 10 * 60 * 1000);
        }
    }
});
