import type { Line } from './quests';

/** Intro storybook panels (each: background key, text). {hero} = player name. */
export const INTRO_PANELS: { bg: string; text: string }[] = [
  { bg: 'bg_title', text: 'Hace mucho, en el risueño Reino de Rosaleda, se celebraba cada año el Festival de las Dos Lunas: la noche en que los enamorados se declaran su amor... y los solteros se declaran su hambre.' },
  { bg: 'bg_charselect', text: 'Este año, {hero} tenía por fin una cita con Lady Amaranta, la dama más encantadora del reino. Llevaba semanas ensayando una carta de amor de tres páginas, un ramo de rosas rojas y una sonrisa que casi no daba miedo.' },
  { bg: 'bg_title', text: 'Pero en lo alto de la Torre de Malvarrón vivía el vanidoso mago Lord Malvarrón, que estaba convencido de ser "la mejor opción" para Amaranta (ella no opinaba lo mismo, pero a él le daba igual).' },
  { bg: 'bg_charselect', text: 'Así que Malvarrón hizo lo que hacen todos los magos celosos: convirtió la carta en goblins, maldijo el ramo, selló el camino a su torre y se puso a peinar su bigote, muy satisfecho.' },
  { bg: 'bg_title', text: 'La cita es al caer la noche. Quedan unas pocas aventuras, algunos monstruos y un ogro con inquietudes literarias. ¡Corazones y calabozos te esperan, {hero}!' },
];

export const INTRO_UI = { skip: 'Clic para continuar  -  Esc para saltar', next: 'Siguiente', start: '¡A la aventura!' };

/** The final date. who: 'amaranta' | 'hero' | 'malvarron' | 'elder' | 'bard'. */
export const ENDING_LINES: Line[] = [
  { who: 'amaranta', text: '¡{hero}! Has llegado... un poco chamuscado, pero llegas. Me gusta la puntualidad con tizne.' },
  { who: 'hero', text: 'Lady Amaranta, esto es para ti. El ramo está algo mordisqueado y la carta tiene baba de goblin, pero el sentimiento es auténtico.' },
  { who: 'amaranta', text: 'Mmm... "Tus ojos son como dos... lunas". Es la carta más cursi que he leído jamás.' },
  { who: 'hero', text: '¿Ha sido demasiado?' },
  { who: 'amaranta', text: 'Ha sido perfecto. Y lo de la baba le da un toque de autenticidad.' },
  { who: 'amaranta', text: 'Dime, ¿de verdad has atravesado un bosque, una cueva, unas ruinas volcánicas y una torre solo para una cita?' },
  { who: 'hero', text: 'También ha habido un poeta, una reina de rosas y una gárgola con problemas de celos. Pero sí. Valía la pena.' },
  { who: 'amaranta', text: 'Entonces, mi héroe, no pienso dejar que esta noche se estropee. ¡Que empiece el festival!' },
];

export const ENDING_UI = { title: 'Fin', subtitle: 'Y vivieron felices, comieron perdices y nunca más volvieron a hablar de Malvarrón (bueno, un poco).', next: 'Continuar' };

export interface CreditSection { title: string; lines: string[]; }

/** Credits. The audio / VFX part summarises CREDITS.md. */
export const CREDITS: CreditSection[] = [
  { title: 'Corazones y Calabozos', lines: ['Una comedia romántica de oscura fantasía'] },
  { title: 'Un juego de', lines: ['El equipo de AFewDevs'] },
  { title: 'Diseño y programación', lines: ['Motor, mundos procedurales, combate, habilidades', 'Interfaz, objetos y botín', 'Misiones, diálogos e historia'] },
  { title: 'Música (CC0)', lines: [
    'A Legend Will Rise - CodeManu', 'Quaint Town - neonarkade', 'Treasure Hunter - TAD', 'Dark Cavern Ambient - Paul Wortmann',
    'Entering the Volcano / The Abyss - Umplix', 'Determined Pursuit - Emma_MA', 'The Hope - TAD',
  ] },
  { title: 'Efectos de sonido (CC0)', lines: [
    'Kenney Vleugels: Interface Sounds, 50 RPG Sound Effects', 'StarNinjas: 20 Sword Sound Effects', 'rubberduck: 100 CC0 SFX',
    'JaggedStone: Magic Spell SFX', 'haeldb: Spell Sounds', 'Jan Schupke: Fantasy Sound Effects', 'trazzz123: CC0 Deep Monster Roar',
  ] },
  { title: 'Efectos visuales (CC0)', lines: ['Kenney Vleugels: Particle Pack', 'Corazón procedural: generado para este proyecto'] },
  { title: 'Gracias por jugar', lines: ['A Lady Amaranta, por esperar.', 'A Pipo, por rimar "corazón" con "camión".', 'Y a Lord Malvarrón, por ser tan mal perdedor.'] },
];