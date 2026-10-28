export interface NpcDef {
  id: string;
  name: string;
  title: string;
  textureKey: string;
  portraitKey: string;
  /** Fallback lines (used by Npc.nextLine). */
  lines: string[];
  /** Random comic remarks shown in a bubble above the NPC when the player is near. */
  chatter: string[];
}

export const NPCS: Record<string, NpcDef> = {
  elder: {
    id: 'elder', name: 'Abuelo Tobías', title: 'Anciano del pueblo', textureKey: 'npc_elder', portraitKey: 'portrait_elder',
    lines: ['Joven, el Festival de las Dos Lunas se acerca y Lord Malvarrón ya está tramando algo.', 'Tu carta de amor... se ha convertido en monstruos. Qué tiempos.'],
    chatter: ['En mi época los festivales no tenían tantas luces. Teníamos velas y peligro.', '¿Alguien ha visto mi bastón? Ah, lo llevo en la mano.', 'Ese Malvarrón... qué mala educación con el bigote.', 'Las rosas ya no huelen como antes. Ahora muerden.'],
  },
  merchant: {
    id: 'merchant', name: 'Gertrudis', title: 'Mercader', textureKey: 'npc_merchant', portraitKey: 'portrait_merchant',
    lines: ['Pociones, espadas y consejos amorosos. Los consejos son gratis, las pociones no.'],
    chatter: ['¡Pociones de amor! Efectos secundarios: casarse.', 'Rebajas: espadas con un 0% de descuento.', 'Mi abuela decía: "Nunca te fíes de un mago con bigote". Y tenía razón.', 'Cliente satisfecho, cliente que vuelve. Cliente muerto, cliente que no paga.'],
  },
  healer: {
    id: 'healer', name: 'Hermana Melisa', title: 'Sanadora', textureKey: 'npc_healer', portraitKey: 'portrait_healer',
    lines: ['Curo heridas del cuerpo. Las del corazón... eso ya es otro precio.'],
    chatter: ['Todos los héroes llegan igual: sangrando y con prisa.', 'Respira hondo. Y luego deja de sangrar, por favor.', 'Para el mal de amores recomiendo té de manzanilla. Y huir.', 'Los goblins muerden. Los poetas, aburren. Ambos duelen.'],
  },
  bard: {
    id: 'bard', name: 'Pipo', title: 'Bardo cómico', textureKey: 'npc_bard', portraitKey: 'portrait_bard',
    lines: ['Oh, el héroe que llegó tarde a su cita...', 'Rosas? Chocolates? Yo que tú llevaría un escudo.'],
    chatter: ['Ay, amor, amor... qué cosas tan caras me haces escribir.', 'Una vez le canté a un dragón. Todavía me debe el aplauso.', '¡Rima del día: corazón, camión, bastión, pantalón!', '¿Y si el amor es solo un goblin muy grande?'],
  },
};