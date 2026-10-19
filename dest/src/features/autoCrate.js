import { Schematic } from "../structure/Schematic.js";
import { ranInt } from "../utils/math.js";
import { logger } from "../utils/logger.js";
export default Schematic.registerFeature({
    name: "autoCrate",
    cooldown: () => ranInt(15 * 60 * 1000, 30 * 60 * 1000),
    condition: async ({ agent: { config } }) => {
        return Boolean(config.autoCrate ?? true) || Boolean(config.autoLootbox ?? true);
    },
    run: async ({ agent }) => {
        // 1. Open Weapon Crates (owo crate all)
        if (agent.config.autoCrate !== false) {
            await agent.send("crate all");
            await agent.client.sleep(ranInt(3500, 6500));
        }
        // 2. Open Standard Lootboxes (owo lb all)
        if (agent.config.autoLootbox !== false) {
            await agent.send("lb all");
            await agent.client.sleep(ranInt(3500, 6500));
        }
        // 3. Open Fabled Lootboxes (if enabled)
        if (agent.config.autoFabledLootbox) {
            await agent.send("lb fabled");
            await agent.client.sleep(ranInt(3500, 6000));
        }
        logger.info(`📦 [Loot] Auto-opened crates & lootboxes for ${agent.client.user?.username}`);
        return ranInt(15 * 60 * 1000, 30 * 60 * 1000);
    }
});
