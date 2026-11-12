const blocks=['grass_block','diamond_block','crafting_table','oak_log','stone_bricks','glass','oak_stairs','furnace'] as const;
const items=['diamond_sword','golden_apple','ender_pearl','bow','iron_pickaxe','redstone','cake','torch'] as const;

// Keep the original transparent Block Render PNGs on this origin so the canvas
// stays exportable and stickers remain available without a third-party request.
export const minecraftStickers=[
 ...blocks.map(id=>({id,kind:'block' as const})),
 ...items.map(id=>({id,kind:'item' as const})),
].map(({id,kind})=>({
 id:`minecraft-${id}`,
 name:id.split('_').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '),
 src:`/assets/stickers/minecraft/${id}.png`,
 category:'Minecraft' as const,
 sourceUrl:`https://blockrender.dev/render/${kind}/${id}.png?size=512`,
}));
