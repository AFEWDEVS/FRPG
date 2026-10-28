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