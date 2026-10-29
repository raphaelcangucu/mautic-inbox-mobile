import {useApp} from './store/app';
// Papéis do layout aprovado em 28/10/2026 (docs/design/2026-10-novo-layout/README.md).
// Os nomes antigos continuam valendo e apontam para a cor nova, então as telas migram sem editar cada uso.
export const light={mode:'light',canvas:'#F6F8FC',paper:'#FFFFFF',raised:'#FFFFFF',ink:'#141A26',inkStrong:'#3A4354',soft:'#5E6779',faint:'#8A93A3',blue:'#1F3C88',bluePressed:'#16306E',tint:'#DCE4F7',onTint:'#16306E',tintSoft:'#E8EDF8',tintSofter:'#EEF2FA',tintFaint:'#F1F4FA',tintGhost:'#F5F8FF',chat:'#F3F5F9',field:'#F1F3F7',chip:'#EEF1F6',line:'#D5DBE6',divider:'#E6E9F0',dividerSoft:'#EEF1F6',lineBlue:'#C9D3EA',ok:'#1E7A46',okBg:'#E3F4EA',okText:'#1E6B3E',warn:'#B4590F',warnBg:'#FBEEDD',warnText:'#8A4B0F',urgent:'#C2410C',danger:'#B42318',dangerBg:'#FDECEA',highlight:'#FFF1C2',scrim:'rgba(15,20,32,0.46)'};
// O tema escuro não foi desenhado. Derivado dos mesmos papéis, com a primária clara para manter 4.5:1 na superfície escura.
export const dark={mode:'dark',canvas:'#000000',paper:'#121214',raised:'#1C1C1F',ink:'#F5F5F7',inkStrong:'#D8DAE2',soft:'#D0D1D6',faint:'#A0A3AD',blue:'#91B8FF',bluePressed:'#B6CEFF',tint:'#17243A',onTint:'#C9D9FF',tintSoft:'#141E30',tintSofter:'#121A29',tintFaint:'#101722',tintGhost:'#0E141E',chat:'#0C0C0E',field:'#1C1C1F',chip:'#1C1C1F',line:'#333336',divider:'#2A2A2D',dividerSoft:'#232326',lineBlue:'#3A4A66',ok:'#8EDBB8',okBg:'#142D23',okText:'#A8E6C8',warn:'#F3C48A',warnBg:'#302419',warnText:'#F7D7AC',urgent:'#FF8A5B',danger:'#FF9A90',dangerBg:'#331A17',highlight:'#4A3F15',scrim:'rgba(0,0,0,0.6)'};
export const useTheme=()=>useApp(s=>s.theme)==='dark'?dark:light;
// O peso 800 do desenho precisa de assets/fonts/manrope-800.ttf, que não está no repositório; até lá `heavy` cai no 700.
export const font={regular:'Manrope',semibold:'Manrope600',bold:'Manrope700',heavy:'Manrope700'};
// Cores de canal só no selo e nos ícones, iguais nos dois temas.
export const channelColor={whatsapp:'#1E8E4E',instagram:'#C1356F',facebook:'#2F6FDB',webchat:'#4A5568',email:'#B4590F'} as const;
// Fundo do avatar sem foto, como nos PNGs: um tom pálido do canal, com as iniciais na cor cheia.
export const channelTint={whatsapp:'#DDF0E4',instagram:'#FADCE8',facebook:'#DEE8FB',webchat:'#E4E7EC',email:'#FBEADF'} as const;
export const type={tabTitle:{size:30,line:36,tracking:-.5},screenTitle:{size:21,line:28},rowName:{size:16,line:22},body:{size:15,line:22},secondary:{size:13,line:18},meta:{size:11,line:14},sectionLabel:{size:13,line:18}} as const;
export const radius={chip:10,button:14,fab:16,pill:20,card:17,sheet:28,bubble:18,tail:6} as const;
