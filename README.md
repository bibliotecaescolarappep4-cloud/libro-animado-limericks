# libro-animado-limericks

Libro de limericks con realidad aumentada. MindAR reconoce las imágenes
compiladas en `assets/targets.mind` y reproduce sobre cada una el video MP4
con el mismo nombre base.

## Agregar imágenes

1. Guardar cada par `.jpg` / `.mp4` en `assets/limericksarg/` usando el mismo nombre.
2. Compilar todos los JPG juntos con MindAR y reemplazar `assets/targets.mind`.
3. Agregar los nombres base a `targets.js`, respetando exactamente el orden usado
   al compilar el archivo `.mind`.

Actualmente el orden es `familia-ballena`, `familia-japones`.
