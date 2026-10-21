import { Schematic } from "@/structure/Schematic.js";
import { ranInt } from "@/utils/math.js";
import { logger } from "@/utils/logger.js";

export default Schematic.registerFeature({
    name: "autoBattle",
    cooldown: () => ranInt(15_000, 22_000),
    condition: ({ agent }) => Boolean(agent.config.autoBattle),
    run: async ({ agent }) => {
        try {
            await agent.awaitResponse({
                trigger: () => agent.send("battle"),
                filter: (m) => m.author.id === agent.owoID && m.embeds.length > 0
                    && Boolean(m.embeds[0].author?.name.includes(m.guild?.members.me?.displayName!)),
                expectResponse: true,
            });
        } catch (err) {
            logger.debug(`[autoBattle] Execution error: ${err}`);
        }
    },
});
