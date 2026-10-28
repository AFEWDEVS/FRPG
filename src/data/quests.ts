import type { AreaId } from '../core/types';

/** One line of a conversation. `who` is a speaker id ('elder', 'bard', 'amaranta', 'hero', 'malvarron'...). {hero} = player name. */
export interface Line { who: string; text: string; }

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

export const QUESTS: QuestDef[] = [
  {
    id: 'q_letter', title: 'Cartas Perdidas', giver: 'elder', world: 1, turnIn: 'elder',
    description: 'Lord Malvarrón convirtió tu carta de amor en una plaga de goblins. Cada goblin guarda una página. Qué falta de respeto por la caligrafía.',
    goal: 'Recupera las 3 páginas de tu carta de amor.',
    steps: [{
      type: 'collect', target: 'letter_page', count: 3, itemName: 'Página de la carta',
      text: 'Recupera las páginas de la carta de manos de los goblins',
      drop: { from: ['goblin'], areas: ['w1', 'd1'], chance: 0.35, other: 0.07, pity: 5, champion: true },
    }],
    rewards: { xp: 150, gold: 60, text: 'Una carta revisada y una bolsa de monedas' },
    dialogue: {
      offer: [
        { who: 'elder', text: '¡{hero}! Por fin. Llevo toda la mañana intentando no contarte lo que ha pasado.' },
        { who: 'hero', text: 'Eso solo puede significar que ha pasado algo. ¿Dónde está mi carta de amor para Lady Amaranta?' },
        { who: 'elder', text: 'Verás... Lord Malvarrón pasó por aquí, la leyó en voz alta, se rio de tu ortografía y, con un chasquido, la convirtió en goblins.' },
        { who: 'hero', text: '¿En goblins? ¿La carta entera?' },
        { who: 'elder', text: 'Tres páginas, tres goblins ladrones de cartas, ahora mismo escondidos en el Bosque de Verdeluna. Los campeones azules suelen llevar página de sobra.' },
        { who: 'elder', text: 'Tráeme esas páginas y yo mismo las coso con hilo de abuelo. Y tranquilo: las faltas de ortografía las corregimos de paso.' },
      ],
      active: [
        { who: 'elder', text: 'Tres páginas, {hero}. Tres. Si traes cuatro, sospecharé que has escrito una carta nueva... y peor.' },
        { who: 'elder', text: 'Los goblins rondan el Bosque de Verdeluna y las Cuevas del Suspiro. Cuidado con los azules: roban con más estilo.' },
      ],
      turnIn: [
        { who: 'elder', text: '¡Las tres páginas! Y apenas están babeadas. Déjame ver... "Mi adorada Amaranta, tus ojos son como dos... lunas"...' },
        { who: 'hero', text: '¡No leas en voz alta!' },
        { who: 'elder', text: 'Perdón, perdón. Es que tienes talento, muchacho: de lo más cursi que he oído en cuarenta años.' },
        { who: 'elder', text: 'Con eso ya tienes la carta. Pero un enamorado sin ramo es un enamorado sin cita. Y adivina quién ha secuestrado las flores.' },
      ],
    },
  },
  {
    id: 'q_bouquet', title: 'Ramo Maldito', giver: 'elder', world: 1, turnIn: 'elder', prereq: 'q_letter',
    description: 'La Reina Espinas, hechizada por Malvarrón, custodia el ramo de rosas de la cita en lo más profundo del Bosque de Verdeluna.',
    goal: 'Derrota a la Reina Espinas y recupera el ramo de rosas.',
    steps: [{ type: 'boss', target: 'thorn_queen', text: 'Derrota a la Reina Espinas en el Bosque de Verdeluna', itemName: 'Ramo de rosas' }],
    rewards: { xp: 450, gold: 150, skillPoints: 1, text: 'Un ramo (algo chamuscado) y un punto de habilidad' },
    dialogue: {
      offer: [
        { who: 'elder', text: 'Hablando de flores: tu ramo de rosas rojas, el que encargaste a la floristería, tampoco ha tenido un buen día.' },
        { who: 'hero', text: '¿Qué le ha pasado a mi ramo?' },
        { who: 'elder', text: 'Malvarrón lo maldijo. Las rosas cobraron vida, eligieron reina y ahora la Reina Espinas gobierna un rincón del bosque. Dicen que es muy estricta con los pétalos.' },
        { who: 'hero', text: 'Un ramo con complejo de monarca. Perfecto.' },
        { who: 'elder', text: 'Tráeme ese ramo de vuelta. Y si puedes, sin espinas. Con pocas espinas. Con las espinas justas para sobrevivir.' },
      ],
      active: [
        { who: 'elder', text: 'La Reina Espinas está en el Bosque de Verdeluna, lejos del camino. Si ves rosas que te miran con desdén, vas bien.' },
      ],
      turnIn: [
        { who: 'elder', text: '¡Vaya! ¡El ramo! Está un poco chamuscado y le faltan pétalos, pero eso le da carácter.' },
        { who: 'hero', text: 'Se ve... romántico, a su manera.' },
        { who: 'elder', text: 'Ahora que tienes carta y ramo solo te falta cruzar hasta Cenizar. Y para eso hay que pasar por las Cuevas del Suspiro, donde un ogro con alma de poeta bloquea la salida.' },
      ],
    },
  },
  {
    id: 'q_poet', title: 'Rima o Muere', giver: 'elder', world: 1, turnIn: 'elder', prereq: 'q_bouquet',
    description: 'El Ogro Poeta guarda el fondo de las Cuevas del Suspiro y exige versos... o la vida del visitante. Derrotarlo abrirá el portal al Mundo 2.',
    goal: 'Derrota al Ogro Poeta en lo más profundo de las Cuevas del Suspiro.',
    steps: [
      { type: 'talk', target: 'bard', text: 'Pídele consejo poético a Pipo, el bardo' },
      { type: 'boss', target: 'ogre_poet', text: 'Derrota al Ogro Poeta en el último nivel de las Cuevas del Suspiro' },
    ],
    rewards: { xp: 1000, gold: 300, skillPoints: 1, text: 'El portal al Mundo 2 queda desbloqueado' },
    dialogue: {
      offer: [
        { who: 'elder', text: 'Ahora, lo difícil. Para llegar a Cenizar hay que cruzar las Cuevas del Suspiro hasta el fondo. Allí vive el Ogro Poeta.' },
        { who: 'hero', text: '¿Poeta? ¿Y qué tiene de peligroso un poeta?' },
        { who: 'elder', text: 'Obliga a todo visitante a escuchar sus versos. Si no se los aplaudes, te aplasta. Si se los aplaudes, te recita más. Nadie ha salido ileso, y mucho menos con los oídos intactos.' },
        { who: 'elder', text: 'Antes de bajar, habla con Pipo: dice que sabe de rimas. Lo que no sabe es de combate, pero eso ya lo pones tú.' },
      ],
      active: [
        { who: 'elder', text: 'Las Cuevas del Suspiro, hasta el último nivel. Sigue las escaleras hacia abajo y guíate por el sonido de alguien rimando "dolor" con "amor"... con "sudor".' },
      ],
      turnIn: [
        { who: 'elder', text: 'Se oyó un rugido de aplausos en el valle y luego un silencio muy bonito. ¿Lo has hecho, {hero}?' },
        { who: 'hero', text: 'El Ogro Poeta ha dejado de rimar. Para siempre.' },
        { who: 'elder', text: 'El portal al Mundo 2 ya no está sellado. Allí, en las Ruinas de Cenizar, empieza la torre de Malvarrón. Ve con cuidado, y con una muda por si acaso.' },
      ],
    },
  },
  {
    id: 'q_amulet', title: 'Amuleto Anticeloso', giver: 'amaranta', world: 2, turnIn: null, prereq: 'q_poet', autoStart: true,
    description: 'Amaranta te avisa por carta mágica: Malvarrón ha llenado las Ruinas de Cenizar de celos ambulantes. Solo un amuleto anticeloso te protegerá.',
    goal: 'Encuentra el Amuleto Anticeloso en Cenizar o en la Torre de Malvarrón.',
    steps: [{
      type: 'collect', target: 'amulet_quest', count: 1, itemName: 'Amuleto Anticeloso',
      text: 'Encuentra el Amuleto Anticeloso (lo llevan los campeones de Cenizar y la Torre)',
      drop: { from: [], areas: ['w2', 'd2'], chance: 0, other: 0.05, pity: 18, champion: true },
    }],
    rewards: { xp: 800, gold: 250, text: 'Ya nadie te mira con celos... bueno, casi nadie' },
    dialogue: {
      offer: [
        { who: 'amaranta', text: 'Mi querido {hero}: si lees esto, es que el Ogro Poeta ya no recita. Mis oídos te lo agradecen.' },
        { who: 'amaranta', text: 'Malvarrón sigue empeñado en que la cita será con él. Ha llenado Cenizar de celos con patas. Se te pegarán como lapas.' },
        { who: 'amaranta', text: 'Existe un Amuleto Anticeloso, de los antiguos. Los campeones de las ruinas y de la torre suelen cargarlo, no me preguntes por qué.' },
        { who: 'amaranta', text: 'Encuéntralo, ponte guapo y ven pronto. Con cariño y una pizca de impaciencia, tu Amaranta.' },
      ],
      active: [],
      turnIn: [
        { who: 'amaranta', text: '¡Lo tienes! Noto cómo el hechizo de celos se aparta de ti. Ahora ya solo falta que se aparte Malvarrón.' },
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
        { who: 'amaranta', text: 'Otra carta, {hero}. Prometo que es más corta.' },
        { who: 'amaranta', text: 'Una gárgola de piedra vigila el camino a la torre. Era una escultura de una pareja feliz... hasta que Malvarrón le dio sentimientos. Ahora no soporta a nadie contento.' },
        { who: 'amaranta', text: 'Te vigilará desde las alturas y te mirará mal. Mal de verdad. Devuélvela a la inmovilidad.' },
      ],
      active: [],
      turnIn: [
        { who: 'amaranta', text: 'Lo he sentido desde aquí: se acaba de apagar un rencor de piedra. Gracias, {hero}.' },
      ],
    },
  },
  {
    id: 'q_malvarron', title: 'El Mago Bigotudo', giver: 'amaranta', world: 2, turnIn: null, prereq: 'q_gargoyle', autoStart: true,
    description: 'Lord Malvarrón espera en lo alto de su torre, peinándose el bigote. Es hora de acabar con sus bromas y llegar a tu cita.',
    goal: 'Entra en la Torre de Malvarrón y derrota a Lord Malvarrón.',
    steps: [
      { type: 'enter', target: 'd2', text: 'Entra en la Torre de Malvarrón' },
      { type: 'boss', target: 'malvarron', text: 'Derrota a Lord Malvarrón, en lo más alto de la torre' },
    ],
    rewards: { xp: 3000, gold: 1000, text: 'La cita de tu vida' },
    dialogue: {
      offer: [
        { who: 'amaranta', text: 'Última carta, {hero}. Te espero en la plaza del Festival de las Dos Lunas.' },
        { who: 'amaranta', text: 'Solo queda el mago. Lord Malvarrón vive en lo más alto de su torre y presume de bigote, de conjuros y de ser mi "mejor opción". Qué cosas.' },
        { who: 'amaranta', text: 'No hace falta que lo mates con mucha saña. Basta con que lo derrotes con muchísimo estilo.' },
      ],
      active: [],
      turnIn: [],
    },
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));