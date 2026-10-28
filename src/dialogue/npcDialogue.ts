import { GameState } from '../core/GameState';
import type { Line } from '../data/quests';
import { QuestManager } from '../quests/QuestManager';
import { DialogueManager } from './DialogueManager';
import { PIPO_RHYME_ADVICE, pipoComment } from './pipo';

const e = (text: string): Line => ({ who: 'elder', text });

const ELDER_IDLE: Line[][] = [
  [e('El Festival de las Dos Lunas está a la vuelta de la esquina. Hasta las gallinas se han puesto corbata.')],
  [e('Cuando yo era joven, le declaré mi amor a una dama en un campo de coles. Salí con las orejas rojas y un nabo en la cabeza. ¡Ánimo, {hero}!')],
  [e('Si Malvarrón vuelve a aparecer por la plaza, avisa: tengo preparada una escoba de ceremonia.')],
];
const ELDER_DONE: Line[] = [
  e('¡{hero}! El pueblo entero habla de ti. Y de lo bien que cantaba Lady Amaranta. Y de que alguien tiró un pastel.'),
  e('Siempre supe que acabarías la historia con estilo. Y con un poco de ayuda de este viejo, claro.'),
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
  const idle = ELDER_IDLE[Math.floor(Math.random() * ELDER_IDLE.length)];
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

