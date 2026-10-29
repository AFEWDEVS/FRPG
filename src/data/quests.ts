import type { AreaId } from '../core/types';

/** Effects a dialogue choice can apply. */
export interface ChoiceDef {
  text: string;
  /** Only offered to this class. */
  cls?: import('../core/types').ClassId;
  /** Flags to store in GameState.flags (numbers add to the current value when `add` is true). */
  set?: Record<string, string | number | boolean>;
  add?: Record<string, number>;
  gold?: number;
  item?: 'health' | 'mana';
  /** Combat buff: 'haste' | 'heal' | 'slow' (player debuff) | 'smite' (damages the engaged boss). */
  buff?: 'haste' | 'heal' | 'slow' | 'smite';
  toast?: string;
  /** Lines played right after the chosen option. */
  reply?: Line[];
}

/**
 * One line of a conversation. `who` is a speaker id ('elder', 'bard', 'amaranta', 'hero', 'malvarron'...).
 * {hero} = player name. Inline tags: {shake}{wave}{red}{gold}{pink}{big} ... {/x}.
 */
export interface Line {
  who: string; text: string;
  /** Only played for this class. */
  cls?: import('../core/types').ClassId;
  /** Only if the flag is truthy / falsy. */
  ifFlag?: string; notFlag?: string;
  /** Emote shown above the speaker while the line plays. */
  emote?: string;
  /** Mid-conversation choices (this line then waits for a pick). */
  choices?: ChoiceDef[];
}

export type StepType = 'kill' | 'boss' | 'collect' | 'talk' | 'enter';

/** How a 'collect' step gets its quest items (the quest engine rolls this on 'enemy:died'). */
export interface DropRule {
  /** Enemy def ids that can drop it. */
  from: string[];
  areas: AreaId[];
  chance: number;
  /** Chance for any other (non-listed) enemy in those areas. */
  other: number;
  /** After this many kills without a drop, the next one drops for sure. */
  pity: number;
  /** Champions / bosses of any type always drop it. */
  champion: boolean;
}

export interface QuestStep {
  type: StepType;
  /** kill: enemy def id; boss: boss id; collect: item key; talk: npc id; enter: area id. */
  target: string;
  count?: number;
  /** enter: dungeon floor (0-based) that must be reached (optional). */
  floor?: number;
  text: string;
  drop?: DropRule;
  itemName?: string;
}

export interface QuestRewards { xp: number; gold: number; skillPoints?: number; text: string; }

export interface QuestDef {
  id: string;
  title: string;
  /** NPC that offers the quest (shown in the log); ignored for autoStart quests. */
  giver: string;
  description: string;
  world: 1 | 2;
  goal: string;
  /** Quest that must be 'done' before this one becomes available. */
  prereq?: string;
  /** Starts by itself when the prereq is done (announced through a vision/letter from Amaranta). */
  autoStart?: boolean;
  /** NPC that receives the report; null = completes the moment the last step is done. */
  turnIn: string | null;
  steps: QuestStep[];
  rewards: QuestRewards;
  dialogue: {
    /** Offer (or the vision that starts an autoStart quest). */
    offer: Line[];
    /** Reminder when the player talks to the giver while the quest is running. */
    active: Line[];
    /** Handing it in. */
    turnIn: Line[];
  };
}

const el = (text: string, emote?: string): Line => ({ who: 'elder', text, emote });
const h = (text: string, emote?: string): Line => ({ who: 'hero', text, emote });
const hk = (text: string, emote?: string): Line => ({ who: 'hero', text, cls: 'knight', emote });
const hm = (text: string, emote?: string): Line => ({ who: 'hero', text, cls: 'mage', emote });
const hr = (text: string, emote?: string): Line => ({ who: 'hero', text, cls: 'ranger', emote });
const am = (text: string, emote?: string): Line => ({ who: 'amaranta', text, emote });

export const QUESTS: QuestDef[] = [
  {
    id: 'q_letter', title: 'Cartas Perdidas', giver: 'elder', world: 1, turnIn: 'elder',
    description: 'Malvarrón leyó tu carta de amor en voz alta, se burló de tu ortografía y la convirtió en goblins. Cada goblin lleva una página. Es el peor plagio de la historia.',
    goal: 'Recupera las 3 páginas de tu carta de amor (cuanto más babeadas, más auténticas).',
    steps: [{
      type: 'collect', target: 'letter_page', count: 3, itemName: 'Página de la carta',
      text: 'Quita las páginas de la carta a los goblins (los campeones azules llevan de sobra)',
      drop: { from: ['goblin'], areas: ['w1', 'd1'], chance: 0.35, other: 0.07, pity: 5, champion: true },
    }],
    rewards: { xp: 150, gold: 60, text: 'Una carta casi legible y una bolsa de monedas' },
    dialogue: {
      offer: [
        el('¡{hero}! Por fin. Llevo toda la mañana intentando no contarte lo que ha pasado.', 'dots'),
        h('Eso solo puede significar que ha pasado algo. ¿Dónde está mi carta de amor para Lady Amaranta?', 'sweat'),
        el('Verás... Lord Malvarrón pasó por aquí, la leyó en voz alta, {shake}se rio de tu ortografía{/shake} y, con un chasquido, la convirtió en goblins.'),
        h('¿En goblins? ¿La carta entera?', '!'),
        el('Tres páginas, tres goblins ladrones. Se esconden en el Bosque de Verdeluna. Los campeones azules suelen llevar página de sobra: son los que mejor se organizan.'),
        hk('Por Amaranta me enfrentaré a un ejército de goblins. Aunque le tengo cierta manía a los calcetines que sueltan.'),
        hm('Técnicamente es transmutación no consentida de papel a criatura. Eso es {gold}papeleo{/gold} serio.'),
        hr('Con tinta y con rima los voy a rimar, y si no se rinden, los voy a clavar.', 'music'),
        el('Eso mismo pensaba yo cuando era joven, con Dorotea, la hija del molinero. Le escribí un poema y ella me tiró un saco de harina. Tres semanas blanco. Me casé con ella, ojo. Pero esa es otra historia.'),
        {
          who: 'elder', text: 'Anda, ¿me prometes traer las páginas?',
          choices: [
            { text: 'Cuenta con ello, abuelo.', reply: [el('Así se habla. Te daré hilo de abuelo para coserlas.')] },
            { text: '¿Y si ya no hay remedio para mi ortografía?', set: { elderSpelling: true }, reply: [el('Para eso estoy yo. Corregí los exámenes del pueblo durante veinte años. Los de la gallina no, esos no tienen arreglo.')] },
          ],
        },
      ],
      active: [
        el('Tres páginas, {hero}. Tres. Si traes cuatro, sospecharé que has escrito una carta nueva... y peor.'),
        el('Los goblins rondan el Bosque de Verdeluna y las Cuevas del Suspiro. Cuidado con los azules: roban con más estilo.'),
      ],
      turnIn: [
        el('¡Las tres páginas! Y apenas están babeadas. Déjame ver... "Mi adorada Amaranta, tus ojos son como dos... lunas"...', 'laugh'),
        h('¡No leas en voz alta!', 'angry'),
        el('Perdón, perdón. Es que tienes talento, muchacho: de lo más cursi que he oído en cuarenta años.'),
        el('Sigue: "Tu pelo es como una cascada de... sopa"?', 'dots'),
        h('Era "seda". La mancha de baba se comió la e.', 'sweat'),
        el('Con eso ya tienes la carta. Pero un enamorado sin ramo es un enamorado sin cita. Y adivina quién ha secuestrado las flores.'),
      ],
    },
  },
  {
    id: 'q_bouquet', title: 'Ramo Maldito', giver: 'elder', world: 1, turnIn: 'elder', prereq: 'q_letter',
    description: 'La Reina Espinas, hechizada por Malvarrón, custodia el ramo de rosas en lo profundo del Bosque de Verdeluna. Es muy estricta con los pétalos y con las visitas.',
    goal: 'Derrota a la Reina Espinas y recupera el ramo de rosas.',
    steps: [{ type: 'boss', target: 'thorn_queen', text: 'Derrota a la Reina Espinas en el Bosque de Verdeluna', itemName: 'Ramo de rosas' }],
    rewards: { xp: 450, gold: 150, skillPoints: 1, text: 'Un ramo (algo chamuscado) y un punto de habilidad' },
    dialogue: {
      offer: [
        el('Hablando de flores: tu ramo de rosas rojas tampoco ha tenido un buen día.'),
        h('¿Qué le ha pasado a mi ramo?', '!'),
        el('Malvarrón lo maldijo. Las rosas cobraron vida, eligieron reina y ahora la Reina Espinas gobierna un rincón del bosque. Dicen que es muy estricta con los pétalos y que tiene un {wave}carácter floral{/wave}.'),
        h('Un ramo con complejo de monarca. Perfecto.'),
        {
          who: 'elder', text: 'Tráeme ese ramo de vuelta. Sin espinas, a ser posible. ¿Cuántas espinas toleras?',
          choices: [
            { text: 'Las justas para sobrevivir.', reply: [el('Esa es la actitud del buen enamorado. Yo perdí una oreja por una margarita. La recuperé, pero estaba arrugada.')] },
            { text: 'Cero. Soy alérgico al drama.', set: { allergicHero: true }, reply: [el('Qué mala suerte: en el bosque todo es drama. Hasta las setas hacen {wave}telenovela{/wave}.')] },
            { text: '¡Que me pinchen, es romántico!', add: { romantic: 1 }, reply: [el('Ay, qué joven eres. Te va a doler, pero qué bien queda en el poema.')] },
          ],
        },
      ],
      active: [
        el('La Reina Espinas está en el Bosque de Verdeluna, lejos del camino. Si ves rosas que te miran con desdén, vas bien.'),
      ],
      turnIn: [
        el('¡Vaya! ¡El ramo! Está un poco chamuscado y le faltan pétalos, pero eso le da carácter.'),
        h('Se ve... romántico, a su manera.'),
        el('Es como yo en mi juventud: mucho ímpetu y poco pelo. Regalé un ramo a la señorita Jacinta y se lo comió la cabra. La cabra y yo seguimos sin hablarnos.'),
        el('Ahora que tienes carta y ramo solo te falta cruzar hasta Cenizar. Y para eso hay que pasar por las Cuevas del Suspiro, donde un ogro con alma de poeta bloquea la salida.'),
      ],
    },
  },
  {
    id: 'q_poet', title: 'Rima o Muere', giver: 'elder', world: 1, turnIn: 'elder', prereq: 'q_bouquet',
    description: 'El Ogro Poeta guarda el fondo de las Cuevas del Suspiro y exige versos... o la vida del visitante. Derrotarlo abrirá el portal al Mundo 2. Pipo asegura que sabe de rimas (cobra por ello).',
    goal: 'Escucha el consejo poético de Pipo y derrota al Ogro Poeta en el último nivel de las Cuevas del Suspiro.',
    steps: [
      { type: 'talk', target: 'bard', text: 'Pídele consejo poético a Pipo, el bardo (escucharás cosas)' },
      { type: 'boss', target: 'ogre_poet', text: 'Derrota al Ogro Poeta en el último nivel de las Cuevas del Suspiro' },
    ],
    rewards: { xp: 1000, gold: 300, skillPoints: 1, text: 'El portal al Mundo 2 queda desbloqueado' },
    dialogue: {
      offer: [
        el('Ahora, lo difícil. Para llegar a Cenizar hay que cruzar las Cuevas del Suspiro hasta el fondo. Allí vive el Ogro Poeta.'),
        h('¿Poeta? ¿Y qué tiene de peligroso un poeta?', 'dots'),
        el('Obliga a todo visitante a escuchar sus versos. Si no se los aplaudes, te aplasta. Si se los aplaudes, te recita más. Nadie ha salido ileso, y mucho menos con los oídos intactos.'),
        el('Antes de bajar, habla con Pipo: dice que sabe de rimas. Lo que no sabe es de combate, pero eso ya lo pones tú.', 'music'),
      ],
      active: [
        el('Las Cuevas del Suspiro, hasta el último nivel. Sigue las escaleras hacia abajo y guíate por el sonido de alguien rimando "dolor" con "amor"... con "sudor".'),
      ],
      turnIn: [
        el('Se oyó un rugido de aplausos en el valle y luego un silencio muy bonito. ¿Lo has hecho, {hero}?'),
        h('El Ogro Poeta ha dejado de rimar. Para siempre.'),
        el('El portal al Mundo 2 ya no está sellado. Allí, en las Ruinas de Cenizar, empieza la torre de Malvarrón. Ve con cuidado, y con una muda por si acaso.'),
        el('Y acuérdate de mí cuando conquistes a Amaranta. Yo conquisté a Dorotea con un nabo y mucho aplomo.'),
      ],
    },
  },
  {
    id: 'q_amulet', title: 'Amuleto Anticeloso', giver: 'amaranta', world: 2, turnIn: null, prereq: 'q_poet', autoStart: true,
    description: 'Amaranta te avisa por carta mágica: Malvarrón ha llenado las Ruinas de Cenizar de celos ambulantes. Solo un amuleto anticeloso te protegerá (y le dará un toque de moda).',
    goal: 'Encuentra el Amuleto Anticeloso en Cenizar o en la Torre de Malvarrón.',
    steps: [{
      type: 'collect', target: 'amulet_quest', count: 1, itemName: 'Amuleto Anticeloso',
      text: 'Encuentra el Amuleto Anticeloso (lo llevan los campeones de Cenizar y la Torre)',
      drop: { from: [], areas: ['w2', 'd2'], chance: 0, other: 0.05, pity: 18, champion: true },
    }],
    rewards: { xp: 800, gold: 250, text: 'Ya nadie te mira con celos... bueno, casi nadie' },
    dialogue: {
      offer: [
        am('Mi querido {hero}: si lees esto, es que el Ogro Poeta ya no recita. Mis oídos te lo agradecen y mis vecinos también.', 'heart'),
        am('Malvarrón sigue empeñado en que la cita será con él. Ha llenado Cenizar de celos con patas. Se te pegarán como lapas.'),
        am('Existe un Amuleto Anticeloso, de los antiguos. Los campeones de las ruinas y de la torre suelen cargarlo; no me preguntes por qué. Es la magia: tiene sus misterios y sus facturas.'),
        {
          who: 'amaranta', text: 'P.D.: Tu última carta me hizo reír tres días. Sigo sin saber si era a propósito.',
          choices: [
            { text: '(Responder) Siempre es a propósito.', add: { amarantaCharm: 1 }, reply: [am('Mentiroso. Me encanta.', 'blush')] },
            { text: '(Responder) Totalmente sin querer.', add: { amarantaHonest: 1 }, reply: [am('La honestidad también es atractiva. Un poco.', 'heart')] },
          ],
        },
        am('Encuéntralo, ponte guapo y ven pronto. Con cariño y una pizca de impaciencia, tu Amaranta.'),
      ],
      active: [],
      turnIn: [
        am('¡Lo tienes! Noto cómo el hechizo de celos se aparta de ti. Ahora ya solo falta que se aparte Malvarrón.', 'sparkle'),
      ],
    },
  },
  {
    id: 'q_gargoyle', title: 'Celos de Piedra', giver: 'amaranta', world: 2, turnIn: null, prereq: 'q_amulet', autoStart: true,
    description: 'La Gárgola Celosa vigila el camino a la Torre de Malvarrón y no soporta que otros sean felices. Hay que bajarle los humos... y las alas.',
    goal: 'Derrota a la Gárgola Celosa en las Ruinas de Cenizar.',
    steps: [{ type: 'boss', target: 'jealous_gargoyle', text: 'Derrota a la Gárgola Celosa en las Ruinas de Cenizar' }],
    rewards: { xp: 1600, gold: 400, skillPoints: 1, text: 'El camino a la torre queda libre' },
    dialogue: {
      offer: [
        am('Otra carta, {hero}. Prometo que es más corta. Mentira, no lo es.'),
        am('Una gárgola de piedra vigila el camino a la torre. Era la escultura de una pareja feliz... hasta que Malvarrón le dio sentimientos. Ahora no soporta a nadie contento.'),
        am('Te vigilará desde las alturas y te mirará mal. Mal de verdad. Si te pregunta "¿quién es esa?", la respuesta correcta es "nadie, nadie".'),
        am('Devuélvela a la inmovilidad. Y, si puedes, devuélvele también las ganas de ser estatua.'),
      ],
      active: [],
      turnIn: [
        am('Lo he sentido desde aquí: se acaba de apagar un rencor de piedra. Gracias, {hero}.', 'heart'),
        am('Pobrecita. Solo quería que alguien le dijera que también merecía un pedestal con vistas.'),
      ],
    },
  },
  {
    id: 'q_malvarron', title: 'El Mago Bigotudo', giver: 'amaranta', world: 2, turnIn: null, prereq: 'q_gargoyle', autoStart: true,
    description: 'Lord Malvarrón espera en lo alto de su torre, peinándose el bigote. Es hora de acabar con sus bromas y llegar a tu cita (con ramo, carta y dignidad parcial).',
    goal: 'Entra en la Torre de Malvarrón y derrota a Lord Malvarrón.',
    steps: [
      { type: 'enter', target: 'd2', text: 'Entra en la Torre de Malvarrón' },
      { type: 'boss', target: 'malvarron', text: 'Derrota a Lord Malvarrón, en lo más alto de la torre' },
    ],
    rewards: { xp: 3000, gold: 1000, text: 'La cita de tu vida' },
    dialogue: {
      offer: [
        am('Última carta, {hero}. Te espero en la plaza del Festival de las Dos Lunas.', 'heart'),
        am('Solo queda el mago. Lord Malvarrón vive en lo más alto de su torre y presume de bigote, de conjuros y de ser mi "mejor opción". Qué cosas.'),
        am('No hace falta que lo mates con mucha saña. Basta con que lo derrotes con muchísimo estilo. Y si puedes, sin despeinarte: yo no me despeino.'),
      ],
      active: [],
      turnIn: [],
    },
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));