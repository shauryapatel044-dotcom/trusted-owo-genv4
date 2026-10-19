import { Schematic } from "../structure/Schematic.js";
import { ranInt } from "../utils/math.js";
export default Schematic.registerFeature({
    name: "changeChannel",
    cooldown: () => 5 * 60 * 1000,
    condition: async ({ agent }) => {
        if (!Array.isArray(agent.config.channelID) || agent.config.channelID.length <= 1)
            return false;
        return agent.totalCommands >= agent.channelChangeThreshold;
    },
    run: async ({ agent }) => {
        agent.channelChangeThreshold += ranInt(17, 56);
        await agent.setActiveChannel();
    }
});
