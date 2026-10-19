import { Message } from "discord.js-selfbot-v13";

import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";

import { FeatureFnParams } from "@/typings/index.js";
import { ranInt } from "@/utils/math.js";

const GEM_REGEX = {
    gem1: /^05[1-7]$/,
    gem2: /^(06[5-9]|07[0-1])$/,
    gem3: /^07[2-8]$/,
    star: /^(079|08[0-5])$/,
};

const GEM_TIERS = {
    common: [51, 65, 72, 79],
    uncommon: [52, 66, 73, 80],
    rare: [53, 67, 74, 81],
    epic: [54, 68, 75, 82],
    mythical: [55, 69, 76, 83],
    legendary: [56, 70, 77, 84],
    fabled: [57, 71, 78, 85],
}

const useGems = async (params: FeatureFnParams, huntMsg: Message) => {
    const { agent, t } = params;

    const invMsg = await agent.awaitResponse({
        trigger: () => agent.send("inv"),
        filter: (m) => m.author.id === agent.owoID
            && Boolean(
                m.content.toLowerCase().includes("inventory")
                || (m.embeds.length > 0 && (
                    m.embeds[0].author?.name?.toLowerCase().includes("inventory")
                    || m.embeds[0].description?.toLowerCase().includes("inventory")
                ))
            ),
        expectResponse: true,
    });

    if (!invMsg) return;

    const rawText = invMsg.content + " " + (invMsg.embeds[0]?.description || "");
    const inventory = rawText.split("`");

    if (agent.config.autoCrate !== false && (inventory.includes("100") || rawText.toLowerCase().includes("crate"))) {
        await agent.send("crate all");
        await agent.client.sleep(ranInt(3000, 6000));
    }

    if (agent.config.autoFabledLootbox && inventory.includes("049")) {
        await agent.send("lb fabled");
    }

    if (agent.config.autoLootbox && inventory.includes("050")) {
        await agent.send("lb all");

        logger.debug("Lootboxes opened, re-running useGems logic to check inventory again.");
        (agent as any).emptyGemCooldown = 0;
        await agent.client.sleep(ranInt(5000, 10000));
        await useGems(params, huntMsg);
        return;
    }

    const tiers = (agent.config.gemTier && agent.config.gemTier.length > 0
        ? agent.config.gemTier
        : ["common", "uncommon", "rare", "epic", "mythical", "legendary", "fabled"]) as (keyof typeof GEM_TIERS)[];
    const usableGemsSet = new Set(tiers.map((tier) => GEM_TIERS[tier]).flat());

    const filterAndMapGems = (regex: RegExp) => {
        return inventory.reduce((acc: number[], item) => {
            const numItem = Number(item);
            if (regex.test(item) && usableGemsSet.has(numItem)) {
                acc.push(numItem);
            }
            return acc;
        }, []);
    };

    agent.gem1Cache = filterAndMapGems(GEM_REGEX.gem1);
    agent.gem2Cache = filterAndMapGems(GEM_REGEX.gem2);
    agent.gem3Cache = filterAndMapGems(GEM_REGEX.gem3);
    agent.starCache = agent.config.useSpecialGem ? filterAndMapGems(GEM_REGEX.star) : [];

    const totalGems = agent.gem1Cache.length + agent.gem2Cache.length + agent.gem3Cache.length + agent.starCache.length;
    if (totalGems === 0) {
        logger.info(t("features.autoHunt.noGems") + " (will re-check inventory in 5 mins)");
        (agent as any).emptyGemCooldown = Date.now() + 5 * 60 * 1000;
        return;
    }

    (agent as any).emptyGemCooldown = 0;
    logger.info(t("features.autoHunt.gemsFound", { count: totalGems }));

    const gemsToUse: number[] = [];

    // 1. Hunting Gems (Diamond Shape: IDs 51-57)
    if (!huntMsg.content.includes("gem1") && agent.gem1Cache.length > 0) {
        const bestHunting = Math.max(...agent.gem1Cache);
        gemsToUse.push(bestHunting);
    }
    // 2. Empowering Gems (Round Shape: IDs 65-71)
    if (!huntMsg.content.includes("gem3") && agent.gem2Cache.length > 0) {
        const bestEmpowering = Math.max(...agent.gem2Cache);
        gemsToUse.push(bestEmpowering);
    }
    // 3. Lucky Gems (Heart Shape: IDs 72-78)
    if (!huntMsg.content.includes("gem4") && agent.gem3Cache.length > 0) {
        const bestLucky = Math.max(...agent.gem3Cache);
        gemsToUse.push(bestLucky);
    }
    // 4. Special Gems (Star Shape: IDs 79-85)
    if (agent.config.useSpecialGem && !huntMsg.content.includes("star") && agent.starCache.length > 0) {
        const bestStar = Math.max(...agent.starCache);
        gemsToUse.push(bestStar);
    }

    if (gemsToUse.length === 0) {
        return;
    }

    logger.info(`[Auto-Gem] Equipping Best Gems: ${gemsToUse.map(g => '#' + g).join(", ")}`);
    await agent.send(`use ${gemsToUse.join(" ")}`);
}

export default Schematic.registerFeature({
    name: "autoHunt",
    cooldown: () => ranInt(15_000, 22_000),
    condition: async () => true,
    run: async ({ agent, t, locale }) => {
        const huntMsg = await agent.awaitResponse({
            trigger: () => agent.send("hunt"),
            filter: (m) => m.author.id === agent.owoID
                && m.content.includes(m.guild?.members.me?.displayName!)
                && /hunt is empowered by|spent 5 .+ and caught a/.test(m.content),
            expectResponse: true,
        });

        if (!huntMsg || !agent.config.autoGem) return;

        const cooldown = (agent as any).emptyGemCooldown || 0;
        if (Date.now() < cooldown) return;

        const gem1Needed = !huntMsg.content.includes("gem1");
        const gem2Needed = !huntMsg.content.includes("gem3");
        const gem3Needed = !huntMsg.content.includes("gem4");
        const starNeeded = Boolean(agent.config.useSpecialGem && !huntMsg.content.includes("star"));

        if (gem1Needed || gem2Needed || gem3Needed || starNeeded) {
            await useGems({ agent, t, locale }, huntMsg);
        }
    }
})