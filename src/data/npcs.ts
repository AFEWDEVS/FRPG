export interface NpcDef {
  id: string;
  name: string;
  title: string;
  textureKey: string;
  portraitKey: string;
  lines: string[];
}

export const NPCS: Record<string, NpcDef> = {
  elder: {
    id: 'elder', name: 'Abuelo Tobías', title: 'Anciano del pueblo', textureKey: 'npc_elder', portraitKey: 'portrait_elder',
    lines: ['Joven, el Festival de las Dos Lunas se acerca y Lord Malvarrón ya está tramando algo.', 'Tu carta de amor... se ha convertido en monstruos. Qué tiempos.'],
  },
  merchant: {
    id: 'merchant', name: 'Gertrudis', title: 'Mercader', textureKey: 'npc_merchant', portraitKey: 'portrait_merchant',
    lines: ['Pociones, espadas y consejos amorosos. Los consejos son gratis, las pociones no.'],
  },
  healer: {
    id: 'healer', name: 'Hermana Melisa', title: 'Sanadora', textureKey: 'npc_healer', portraitKey: 'portrait_healer',
    lines: ['Curo heridas del cuerpo. Las del corazón... eso ya es otro precio.'],
  },
  bard: {
    id: 'bard', name: 'Pipo', title: 'Bardo cómico', textureKey: 'npc_bard', portraitKey: 'portrait_bard',
    lines: ['Oh, el héroe que llegó tarde a su cita...', 'Rosas? Chocolates? Yo que tú llevaría un escudo.'],
  },
};
