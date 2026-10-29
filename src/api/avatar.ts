/** O Mautic cai no Gravatar quando o contato tem e-mail, mesmo sem foto cadastrada
 *  (LeadBundle/Twig/Helper/AvatarHelper::getAvatar), e o Gravatar responde com um boneco
 *  generico. Pedindo `d=404` a imagem falha quando nao existe, o carregamento erra e o
 *  avatar mostra as iniciais; quem tem foto de verdade continua aparecendo. */
export function resolvedAvatar(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/^(.+\.)?gravatar\.com$/i.test(parsed.hostname)) return url;
    parsed.searchParams.set('d', '404');
    return parsed.toString();
  } catch {
    return url;
  }
}
