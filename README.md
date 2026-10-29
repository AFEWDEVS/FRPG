# Corazones y Calabozos

ARPG isométrico de navegador/PC (comedia romántica de fantasía oscura). Phaser 3 + TypeScript + Vite.

## Cómo ejecutar

Requisitos: Node 22+.

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run typecheck  # comprobación de tipos (strict)
npm run build      # typecheck + build de producción en dist/
npm run preview    # sirve dist/
```

## Estado
Motor base jugable: menú -> creación de personaje -> pueblo -> portal al Bosque de Verdeluna (mundo aleatorio) ->
entrada de mazmorra -> pisos -> waypoint de vuelta al pueblo. Si faltan imágenes en `public/assets/gen/`, se generan
placeholders procedurales; si falta audio, falla en silencio.

En desarrollo, `F2` desbloquea el Mundo 2.

Documentación de diseño y contratos: [docs/GDD.md](docs/GDD.md).

## Controles de combate (combate pesado)
| Tecla / raton | Accion |
|---|---|
| Clic izq. | Mover / atacar (combo ligero de 3 golpes; el 3.o es el remate, mas fuerte) |
| Mantener clic izq. sobre enemigo (280 ms) | Cargar ataque pesado; soltar para golpear (rompe equilibrio) |
| Espacio | Voltereta de esquiva hacia el raton (i-frames 0.3 s, cuesta aguante) |
| Shift (mantener) | Bloquear; pulsarlo ~150 ms antes del golpe = parada (stagger + camara lenta) |
| Z (mantener) | Correr (gasta aguante) |
| Clic der. / 1-6 | Habilidades (cuestan mana y tienen compromiso de lanzamiento) |
| Esc | Menu / cerrar paneles |

Aguante: se gasta al esquivar, atacar, cargar, correr y bloquear; se regenera tras una pausa. A 0 = agotado (mas lento, sin esquiva).
Intents para movil: `dodge`, `heavy {phase}`, `block`, `sprint` (ver src/input/intents.ts).
