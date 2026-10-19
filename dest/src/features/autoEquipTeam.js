import { Schematic } from "../structure/Schematic.js";
import { ranInt } from "../utils/math.js";
import { logger } from "../utils/logger.js";
export default Schematic.registerFeature({
    name: "autoEquipTeam",
    cooldown: () => ranInt(30 * 60 * 1000, 60 * 60 * 1000),
    condition: async ({ agent: { config } }) => {
        return Boolean(config.autoEquip ?? true);
    },
    run: async ({ agent }) => {
        // 1. Optimize Battle Squad (assign strongest CP animals)
        await agent.send("team auto");
        await agent.client.sleep(ranInt(3500, 6000));
        // 2. Inspect Weapons Inventory
        const wepMsg = await agent.awaitResponse({
            trigger: () => agent.send("weapon"),
            filter: (m) => m.author.id === agent.owoID && Boolean(m.content.toLowerCase().includes("weapon") ||
                (m.embeds.length > 0 && (m.embeds[0].title?.toLowerCase().includes("weapon") ||
                    m.embeds[0].author?.name?.toLowerCase().includes("weapon") ||
                    m.embeds[0].description?.toLowerCase().includes("weapon")))),
            time: 15_000,
            expectResponse: false
        });
        if (wepMsg) {
            const rawText = (wepMsg.content + " " +
                (wepMsg.embeds[0]?.title || "") + " " +
                (wepMsg.embeds[0]?.description || "") + " " +
                (wepMsg.embeds[0]?.fields?.map(f => f.name + " " + f.value).join(" ") || ""));
            // Extract weapon ID patterns like `12345` or [12345] or ID: 12345
            const wepMatches = Array.from(rawText.matchAll(/(?:`|\[|\bID:\s*)(\d{3,8})(?:`|\]|\b)/gi)).map(m => m[1]);
            if (wepMatches.length > 0) {
                const bestWepId = wepMatches[0];
                await agent.client.sleep(ranInt(3000, 5000));
                await agent.send(`equip ${bestWepId}`);
                logger.info(`⚔️ [Battle Prep] Equipped highest weapon #${bestWepId} and optimized team for ${agent.client.user?.username}!`);
                return ranInt(30 * 60 * 1000, 60 * 60 * 1000);
            }
        }
        // Fallback: try general equip
        await agent.client.sleep(ranInt(2000, 4000));
        await agent.send("equip");
        logger.info(`⚔️ [Battle Prep] Refreshed equipped weapons and battle squad for ${agent.client.user?.username}`);
        return ranInt(30 * 60 * 1000, 60 * 60 * 1000);
    }
});
