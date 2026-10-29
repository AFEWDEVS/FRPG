import { GameState } from '../core/GameState';
import type { Line } from '../data/quests';
import { QuestManager } from '../quests/QuestManager';
import { DialogueManager } from './DialogueManager';
import { PIPO_RHYME_ADVICE, pipoComment } from './pipo';

const e = (text: string, emote?: string): Line => ({ who: 'elder', text, emote });
const h = (text: string, emote?: string): Line => ({ who: 'hero', text, emote });

/** Abuelo Tobias' youthful romance tangents; each visit tells the next one (flag elderTales). */
const ELDER_TALES: Line[][] = [
  [e('Cuando yo era joven, le declaré mi amor a una dama en un campo de coles. Salí con las orejas rojas y un nabo en la cabeza.'), h('¿Te dijo que sí?', '?'), e('Me dijo "qué nabo". Lo tomé como un sí.')],
  [e('Una vez le serenateé a Rosalía bajo su ventana. Me tiró un cubo de agua. Tibia. Fue su forma de decir que le gustaba.', 'laugh'), e('Años después supe que era el cubo de fregar. Pero el gesto cuenta.')],
  [e('Conocí a Dorotea en el molino. Me enamoré de su risa y de su harina. Hoy sigo casado con las dos... digo, con ella. La harina se fue.')],
  [e('A los dieciséis escribí un poema para Jacinta. Se lo comió la cabra. El poema, no Jacinta. Jacinta se casó con el boticario, que no tenía cabra.')],
  [e('¿Te conté la vez que me enamoré de una estatua en la plaza? Yo le hablé toda una noche. Por la mañana, la estatua seguía sin hablarme. Hoy es mi mejor amiga.')],
  [e('Para impresionar a Margarita, me subí a un árbol a cantar. Me quedé atascado tres días. Ella me bajó con una escalera y dijo: "Qué voz". No dijo cuál.')],
];
const ELDER_IDLE: Line[][] = [
  [e('El Festival de las Dos Lunas está a la vuelta de la esquina. Hasta las gallinas se han puesto corbata.')],
  [e('Si Malvarrón vuelve a aparecer por la plaza, avisa: tengo preparada una escoba de ceremonia. Con bendición y todo.')],
  [e('¿Has mirado bien el bigote de Malvarrón? Dicen que lo peina con peine de ballena. Y la ballena no estaba de acuerdo.')],
];
const ELDER_DONE: Line[] = [
  e('¡{hero}! El pueblo entero habla de ti. Y de lo bien que cantaba Lady Amaranta. Y de que alguien tiró un pastel.', 'sparkle'),
  e('Siempre supe que acabarías la historia con estilo. Y con un poco de ayuda de este viejo, claro.'),
  { who: 'elder', text: 'Eso me recuerda a mi boda: hubo cabra, harina y un nabo. Una celebración como Dios manda.', ifFlag: 'elderSpelling' },
];

/** Entry point for 'npc:interact'. Merchant and healer are handled by the UI module. */
export function handleNpcInteract(npcId: string): void {
  switch (npcId) {
    case 'elder': elder(); break;
    case 'bard': bard(); break;
    default: break;
  }
}

function acceptChoices(id: string): { text: string; onPick: () => void }[] {
  return [
    { text: '¡Cuenta conmigo!', onPick: () => QuestManager.accept(id) },
    { text: 'Ahora no, abuelo.', onPick: () => { /* stays available */ } },
  ];
}

function elder(): void {
  const QM = QuestManager;
  const ready = QM.readyFor('elder')[0];
  if (ready) {
    // Hand-in; if the next quest is now on offer, its offer follows in the same conversation.
    DialogueManager.play(ready.dialogue.turnIn, {
      onDone: () => {
        QM.turnIn(ready.id);
        const next = QM.availableFrom('elder')[0];
        if (next) DialogueManager.queue(next.dialogue.offer, { choices: acceptChoices(next.id) });
      },
    });
    return;
  }
  const offer = QM.availableFrom('elder')[0];
  if (offer) { DialogueManager.play(offer.dialogue.offer, { choices: acceptChoices(offer.id) }); return; }
  const active = QM.activeFrom('elder')[0];
  if (active && active.dialogue.active.length) { DialogueManager.play(active.dialogue.active); return; }
  if (GameState.flags.gameCompleted) { DialogueManager.play(ELDER_DONE); return; }
  const n = Number(GameState.flags.elderTales) || 0;
  GameState.flags.elderTales = n + 1;
  const idle = n % 3 === 2 ? ELDER_IDLE[Math.floor(Math.random() * ELDER_IDLE.length)] : ELDER_TALES[n % ELDER_TALES.length];
  const hint = QM.state('q_poet') === 'done' && !QM.state('q_malvarron')
    ? [e('El portal al Mundo 2 te espera. Cuando cruces, quizá recibas noticias de cierta dama.')] : [];
  DialogueManager.play([...idle, ...hint]);
}

function bard(): void {
  const QM = QuestManager;
  const talk = QM.pendingTalk('bard');
  if (talk) {
    DialogueManager.play(PIPO_RHYME_ADVICE, { onDone: () => QM.advanceTalk('bard') });
    return;
  }
  const p = GameState.profile;
  DialogueManager.play(pipoComment(p.level, QM.completedCount(), !!GameState.flags.gameCompleted));
}