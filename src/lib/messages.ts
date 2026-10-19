// Messages bienveillants. Jamais de culpabilisation, de compensation ou de « brûler » un repas.

export const ENCOURAGEMENTS = [
  'Une journée à la fois. Tu avances à ton rythme.',
  'Chaque repas préparé est un cadeau pour la « toi » de demain.',
  'La régularité compte plus que la perfection.',
  'Aujourd’hui, la récupération fait partie du programme.',
  'Écoute ton corps : il te dit des choses utiles.',
  'Tu prends soin de toi, et c’est déjà beaucoup.',
  'Un imprévu n’efface rien. On continue simplement.',
  'Bien manger, bien dormir, bien récupérer : tout compte.',
  'Ton planning est là pour t’aider, pas pour te juger.',
  'Petit à petit, ça construit quelque chose de solide.'
];

export const MORNING_TITLES = ['Bonjour !', 'Belle journée à toi', 'Bonjour ☀️', 'Coucou, c’est parti'];

/** Choix déterministe (même texte pour un même jour) */
export function pickFor(seed: string, list: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

/** Liste des formulations interdites : utilisée par les tests pour vérifier tous les messages. */
export const FORBIDDEN_PATTERNS = [/échou/i, /trop mang/i, /compens/i, /brûl/i, /rattrap/i, /saute[rz]? (le|ton|un) repas/i, /culpab/i];
