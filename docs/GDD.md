# Corazones y Calabozos - Documento de Diseño (GDD)

Este documento es el contrato compartido entre los agentes que construyen el juego.

## 1. Visión
ARPG de comedia romántica y fantasía oscura. Visuales: Diablo II + Ragnarok Online (isométrico 2:1, sprites pintados a mano,
oscuridad con radio de luz alrededor del jugador). UI estilo Diablo II. Todo el texto del juego en español, guardado en
`src/data/strings.ts` y archivos de `src/data/` (preparado para i18n).

## 2. Historia
El héroe (el jugador escribe su nombre) tiene una cita con su amada, Lady Amaranta, en el Festival de las Dos Lunas. Su rival,
el vanidoso mago Lord Malvarrón, lo sabotea de forma cómica (convierte su carta de amor en monstruos, maldice su ramo...).
Final: reencuentro cómico con Amaranta (`bg_ending`, música `ending`).

### Lugares
- **Pueblo Rosaleda** (hub): Abuelo Tobías (anciano, da misiones), Gertrudis (mercader), Hermana Melisa (sanadora), Pipo (bardo que comenta tu vida amorosa).
- **Mundo 1 - Bosque de Verdeluna** (`w1`, overworld) + mazmorra **Cuevas del Suspiro** (`d1`, 3 pisos). Minijefes: Reina Espinas (overworld), Ogro Poeta (último piso de d1).
- **Mundo 2 - Ruinas de Cenizar** (`w2`, ruinas volcánicas arcanas) + **Torre de Malvarrón** (`d2`, 4 pisos). Minijefe: Gárgola Celosa (overworld). Jefe final: Lord Malvarrón (último piso de d2).
- El Mundo 2 está bloqueado hasta vencer al Ogro Poeta: `GameState.flags.w1BossBeaten` (se activa con el evento `boss:defeated` `{bossId:'ogre_poet'}`).

### Misiones (~6, `src/data/quests.ts`)
1. Recuperar las 3 páginas de la carta de amor de los goblins. 2. El ramo custodiado por la Reina Espinas. 3. Recitar poesía al Ogro Poeta (derrotarlo).
4. M2: hallar el amuleto anticelos. 5. Derrotar a la Gárgola Celosa. 6. Derrotar a Malvarrón.

## 3. Clases (estilo Diablo: 3 árboles, puntos de habilidad por nivel, niveles y requisitos, 2 slots de ratón + teclas 1-6)
Definidas en `src/data/classes.ts` y `src/data/skills.ts`.
- **Caballero Galante** (melé): Golpe Valiente, Carga Heroica, Torbellino, Escudo Radiante, Aura de Coraje, Martillo Celestial. Árboles: Combate / Auras / Cruzada.
- **Arcanista** (hechicero): Bola de Fuego, Nova de Hielo, Rayo Encadenado, Meteoro, Teletransporte, Armadura de Escarcha. Árboles: Fuego / Hielo / Arcano.
- **Trovador Arquero** (distancia): Flecha Múltiple, Flecha Explosiva, Lluvia de Flechas, Trampa de Espinas, Serenata Encantadora (los enemigos se enamoran y luchan por ti), Paso Ligero (dash). Árboles: Arco / Trampas / Seducción.

Atributos: Fuerza, Destreza, Vitalidad, Energía (+5 puntos por nivel). Orbes de vida/maná, cinturón de pociones, XP, oro.
`GameState.profile.skillSlots = [izq, der, tecla1..tecla6]` (ids de habilidad).

## 4. Botín
Rarezas: normal (blanco), mágico (azul), raro (amarillo), único (dorado), con afijos aleatorios. Ranuras: arma, mano izquierda, casco, armadura,
guantes, botas, cinturón, anillo x2, amuleto (`src/data/items.ts`). La generación de objetos es un módulo futuro.

## 5. Mundos procedurales
Cada vez que se entra a un área se regenera con una semilla nueva (`randomSeed()`), salvo los pisos de una misma mazmorra, que comparten la semilla de la partida de mazmorra.
- Overworld: ruido de valor (biomas) + dispersión de props + camino garantizado hasta la entrada de la mazmorra + waypoint (`world/OverworldGenerator.ts`).
- Mazmorra: BSP de salas + corredores de 2 casillas, muros, escaleras, sala de jefe en el último piso (`world/DungeonGenerator.ts`).
- Manadas de enemigos; 15% son campeones (azules, con afijos: Rápido, Ardiente, Enamoradizo, Gélido, Robusto). Waypoints devuelven al pueblo.

## 6. Controles
Clic = mover/atacar (mantener repite), clic derecho = habilidad derecha, 1-6 = habilidades, I inventario, C personaje, T habilidades, Q misiones,
M mapa, Espacio cierra paneles, Esc menú. Móvil futuro: la entrada está abstraída en `InputController` que emite `Intent`s (`input/intents.ts`);
un joystick virtual solo debe llamar `controller.emit(intent)`.

## 7. Arquitectura (`src/`)
```
main.ts config.ts constants.ts
core/      EventBus, SeededRNG, SaveManager, GameState, types
data/      strings, classes, skills, items, enemies, npcs, quests, areas
iso/       iso (grid<->world), pathfinding (A*)
world/     TileMap, noise, spawns, OverworldGenerator, DungeonGenerator, Town, AreaFactory, WorldRenderer, Darkness
entities/  Entity, ProcAnim, Player, Enemy, Npc
input/     intents, InputController
audio/     AudioManager
vfx/       VfxManager
assets/    manifest, placeholders
scenes/    Boot, Preload, MainMenu, CharacterCreate, Game, UI
ui/        widgets
```
### Isométrico
Rejilla continua `(gx, gy)`: la casilla `(i,j)` cubre `[i,i+1]x[j,j+1]`. `x=(gx-gy)*64`, `y=(gx+gy)*32`. Las imágenes se diseñan a 256x128 por rombo y se muestran a `ART_SCALE=0.5`
(rombo 128x64). Profundidad = `y` del mundo (suelo = -1, oscuridad = 1.000.000, VFX = 900.000). Las entidades guardan `gx,gy`; `x,y,depth` se derivan.
Props: ancla abajo-centro; huella `w x h` casillas; el ancla se coloca en el centro de la huella desplazado hacia abajo.

### Flujo de escenas
Boot -> Preload -> MainMenu -> CharacterCreate -> Game (+ UI en paralelo). `GameScene` recibe un `AreaTransition {areaId, floor?, seed?, entry?}`
(`areaId`: town, w1, w2, d1, d2; `entry`: start | stairs_up | stairs_down). `travelTo(t)` hace fundido y `scene.restart(t)`.

### EventBus (`core/EventBus.ts`, tipado)
area:entered, area:leaving, player:vitals, player:xp, player:levelup, player:gold, player:died, player:moved, enemy:spawned, enemy:damaged,
enemy:died, boss:defeated, npc:talk, quest:update, ui:togglePanel, ui:closePanels, ui:menu, skill:use, game:newGame, settings:changed.
Añadir eventos nuevos al mapa `GameEvents`.

## 8. Contrato de assets
`src/assets/manifest.ts` lista todas las claves. Si un archivo falla al cargar, `PreloadScene` crea un placeholder procedural; el audio ausente falla en silencio.

Claves de textura Phaser (clave -> archivo):
- Tiles de suelo 256x128 (rombo, esquinas transparentes): `public/assets/gen/tiles/<k>.png`, k en town_cobble, w1_grass, w1_grass_flowers, w1_dirt, w1_forest_floor, w1_water, d1_floor, w2_ash, w2_lava, w2_obsidian, d2_floor. Clave = nombre.
- Muros 256 de ancho, ~320 de alto, rombo base alineado al borde inferior: d1_wall, d2_wall, town_wall (`tiles/`).
- Props (`props/<k>.png`, ancla abajo-centro): tree_oak_1, tree_oak_2, tree_pine, bush, rock_1, rock_2, mushrooms, flowers, fence, house_1, house_2, well, market_stall, campfire, chest_closed, chest_open, barrel, crate, waypoint, dungeon_entrance, stairs_down, dead_tree, lava_rock, crystal, obsidian_spire, skull_pile, brazier, torch, ruins_pillar.
- Personajes (`characters/<k>.png`, mira abajo-derecha, ~256 px, pies abajo-centro): hero_knight, hero_mage, hero_ranger, amaranta, npc_elder, npc_merchant, npc_healer, npc_bard, goblin, heart_slime, wolf, mushroom_man, thorn_queen, ogre_poet, imp, skeleton, fire_elemental, ash_golem, jealous_gargoyle, malvarron.
- Retratos 256x256 (`portraits/<k>.png`), clave Phaser `portrait_<k>`: hero_knight, hero_mage, hero_ranger, amaranta, elder, merchant, healer, bard, malvarron.
- UI (`ui/<k>.png`), clave `ui_<k>`: panel_stone, orb_health, orb_mana, orb_frame, button, parchment, slot.
- Iconos 64x64 (`ui/icons/`): `skill_<skillId>.png` y `item_<tipo>.png`; clave Phaser `icon_skill_<id>` / `icon_item_<tipo>`.
- Fondos 1920x1080 (`bg/title.jpg`, `charselect.jpg`, `ending.jpg`), clave `bg_title`, `bg_charselect`, `bg_ending`.
- VFX (`public/assets/vfx/<k>.png`, blanco/gris para tintar, aditivo), clave `vfx_<k>`: spark, flare, smoke, fire, magic_circle, star, heart, light, trace, slash, scorch, twirl.
- Música `public/assets/audio/music/<k>.ogg|.mp3` (clave `music_<k>`): title, town, world1, dungeon1, world2, dungeon2, boss, ending.
- SFX `public/assets/audio/sfx/<k>.ogg|.mp3` (clave `sfx_<k>`): ver `SFX_KEYS` en el manifest. `AudioManager.sfx('<k>')` y `playMusic('<k>')` usan el nombre corto.

## 9. Pendiente para otros agentes
Combate y habilidades reales (hay un melé provisional en `GameScene.updateAttack`), IA de ataque enemiga, generación de botín, paneles de UI,
sistema de misiones y diálogos, tienda, jefes con mecánicas, final, minimapa, joystick móvil.