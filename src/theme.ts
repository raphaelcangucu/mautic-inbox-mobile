import {useApp} from './store/app';
export const light={canvas:'#F4F7FB',paper:'#FFFFFF',raised:'#FFFFFF',ink:'#222C3D',soft:'#5C6779',faint:'#748097',blue:'#244184',tint:'#E8EEF9',line:'#E0E5ED',ok:'#16775B',okBg:'#E6F4EE',warn:'#98601E',warnBg:'#FFF0E5'};
export const dark={canvas:'#000000',paper:'#121214',raised:'#1C1C1F',ink:'#F5F5F7',soft:'#D0D1D6',faint:'#A0A3AD',blue:'#91B8FF',tint:'#17243A',line:'#333336',ok:'#8EDBB8',okBg:'#142D23',warn:'#F3C48A',warnBg:'#302419'};
export const useTheme=()=>useApp(s=>s.theme)==='dark'?dark:light;
export const font={regular:'Manrope',semibold:'Manrope600',bold:'Manrope700'};
