export interface QuestDef {
  id: string;
  title: string;
  giver: string;
  description: string;
  world: 1 | 2;
  goal: string;
}

export const QUESTS: QuestDef[] = [
  { id: 'q_letter', title: 'Las páginas de la carta', giver: 'elder', world: 1, goal: 'Recupera 3 páginas de la carta de manos de los goblins.', description: 'Malvarrón convirtió tu carta de amor en monstruos. Recupera sus tres páginas.' },
  { id: 'q_bouquet', title: 'El ramo maldito', giver: 'elder', world: 1, goal: 'Derrota a la Reina Espinas y recupera el ramo.', description: 'La Reina Espinas custodia tu ramo de rosas.' },
  { id: 'q_poet', title: 'Versos y mamporros', giver: 'bard', world: 1, goal: 'Derrota al Ogro Poeta en las Cuevas del Suspiro.', description: 'El Ogro Poeta exige una declamación... y tú se la darás a golpes.' },
  { id: 'q_amulet', title: 'El amuleto anticelos', giver: 'healer', world: 2, goal: 'Encuentra el amuleto en las Ruinas de Cenizar.', description: 'Un amuleto antiguo protege contra los celos mágicos.' },
  { id: 'q_gargoyle', title: 'Celos de piedra', giver: 'elder', world: 2, goal: 'Derrota a la Gárgola Celosa.', description: 'Una gárgola custodia el camino a la torre.' },
  { id: 'q_malvarron', title: 'El duelo final', giver: 'elder', world: 2, goal: 'Derrota a Lord Malvarrón en su torre.', description: 'Amaranta te espera. Solo falta un mago presumido.' },
];
