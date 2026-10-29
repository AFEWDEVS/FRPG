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
    chatter: [
      'En mi juventud le declaré mi amor a una dama en un campo de coles. Me contestó un nabo.',
      '¿Alguien ha visto mi bastón? Ah, lo llevo en la mano. Qué cosas.',
      'Malvarrón y su bigote... en mis tiempos, a un bigote se le pedía respeto y brillantina.',
      'Las rosas ya no huelen como antes. Ahora muerden. Y encima opinan.',
      'Eso me recuerda a Dorotea, la del molino... ¿de qué hablaba? Ah, sí, de nada.',
      'Cuando yo era joven, los goblins pedían permiso antes de robar.',
    ],
  },
  merchant: {
    id: 'merchant', name: 'Gertrudis', title: 'Mercader', textureKey: 'npc_merchant', portraitKey: 'portrait_merchant',
    lines: ['Pociones, espadas y consejos amorosos. Los consejos son gratis, las pociones no.'],
    chatter: [
      '¡Pociones de amor! Efectos secundarios: casarse.',
      'Oferta de hoy: espadas con 0% de descuento y garantía de un día.',
      '¿Un escudo? ¿Un segundo escudo? ¿Un tercero por si acaso el segundo se enamora?',
      'Esa armadura le queda genial. A ti, no, pero a mi caja registradora, perfecta.',
      'Cliente satisfecho, cliente que vuelve. Cliente muerto, cliente que no paga. Cuídate, ¿eh?',
      'Mi abuela decía: "Nunca te fíes de un mago con bigote". Vendía muy mal pero acertaba mucho.',
    ],
  },
  healer: {
    id: 'healer', name: 'Hermana Melisa', title: 'Sanadora', textureKey: 'npc_healer', portraitKey: 'portrait_healer',
    lines: ['Curo heridas del cuerpo. Las del corazón... eso ya es otro precio.'],
    chatter: [
      'Todos los héroes llegan igual: sangrando y con prisa. Qué sorpresa tan nueva.',
      'Respira hondo. Y luego deja de sangrar sobre mi alfombra, por favor.',
      'Para el mal de amores recomiendo té de manzanilla. Y huir.',
      'No te preocupes, yo lo curo todo. Aunque nadie me lo agradezca. No, no pasa nada.',
      'Qué bien que hayas vuelto con vida. Aunque con esa cara, uno lo dudaba.',
      'Los goblins muerden. Los poetas aburren. Ambos duelen, y a mí me toca limpiar.',
    ],
  },
  bard: {
    id: 'bard', name: 'Pipo', title: 'Bardo cómico', textureKey: 'npc_bard', portraitKey: 'portrait_bard',
    lines: ['Oh, el héroe que llegó tarde a su cita...', 'Rosas? Chocolates? Yo que tú llevaría un escudo.'],
    chatter: [
      '¡Rima del día: corazón, camión, bastión, pantalón!',
      'Ay, amor, amor, qué caro me cuesta el calor... el color... el cantor.',
      'Una vez le canté a un dragón. Todavía me debe el aplauso. Y el brazo izquierdo.',
      '¿Y si el amor es solo un goblin muy grande? Hmm, apuntado, apuntado.',
      'Si ella dice "no", tú contestas "yo". Si ella dice "adiós", tú rimas "vos". ¡Genial!',
      '♪ Con una fresa y un tulipán, conquisté a una cabra que hoy es mi capitán ♪',
    ],
  },
};

export const NPC_COLORS: Record<string, string> = {
  hero: '#7fd0ff', elder: '#d8b060', bard: '#78d8a0', merchant: '#f0b04a', healer: '#e6a0d0', amaranta: '#ff8fb0', malvarron: '#b080ff',
  thorn: '#6fd070', ogre: '#c09060', gargoyle: '#a0a8b8',
};

/** Merchant / healer greetings shown before the shop / heal buttons. */
export const GREETINGS: Record<string, string[]> = {
  merchant: [
    '¡Pasa, pasa! Pociones para el corazón y la espada. Para el corazón no tengo, pero ánimo. ¿Te las envuelvo con {gold}descuento{/gold}? (No hay descuento.)',
    'Mira qué sonrisa. Con una sonrisa así, necesitas un {wave}escudo{/wave}. Y con un escudo, necesitas un segundo escudo. Es ciencia.',
    '¡El mejor cliente del reino! Es lo que digo a todos, pero a ti con más cariño y mejor iluminación.',
    'Bienvenido a "Gertrudis & Gertrudis". La otra Gertrudis soy yo en domingo.',
  ],
  healer: [
    'Tienes cara de haber peleado con un oso... o con una suegra. No sé cuál sería peor. Siéntate, anda.',
    'Ah, {hero}. Otra vez herido. No, no, no pasa nada, yo estoy aquí, sanando a todo el mundo, sola. Como siempre.',
    'Que la luz de las dos lunas cierre esas heridas. Y si no cierra, para eso tengo vendas. Y reproches.',
    'Te curo, pero con una condición: la próxima vez cae sobre algo blando. Como un goblin. Mejor un goblin.',
  ],
};

export const MERCHANT_UPSELL: string[] = [
  'Gertrudis: "¿Una poción? ¿Un escudo? ¿Una poción con forma de escudo? ¡Todo lo vendemos!"',
  'Gertrudis: "Esa espada sirve, pero con la {gold}Edición Platino{/gold} cortas el doble. Y cuesta el triple."',
  'Gertrudis: "¿Seguro que no quieres un seguro de amor? Cubre decepciones, plantones y suegras."',
  'Gertrudis: "Llévate una bolsa. Gratis. Bueno, la bolsa cuesta 3 de oro. Pero el aire de dentro es de regalo."',
];

export const HEAL_QUIPS: string[] = [
  'Hermana Melisa te sana por completo. "Listo. No, de nada. No hacía falta que me lo agradecieras."',
  'Hermana Melisa te sana por completo. "Ya está. Te dolerá menos que mi decepción."',
  'Hermana Melisa te sana por completo. "Qué bien que hayas venido, ahora que ya no tengo ningún otro plan."',
  'Hermana Melisa te sana por completo. "Otra vez en una pieza. Casi me da pena."',
];

/** Idle chatter, with progress callbacks mixed in. */
export function chatterFor(npcId: string, flags: Record<string, unknown>, completed: number): string[] {
  const base = [...(NPCS[npcId]?.chatter ?? [])];
  if (completed >= 1) {
    if (npcId === 'elder') base.push('Tienes ya la carta, ¿no? Ahora a por el ramo, que sin ramo uno parece un panadero.');
    if (npcId === 'bard') base.push('He oído que la baba de goblin da cuerpo a la tinta. ¡Cuerpo y aroma!');
  }
  if (completed >= 3) {
    if (npcId === 'healer') base.push('Cenizar, ¿eh? Allí hace calor. Y yo aquí sin quemaduras que curar. No me quejo, ¿eh?');
    if (npcId === 'merchant') base.push('Un amuleto anticeloso... tengo seis. Bueno, tenía. Ya los vendí. Eran tuyos, ¿no?');
  }
  if (flags['pipoLikes'] && Number(flags['pipoLikes']) >= 2 && npcId === 'bard') base.push('¡Me has aplaudido dos veces! Eres oficialmente mi fan número uno. El número dos es mi madre.');
  if (flags['gameCompleted']) {
    if (npcId === 'elder') base.push('¿Qué tal la cita? ¿Hubo nabo? No hubo nabo. Qué decepción.');
    if (npcId === 'merchant') base.push('Me han dicho que arrasaste. ¿Quieres comprarte algo para celebrarlo? ¿Y algo para el próximo?');
  }
  return base;
}