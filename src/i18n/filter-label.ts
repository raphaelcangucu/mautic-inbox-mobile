import type {Filter} from '../api/types';
import {t,type TranslationKey} from './engine.ts';

// Existing persisted filter identifiers remain unchanged across upgrades and language switches.
const filterKeys:Record<Filter,TranslationKey>={
  'Todas':'filter.all','Não lidas':'filter.unread','Minhas':'filter.mine',
  'Sem resposta':'filter.unanswered','Sem responsável':'filter.unassigned',
  'IA':'filter.ai','Lidas':'filter.read','Em atendimento':'filter.active',
  'Resolvidas':'filter.resolved','Adiadas':'filter.snoozed','Spam':'filter.spam',
};
export function filterLabel(filter:Filter){return t(filterKeys[filter])}
