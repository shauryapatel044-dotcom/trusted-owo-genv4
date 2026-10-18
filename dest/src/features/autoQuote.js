import { Schematic } from "../structure/Schematic.js";
import { ranInt } from "../utils/math.js";
import { quotes } from "../utils/quotes.js";
export default Schematic.registerFeature({
    name: "autoQuote",
    cooldown: () => 15_000,
    condition: async ({ agent }) => {
        return Array.isArray(agent.config.autoQuote) && agent.config.autoQuote.length > 0;
    },
    run: async ({ agent }) => {
        if (!Array.isArray(agent.config.autoQuote) || agent.config.autoQuote.length === 0)
            return;
        const choice = agent.config.autoQuote[ranInt(0, agent.config.autoQuote.length)];
        let quote = "owo";
        if (choice === "quote" && quotes.length > 0) {
            quote = quotes[ranInt(0, quotes.length)];
        }
        agent.send(quote, { prefix: "", channel: agent.activeChannel, skipLogging: true });
    }
});
