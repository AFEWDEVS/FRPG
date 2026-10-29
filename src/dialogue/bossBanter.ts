import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import type { Line } from '../data/quests';
import { DialogueManager } from './DialogueManager';

const mk = (who: string) => (text: string, emote?: string): Line => ({ who, text, emote });
const h = (text: string, emote?: string): Line => ({ who: 'hero', text, emote });
const hk = (text: string): Line => ({ who: 'hero', text, cls: 'knight' });
const hm = (text: string): Line => ({ who: 'hero', text, cls: 'mage' });
const hr = (text: string): Line => ({ who: 'hero', text, cls: 'ranger' });
const q = mk('thorn'), o = mk('ogre'), g = mk('gargoyle'), m = mk('malvarron');
const am = mk('amaranta');

interface Banter { pre: Line[]; post: Line[]; }

/** Flags: ogreVerse = 'best' | 'mid' | 'bad';  mustachePraise / mustacheInsult counters. */
export const BANTER: Record<string, Banter> = {
  thorn_queen: {
    pre: [
      q('{red}¡SILENCIO, PLEBE!{/red} ¿Quién osa pisar los pétalos de Su Majestad Espinosa?', '!'),
      h('Vengo a por mi ramo, majestad. Es para una cita muy importante.', 'sweat'),
      q('¿Cita? ¿Con quién? ¿Con alguien más guapo que yo, que soy una flor? ¡Imposible!', 'angry'),
      {
        who: 'thorn', text: 'Arrodíllate, mortal. O al menos hazme un cumplido botánico.',
        choices: [
          { text: 'Qué bonitos pétalos tiene, majestad.', buff: 'haste', set: { thornFlattery: true }, reply: [q('{pink}Pues claro que sí.{/pink} Pero no por eso te dejaré marchar. Concédeme un baile antes... ¡de guerra!', 'blush')] },
          { text: 'Le traigo abono, majestad. Del bueno.', item: 'health', reply: [q('¿ABONO? Qué descaro... qué detalle. ¡Guardias, espinas, a la carga!', 'sweat')] },
          { text: 'Me han dicho que las rosas pinchan, pero no sabía que ladraban.', buff: 'slow', reply: [q('{shake}¡INSOLENTE!{/shake} ¡Te pincharé hasta que aprendas a respetar!', 'angry')] },
        ],
      },
    ],
    post: [
      q('Ah... mis pétalos... caen... qué indigno... ¿Sabes que me llamaban la {wave}Reina de las Flores{/wave}?', 'broken'),
      h('Con mucho respeto, majestad: le recomendaría un curso de jardinería emocional.', 'dots'),
      q('Quizá... fue el hechizo de aquel mago... Dale el ramo a tu dama. Dile que lo cuidé... con cariño. Y mucho abono.', 'heart'),
    ],
  },
  ogre_poet: {
    pre: [
      o('{big}¡HOLA!{/big} Soy el Ogro Poeta. ¡Recito, y el que no aplaude... se queda sin cabeza!', '!'),
      hk('¡Un caballero no huye de un poema! ...Aunque quizá de dos.'),
      hm('Estructuralmente, los ogros tienden a la rima consonante. Qué fascinante. Qué temible.'),
      hr('¿Poemas? ¡Soy trovador! Hoy el que rime mejor se queda con la gloria y la cena.'),
      o('Escucha mi obra maestra: "Tu cara es una calabaza / y tu alma, una cabaza... "', 'music'),
      o('¡Falta una rima! ¡Ayúdame, mortal, o te aplasto! Elige un verso para cerrar: ¡el más bello salvará tu cráneo!', 'sweat'),
      {
        who: 'ogre', text: '"Tu cara es una calabaza..."',
        choices: [
          { text: '"...y aun así, mi corazón la abraza".', set: { ogreVerse: 'best' }, buff: 'haste', reply: [o('{gold}...¡OH!{/gold} {wave}Abraza{/wave}... con calabaza... {pink}¡es un diamante!{/pink} Me has emocionado... y distraído.', 'sparkle'), h('(El Ogro se enjuga una lágrima y te sientes inspirado.)')] },
          { text: '"...que de tan fea se te pasa la casa".', set: { ogreVerse: 'mid' }, buff: 'heal', reply: [o('Mmm. Rima. Más o menos. Me has hecho gracia. {gold}Respiras tranquilo{/gold}, mortal. Por ahora.', 'laugh'), h('(Te sientes un poco mejor.)')] },
          { text: '"...ay, no tengo rima, qué cosa rara".', set: { ogreVerse: 'bad' }, buff: 'slow', reply: [o('{red}¡ABURRIDO!{/red} ¡Qué verso tan malo! ¡Te lo has ganado!', 'angry'), h('(El miedo te pesa en las piernas.)')] },
        ],
      },
    ],
    post: [
      o('Adiós, mortal... mi alma poética... se desvanece... ¿Podrías... corregir mi último poema?', 'broken'),
      h('...¿"Mi corazón es una cebolla / que llora y no me controla"?'),
      o('¡Perfecto! {gold}¡El mejor verso de mi vida!{/gold} Yo... solo quería... que alguien... me escuchara.', 'heart'),
      { who: 'ogre', text: 'Por favor, no le cuentes a nadie que lloré.', ifFlag: 'ogreVerse' },
    ],
  },
  jealous_gargoyle: {
    pre: [
      g('{red}¡TÚ!{/red} Sí, tú, el que huele a ramo y a cita. Os veo desde aquí arriba. ¡Todos felices! ¡Qué asco!', 'angry'),
      h('Disculpa, solo voy de paso a la torre...', 'sweat'),
      g('Nadie pasa de largo. Yo llevo mil años sobre este pedestal viendo parejitas besarse. ¡MIL AÑOS!', 'broken'),
      {
        who: 'gargoyle', text: '¿Tienes pareja? ¿Sí? ¡Entonces tendrás que enfrentarte a mis celos!',
        choices: [
          { text: 'Qué pedestal tan bonito. Muy elegante.', buff: 'heal', reply: [g('...¿Tú crees? Me lo pulieron en el siglo XII. Nadie lo había notado. {pink}Gracias.{/pink} Pero te sigo golpeando.', 'blush')] },
          { text: 'Mi cita es muy simpática. Seguro que le caerías bien.', buff: 'slow', reply: [g('¿SIMPÁTICA? ¿CAERLE BIEN? ¡{shake}AAARGH!{/shake}', 'angry')] },
          { text: 'Si quieres, te presento a una gárgola soltera.', buff: 'haste', set: { gargoyleMatch: true }, reply: [g('¿...Hay otras? ¿Con alas? Mmm... {gold}Eso me interesa.{/gold} Pero primero, te destruyo.', 'heart')] },
        ],
      },
    ],
    post: [
      g('Me desmorono... qué cansancio de ser tan de piedra... ¿Te importaría presentarme a esa gárgola?', 'broken', ),
      h('Lo intentaré. Pero a lo mejor debes cuidar los modales primero.', 'sweat'),
      g('Prometo no mirar mal. Ni tanto. Solo un poco. Adiós, héroe. Y gracias... por escuchar.', 'heart'),
    ],
  },
  malvarron: {
    pre: [
      m('Vaya, vaya. El héroe que escribe cartas con faltas de ortografía. {gold}Bienvenido a mi torre.{/gold}', 'laugh'),
      m('Antes de que me lo preguntes, sí: mi bigote es natural. Treinta años de cuidados. ¡Y brilla!', 'sparkle'),
      {
        who: 'malvarron', text: 'Contempla este esplendor. ¿Qué opinas, plebeyo?',
        choices: [
          { text: 'Es el mejor bigote que he visto en mi vida.', add: { mustachePraise: 1 }, buff: 'heal', reply: [m('{pink}¡POR FIN!{/pink} Alguien con criterio... Sigues siendo mi enemigo, pero con mucho gusto.', 'blush')] },
          { text: 'Parece una escoba dormida.', add: { mustacheInsult: 1 }, buff: 'smite', reply: [m('{shake}¡UNA ESCOBA!{/shake} ¡Retira eso o te achicharro!', 'angry')] },
          { text: 'Tienes algo en el bigote.', add: { mustacheNeutral: 1 }, buff: 'haste', reply: [m('¿DÓNDE? ¿QUÉ? ¡No me mires, que me desordeno! ...Ah, era una miga. Qué vergüenza.', 'sweat')] },
        ],
      },
      m('Antes de los rayos, un detalle: durante mi infancia, mi madre dijo que sin bigote yo no era nadie. Y míralo: soy alguien. Alguien con bigote.', 'dots'),
      {
        who: 'malvarron', text: 'Y tú, ¿qué tienes que ver con Lady Amaranta? Yo soy su mejor opción: poder, estilo y un bigote inmejorable.',
        choices: [
          { text: 'Ella me escribió una carta. A ti, no.', set: { malvJealous: true }, buff: 'slow', reply: [m('¡Me escribe a mí! Todas me escriben. Mentira, ninguna. Pero en el fondo, SÍ.', 'broken')] },
          { text: '¿Tu mejor opción? Si ni siquiera tienes cita.', buff: 'smite', reply: [m('¡Detalle sin importancia! ¡Es que ella aún no lo sabe!', 'angry')] },
          { text: 'El amor no se manda, Malvarrón. Se gana.', add: { malvRespect: 1 }, buff: 'haste', reply: [m('...Eso es muy bonito. Lo anotaré para mi bigote. Digo, para mi diario.', 'dots')] },
        ],
      },
      m('Basta de charla. Última pregunta: ¿preferirías perder la vida o el bigote?', 'sweat'),
      {
        who: 'malvarron', text: '(Espero que respondas "la vida". Por favor.)',
        choices: [
          { text: 'La vida. Pero me quedo con el bigote.', reply: [m('¡Bien dicho! Un hombre de honor... ¡Al combate!', 'angry')] },
          { text: 'El bigote. Mi cara es más bonita sin él.', add: { mustacheInsult: 1 }, buff: 'smite', reply: [m('...Tu cara es lo de menos, ¡MI BIGOTE ES SAGRADO!', 'angry')] },
          { text: 'Ninguno. Te vencería sin despeinarme.', add: { mustachePraise: 1 }, reply: [m('Qué descaro. Me gustas. ¡Prepárate, héroe!', 'laugh')] },
        ],
      },
    ],
    post: [
      m('Imposible... derrotado... por un enamorado con faltas de ortografía... Mi {wave}bigote{/wave}... ¡Mi bigote está despeinado!', 'broken'),
      { who: 'malvarron', text: 'Al menos reconozco que me hiciste un cumplido... tengo mucho bigote para tan poco elogio.', ifFlag: 'mustachePraise' },
      { who: 'malvarron', text: '...Y me insultaste el bigote. Eso se me quedará grabado en el pelo.', ifFlag: 'mustacheInsult' },
      h('Lo siento por el bigote, de veras.', 'dots'),
      m('Anda, ve con ella. Dile que... que Malvarrón le desea... una cita mediocre. Y que, si quiere, tengo una lista de peluqueros.', 'heart'),
      am('(A lo lejos, una voz familiar susurra tu nombre. Es hora de la cita.)', 'heart'),
    ],
  },
};

let inited = false;
/** Pre-fight banter plays once per boss on 'boss:engaged' (game paused); post-fight on 'boss:defeated'. */
export function initBanter(): void {
  if (inited) return;
  inited = true;
  EventBus.on('boss:engaged', ({ bossId }) => {
    const b = BANTER[bossId];
    const key = `banterPre_${bossId}`;
    if (!b || GameState.flags[key]) return;
    GameState.flags[key] = true;
    window.setTimeout(() => DialogueManager.play(b.pre, { freeze: true }), 450);
  });
  EventBus.on('boss:defeated', ({ bossId }) => {
    const b = BANTER[bossId];
    if (!b) return;
    window.setTimeout(() => { if (!DialogueManager.play(b.post)) DialogueManager.queue(b.post); }, 1400);
  });
}