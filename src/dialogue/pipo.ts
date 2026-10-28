import type { Line } from '../data/quests';

const b = (text: string): Line => ({ who: 'bard', text });
const h = (text: string): Line => ({ who: 'hero', text });

/** Pipo's quips when you level up ({lvl} = new level). */
export const PIPO_LEVELUP: string[] = [
  'Nivel {lvl}. Y todavía sin pareja. Qué ritmo tan equilibrado.',
  '¡Nivel {lvl}! Voy a componerte una balada... en cuanto encuentre algo que rime con "{lvl}".',
  'Nivel {lvl}: más fuerte, más guapo y exactamente igual de soltero.',
  '¡Eso, eso! Nivel {lvl}. Amaranta va a necesitar sentarse.',
  'Nivel {lvl}. En mis tiempos subíamos de nivel tropezando con ovejas.',
  'Subes a {lvl}. Mi consejo de bardo: sonríe más y sangra menos.',
  'Nivel {lvl}. Los goblins ya te tienen miedo y los poetas, envidia.',
  '¡{lvl}! Una cifra de lo más romántica, si no se mira de cerca.',
];

/** Idle comments by number of completed quests (0..6). */
const BY_PROGRESS: Line[][][] = [
  [
    [b('¿Tú eres el héroe que llegó tarde a su propia cita? Qué ilusión. Soy Pipo, bardo oficial de los corazones rotos.'), h('Todavía no he llegado tarde. La cita es en unos días.'), b('Es que me adelanto a los acontecimientos. Es un don.')],
    [b('Un consejo gratuito: los goblins no aceptan cartas de amor. Aceptan espadazos y, a veces, calcetines.')],
  ],
  [
    [b('Una carta recuperada. ¡Y sin tachones! Bueno, con algunos tachones. De baba.')],
    [b('Ahora van tras tu ramo, ¿no? Las rosas son traicioneras: te dan espinas y encima te miran con superioridad.')],
  ],
  [
    [b('¡Derrotaste a la Reina Espinas! Compondré una oda: "Oh, reina marchita / de pétalos ruines..." Me falta el segundo verso.')],
    [b('¿Vas a por el ogro? Dicen que rima en alejandrinos. En alejandrinos feos, pero alejandrinos.')],
  ],
  [
    [b('¡El Ogro Poeta, vencido! Estoy conmovido. Y algo aliviado: llevaba años intentando que me contratara de corrector.')],
    [b('Cenizar, ¿eh? Lleva cuidado: allí hace tanto calor que los corazones se derriten y las cartas se achicharran.')],
  ],
  [
    [b('Dicen que con el amuleto anticeloso los celos resbalan. A mí me resbalan los gazpachos, y es peor.')],
  ],
  [
    [b('¡La gárgola, derrotada! Solo queda el mago. Te compondré el final de la balada, pero lo guardo por si acaso falla.')],
  ],
  [
    [b('¡El mago bigotudo ha caído! Si llego a saber que tu historia acababa así, habría cobrado entradas.')],
  ],
];

/** Pipo's advice for the q_poet "talk" step (a comic rhyme tutorial). */
export const PIPO_RHYME_ADVICE: Line[] = [
  b('¡Ah, el héroe que va a plantarle cara al Ogro Poeta! Te voy a dar el mejor consejo de poesía de tu vida. Siéntate.'),
  b('Regla uno: todo lo que rime con "amor" te lo han dicho ya. "Dolor", "sabor", "calor"... y ya está. Sé original: rima con "rinoceronte".'),
  h('¿Rinoceronte con amor?'),
  b('"Eres para mí un rinoceronte: me embistes el corazón y me dejas sin horizonte". ¿Ves? Cursi, ridículo y directo al estómago.'),
  b('Regla dos: si el ogro te recita un verso, tú aplaude con entusiasmo. Si el ogro te recita dos, aplaude más fuerte. Si te recita tres... ya es tarde. Dale un espadazo.'),
  h('Gracias, Pipo. Creo.'),
  b('De nada, valiente. Y si sobrevives, cuéntaselo a todo el mundo. Y si no sobrevives, ¡cuéntaselo a alguien igualmente!'),
];

export function pipoComment(level: number, completed: number, gameCompleted: boolean): Line[] {
  if (gameCompleted) {
    return [b('¡Cuéntame cómo fue la cita! ¿Lloró? ¿Rio? ¿Intentó robarte el ramo?'), h('Fue... inolvidable.'), b('Perfecto: ya tengo canción.')];
  }
  const tier = BY_PROGRESS[Math.min(completed, BY_PROGRESS.length - 1)];
  const pick = tier[Math.floor(Math.random() * tier.length)];
  const lvl: Line[] = level >= 5 && Math.random() < 0.4
    ? [b(`Por cierto, nivel ${level}. Hay quien tarda toda una vida en llegar a eso... aunque no son héroes, son panaderos.`)]
    : [];
  return [...pick, ...lvl];
}