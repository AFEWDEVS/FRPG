/** All user-facing text (Spanish). Keep text here / in data files for i18n. */
export const S = {
  gameTitle: 'Corazones y Calabozos',
  tagline: 'Una comedia romántica de oscura fantasía',
  menu: { new: 'Nueva partida', continue: 'Continuar', options: 'Opciones', back: 'Volver', music: 'Música', sfx: 'Efectos' },
  create: {
    title: 'Crea a tu héroe', namePlaceholder: 'Nombre del héroe', defaultName: 'Valeriano',
    start: 'Comenzar la aventura', chooseClass: 'Elige tu clase',
  },
  loading: 'Cargando...',
  hud: { life: 'Vida', mana: 'Maná', level: 'Nivel' },
  interact: {
    portalLocked: 'El portal al Mundo 2 está sellado por un hechizo de celos... Solo se abrirá cuando el Ogro Poeta de las Cuevas del Suspiro deje de rimar.',
    waypoint: 'Los vientos del amor te llevan a casa...',
    noEntry: 'No puedes pasar por ahí.',
  },
  stats: { str: 'Fuerza', dex: 'Destreza', vit: 'Vitalidad', ene: 'Energía' },
  rarity: { normal: 'Normal', magic: 'Mágico', rare: 'Raro', unique: 'Único' },
  affix: { fast: 'Rápido', fiery: 'Ardiente', lovesick: 'Enamoradizo', frozen: 'Gélido', tough: 'Robusto' },
  panels: { inventory: 'Inventario', character: 'Personaje', skills: 'Habilidades', quests: 'Misiones', map: 'Mapa' },
} as const;
