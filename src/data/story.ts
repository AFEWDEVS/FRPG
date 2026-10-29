import type { Line } from './quests';

/** Intro storybook panels (each: background key, text, Ken Burns camera). {hero} = player name. Tags: {shake}{wave}{gold}{pink}{red}{big}. */
export interface IntroPanel { bg: string; text: string; from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; tint?: number; }
export const INTRO_PANELS: IntroPanel[] = [
  { bg: 'bg_title', from: { x: -40, y: 10, z: 1.06 }, to: { x: 40, y: -10, z: 1.18 }, text: 'Hace mucho, en el risueño Reino de Rosaleda, se celebraba cada año el {gold}Festival de las Dos Lunas{/gold}: la noche en que los enamorados se declaran su amor... y los solteros, su hambre.' },
  { bg: 'bg_charselect', from: { x: 30, y: 20, z: 1.2 }, to: { x: -30, y: -10, z: 1.05 }, text: 'Este año, {hero} tenía por fin una cita con {pink}Lady Amaranta{/pink}, la dama más encantadora del reino. Llevaba semanas ensayando una carta de amor de tres páginas, un ramo de rosas rojas y una sonrisa que casi no daba miedo.' },
  { bg: 'bg_title', from: { x: 20, y: -30, z: 1.05 }, to: { x: -20, y: 20, z: 1.2 }, tint: 0xb08cd0, text: 'Pero en lo alto de la Torre de Malvarrón vivía el vanidoso mago {red}Lord Malvarrón{/red}, convencido de ser "la mejor opción" para Amaranta (ella no opinaba lo mismo, pero a él le daba igual). Y, sobre todo, estaba muy orgulloso de su {wave}bigote{/wave}.' },
  { bg: 'bg_charselect', from: { x: -30, y: 0, z: 1.1 }, to: { x: 30, y: 10, z: 1.22 }, tint: 0xd09090, text: 'Así que Malvarrón hizo lo que hacen todos los magos celosos: {shake}convirtió la carta en goblins{/shake}, maldijo el ramo, selló el camino a su torre y se puso a peinar su bigote, muy satisfecho.' },
  { bg: 'bg_title', from: { x: 0, y: 30, z: 1.22 }, to: { x: 0, y: -10, z: 1.04 }, text: 'La cita es al caer la noche. Quedan unas pocas aventuras, algunos monstruos y un ogro con inquietudes literarias. {big}¡Corazones y Calabozos{/big} te esperan, {hero}!' },
];

export const INTRO_UI = { skip: 'Clic o Espacio para continuar  -  Esc para saltar', next: 'Siguiente', start: '¡A la aventura!' };

const am = (text: string, emote?: string): Line => ({ who: 'amaranta', text, emote });
const h = (text: string, emote?: string): Line => ({ who: 'hero', text, emote });

/** The final date. who: 'amaranta' | 'hero' | 'malvarron' | 'elder' | 'bard'. Choices set flag endingChoice. */
export const ENDING_LINES: Line[] = [
  am('¡{hero}! Has llegado... un poco chamuscado, pero llegas. Me gusta la puntualidad con tizne.', 'sparkle'),
  { who: 'amaranta', text: 'Te he visto luchar contra el ogro desde la torre del reloj. Esa rima del final... era tuya, ¿no?', ifFlag: 'ogreVerse' },
  { who: 'amaranta', text: 'Y me han contado que le diste un cumplido a Malvarrón. Qué generoso. Qué... sospechoso.', ifFlag: 'mustachePraise' },
  { who: 'amaranta', text: 'Y me han contado que insultaste su bigote. Ay. Hubiese pagado por verlo.', ifFlag: 'mustacheInsult' },
  { who: 'amaranta', text: 'Dime, ¿de verdad has atravesado un bosque, una cueva, unas ruinas volcánicas y una torre solo para una cita?' },
  h('También ha habido un poeta, una reina de rosas, una gárgola con problemas de celos y un bigote. Pero sí. Valía la pena.'),
  { who: 'hero', text: 'Como caballero, solo puedo decir que... ¡mi espada y mi corazón son tuyos, milady!', cls: 'knight' },
  { who: 'hero', text: 'Según mis cálculos, la probabilidad de que esta cita salga bien es del 87%. Con ramo, 91%.', cls: 'mage' },
  { who: 'hero', text: 'Mi flecha va, mi flecha viene, y mi corazón por ti se mantiene.', cls: 'ranger', emote: 'music' },
  am('Basta de preámbulos. Ya has traído un ramo (algo mordisqueado) y una carta (algo babeada). ¿Qué vas a hacer con ellos?', 'heart'),
  {
    who: 'amaranta', text: 'Estoy esperando, héroe. No tengo toda la noche. Bueno, sí. Pero me gusta el suspense.',
    choices: [
      {
        text: 'Proponerle matrimonio con el ramo.', set: { endingChoice: 'bouquet' },
        reply: [
          h('Lady Amaranta, ¿quieres casarte con este caballero... y con este ramo?'),
          am('¡Sí! ¡Sí! ¡Y sí al ramo! Aunque tiene una espina clavada en la manga. Y creo que una araña.', 'heart'),
          { who: 'elder', text: '¡Ésa es mi lección de cabra y harina! ¡Bien aprendido, muchacho!', emote: 'laugh' },
        ],
      },
      {
        text: 'Leer la carta en voz alta.', set: { endingChoice: 'letter' },
        reply: [
          h('"Mi adorada Amaranta: tus ojos son como dos... lunas. Tu pelo, una cascada de... sopa."'),
          am('¡{wave}SOPA!{/wave} ¡Ahí te luciste! Es lo más cursi que me han dicho, y encima de baba. Me quedo contigo.', 'laugh'),
          { who: 'bard', text: 'Puedo ponerle música. Rima con "tomar sopa". ¡Llevo años esperando una excusa!', emote: 'music' },
        ],
      },
      {
        text: 'Hacer malabares con las rosas.', set: { endingChoice: 'juggle' },
        reply: [
          h('¡Mira! ¡Una, dos... tres rosas! ¡Y una más! Se me cae la cuarta... ¡y la quinta!', 'sweat'),
          am('¡Las espinas! ¡Cuidado! ...Bueno, ya te las has clavado todas. Qué torpeza más encantadora.', 'laugh'),
          { who: 'hero', text: 'Ay... pero lo importante es que no se me han caído... las quince que quedaban.', emote: 'dots' },
        ],
      },
    ],
  },
  { who: 'bard', text: 'Y bueno... (aplaude) ¡Una gran velada! Ya tengo canción: "El héroe, el ramo y la baba". Rima con casi nada. ¡Eso es el amor!', emote: 'music', ifFlag: 'pipoLikes' },
  am('Entonces, mi héroe, no pienso dejar que esta noche se estropee. ¡Que empiece el festival!', 'heart'),
];

/** Fin subtitles by endingChoice flag. */
export const ENDING_EPILOGUE: Record<string, string> = {
  bouquet: 'Se casaron en primavera. El ramo fue invitado de honor y la araña, su acompañante. Malvarrón mandó un regalo: una peluca. Con bigote.',
  letter: 'La carta fue enmarcada y colgada en el salón. Con baba incluida. Pipo la musicalizó. La sopa, desde entonces, es considerada un alimento romántico.',
  juggle: 'Amaranta le sanó las manos con besos y vendas. Hoy el héroe hace malabares en el festival... con ocho rosas, cinco curitas y un orgullo intacto.',
  default: 'Y vivieron felices, comieron perdices y nunca más volvieron a hablar de Malvarrón (bueno, un poco).',
};

export const ENDING_UI = { title: 'Fin', subtitle: ENDING_EPILOGUE.default, next: 'Continuar' };

export interface CreditSection { title: string; lines: string[]; }

/** Credits. The audio / VFX part summarises CREDITS.md. */
export const CREDITS: CreditSection[] = [
  { title: 'Corazones y Calabozos', lines: ['Una comedia romántica de oscura fantasía'] },
  { title: 'Un juego de', lines: ['El equipo de AFewDevs'] },
  { title: 'Diseño y programación', lines: ['Motor, mundos procedurales, combate, habilidades', 'Interfaz, objetos y botín', 'Misiones, diálogos e historia (y malos chistes)'] },
  { title: 'Música (CC0)', lines: [
    'A Legend Will Rise - CodeManu', 'Quaint Town - neonarkade', 'Treasure Hunter - TAD', 'Dark Cavern Ambient - Paul Wortmann',
    'Entering the Volcano / The Abyss - Umplix', 'Determined Pursuit - Emma_MA', 'The Hope - TAD',
  ] },
  { title: 'Efectos de sonido (CC0)', lines: [
    'Kenney Vleugels: Interface Sounds, 50 RPG Sound Effects', 'StarNinjas: 20 Sword Sound Effects', 'rubberduck: 100 CC0 SFX',
    'JaggedStone: Magic Spell SFX', 'haeldb: Spell Sounds', 'Jan Schupke: Fantasy Sound Effects', 'trazzz123: CC0 Deep Monster Roar',
  ] },
  { title: 'Efectos visuales (CC0)', lines: ['Kenney Vleugels: Particle Pack', 'Corazón procedural: generado para este proyecto'] },
  { title: 'Reparto (por orden de aparición)', lines: ['Abuelo Tobías - como él mismo, pero más largo', 'Pipo - como un bardo que rima mal', 'Gertrudis - como la mercader que te vende hasta el aire', 'Hermana Melisa - como la sanadora que no se queja (mucho)', 'Lord Malvarrón - como su bigote'] },
  { title: 'Gracias por jugar', lines: ['A Lady Amaranta, por esperar.', 'A Pipo, por rimar "corazón" con "camión".', 'A Malvarrón, por ser tan mal perdedor.', 'Y a su bigote, que merece su propio crédito.'] },
];

/** Shown after the credits stop rolling. */
export const CREDITS_JOKE = 'Ningún bigote resultó herido durante la realización de este juego.\n(Excepto uno. Pero se lo merecía.)';