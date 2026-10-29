import type { ChoiceDef, Line } from '../data/quests';

const b = (text: string, emote?: string): Line => ({ who: 'bard', text, emote });
const h = (text: string, emote?: string): Line => ({ who: 'hero', text, emote });
const hk = (text: string): Line => ({ who: 'hero', text, cls: 'knight' });
const hm = (text: string): Line => ({ who: 'hero', text, cls: 'mage' });
const hr = (text: string, emote?: string): Line => ({ who: 'hero', text, cls: 'ranger', emote });

/** Pipo's quips when you level up ({lvl} = new level). Plain text (shown as toast). */
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
    [b('¿Tú eres el héroe que llegó tarde a su propia cita? Qué ilusión. Soy Pipo, bardo oficial de los corazones rotos y de los zapatos mojados.'), h('Todavía no he llegado tarde. La cita es en unos días.'), b('Es que me adelanto a los acontecimientos. Es un don. También llego temprano a los funerales.', 'music')],
    [b('Un consejo gratuito: los goblins no aceptan cartas de amor. Aceptan espadazos y, a veces, calcetines.')],
  ],
  [
    [b('Una carta recuperada. ¡Y sin tachones! Bueno, con algunos tachones. De baba. Es literatura de vanguardia.')],
    [b('Ahora van tras tu ramo, ¿no? Las rosas son traicioneras: te dan espinas y encima te miran con superioridad. Como mi suegra, y ni siquiera estoy casado.')],
  ],
  [
    [b('¡Derrotaste a la Reina Espinas! Compondré una oda: "Oh, reina marchita / de pétalos ruines..." Me falta el segundo verso. Y el tercero. Y la oda.')],
    [b('¿Vas a por el ogro? Dicen que rima en alejandrinos. En alejandrinos feos, pero alejandrinos.')],
  ],
  [
    [b('¡El Ogro Poeta, vencido! Estoy conmovido. Y algo aliviado: llevaba años intentando que me contratara de corrector.')],
    [b('Cenizar, ¿eh? Lleva cuidado: allí hace tanto calor que los corazones se derriten y las cartas se achicharran. Y los bardos se deshidratan.')],
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

const RHYMES: string[] = [
  '"Tu amor es un flan / que se cae del plan." ¡Eso es poesía de alto nivel!',
  '"Te quiero, mi amor, / como un oso al tambor." No entiendo el tambor, pero suena bien.',
  '"Tus ojos son soles, / tus dientes, camiones." ¡Un clásico!',
  '"Eres mi sopa, mi pan y mi sal, / y si no me quieres, me voy al corral."',
  '"Oh, luna de plata, / dame una patata." Es profundo. Muy profundo. Hasta el fondo de la despensa.',
];

/** Pipo's rhyme of the day: you pick a reaction, flags track his opinion of you. */
function rhymeOfTheDay(): Line[] {
  const r = RHYMES[Math.floor(Math.random() * RHYMES.length)];
  const react: ChoiceDef[] = [
    { text: '¡Bravo! ¡Otra!', add: { pipoLikes: 1 }, reply: [b('¡¿Otra?! Eres el primero que lo pide. Te regalo una promesa de dedicatoria. {gold}Vale una moneda{/gold}.', 'sparkle')] },
    { text: 'Eh... ¿es una broma?', add: { pipoLikes: -1 }, reply: [b('{shake}¡Crítico!{/shake} Todos son críticos. Hasta mi madre dijo "mm". Con ese tono.', 'broken')] },
    { text: 'Tengo una mejor. "Rosa" rima con "cosa".', add: { pipoLikes: 1 }, set: { pipoDuel: true }, reply: [b('...', 'dots'), b('Ay, no. Es perfecta. Qué rabia. Quedas contratado como mi rival oficial.', 'angry')] },
  ];
  return [
    b('¡Justo a tiempo! Es la hora de mi {wave}Rima del Día{/wave}. Escucha y llora:', 'music'),
    b(r),
    { who: 'bard', text: '¿Y bien? ¿Qué te ha parecido?', choices: react },
  ];
}

/** Pipo's advice for the q_poet "talk" step (a comic rhyme tutorial). */
export const PIPO_RHYME_ADVICE: Line[] = [
  b('¡Ah, el héroe que va a plantarle cara al Ogro Poeta! Te voy a dar el mejor consejo de poesía de tu vida. Siéntate.', 'sparkle'),
  b('Regla uno: todo lo que rime con "amor" te lo han dicho ya. "Dolor", "sabor", "calor"... y ya está. Sé original: rima con "rinoceronte".'),
  h('¿Rinoceronte con amor?', '?'),
  b('"Eres para mí un rinoceronte: me embistes el corazón y me dejas sin horizonte". ¿Ves? Cursi, ridículo y directo al estómago.'),
  hk('Para un caballero, el rinoceronte es un buen aliado. Y un mejor caballo.'),
  hm('Etimológicamente, "rinoceronte" significa "nariz con cuerno". Creo que es una metáfora.'),
  hr('Si el ogro me insulta en verso, ¡yo le contesto en rima y en flecha!', 'music'),
  b('Regla dos: si el ogro te recita un verso, tú aplaude con entusiasmo. Si te recita dos, aplaude más fuerte. Si te recita tres... ya es tarde. Dale un espadazo.'),
  {
    who: 'bard', text: 'Regla tres: ¿cuánto vale para ti un buen consejo? Piénsalo antes de contestar.',
    choices: [
      { text: 'Gracias, Pipo. Eres un tesoro.', add: { pipoLikes: 2 }, reply: [b('¡¿Un tesoro?! Voy a llorar. Voy a escribir sobre esto. Voy a cobrar por esto.', 'sparkle')] },
      { text: 'Toma una moneda por las molestias.', add: { pipoLikes: 1 }, reply: [b('¡Una moneda! La enmarcaré. O la gastaré en pan. Primero en pan.')] },
      { text: 'Creo que me acaba de salir una arruga.', add: { pipoLikes: -1 }, reply: [b('Es la arruga del pensamiento. Se te quita con una buena rima. O con una siesta.', 'zzz')] },
    ],
  },
  b('De nada, valiente. Y si sobrevives, cuéntaselo a todo el mundo. Y si no sobrevives, ¡cuéntaselo a alguien igualmente!'),
];

export function pipoComment(level: number, completed: number, gameCompleted: boolean): Line[] {
  if (gameCompleted) {
    return [
      b('¡Cuéntame cómo fue la cita! ¿Lloró? ¿Rio? ¿Intentó robarte el ramo?', '?'),
      h('Fue... inolvidable.'),
      b('Perfecto: ya tengo canción. Se llama "El héroe que llegó tarde... pero llegó". Rima con todo, porque no rima con nada.', 'music'),
    ];
  }
  const tier = BY_PROGRESS[Math.min(completed, BY_PROGRESS.length - 1)];
  const pick = tier[Math.floor(Math.random() * tier.length)];
  const lvl: Line[] = level >= 5 && Math.random() < 0.4
    ? [b(`Por cierto, nivel ${level}. Hay quien tarda toda una vida en llegar a eso... aunque no son héroes, son panaderos.`)]
    : [];
  const out = [...pick, ...lvl];
  if (Math.random() < 0.45) out.push(...rhymeOfTheDay());
  return out;
}