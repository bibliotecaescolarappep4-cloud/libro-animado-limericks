// El orden debe coincidir exactamente con el usado al compilar assets/targets.mind.
// Para sumar páginas, copiá cada JPG/MP4 con el mismo nombre en limericksarg
// y agregá aquí el nombre base en el mismo orden de compilación.
export const targetNames = [
  'argentina', 'burro', 'el_gato', 'el_jardin', 'el_pato', 'el_payaso',
  'el_raton', 'el_soldado', 'la_carrera', 'la_doctora', 'la_hormiga',
  'la_luna', 'oruga', 'oso', 'princesa', 'ratoncito', 'simon', 'tres',
  'un_gato', 'un_loro', 'una_ballena', 'una_rana', 'una_vaca', 'yo',
  'zapallo'
];

export const displayName = name => name.replaceAll('_', ' ');
