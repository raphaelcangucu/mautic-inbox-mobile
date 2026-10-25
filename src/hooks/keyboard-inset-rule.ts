/**
 * Space under the content on Android while the keyboard is open: the keyboard plus the navigation
 * bar under it. Nothing when the system shrank the window for the keyboard itself (a window that is
 * not edge to edge), since the content already ends above the keyboard then.
 */
export function androidKeyboardInset(keyboard:number,navigationBar:number,windowShrink:number){
 if(keyboard<=0||windowShrink>=keyboard/2)return 0;
 return keyboard+navigationBar;
}
