import {useEffect,useState} from 'react';
import {Keyboard} from 'react-native';
export {androidKeyboardInset} from './keyboard-inset-rule';

/**
 * Android draws edge to edge, so the window keeps its size when the keyboard opens and the content
 * has to make room itself. KeyboardAvoidingView "height" does that on show, but on Android 11+
 * keyboardDidHide reports the keyboard top in visible-frame coordinates (system bars excluded); the
 * view then keeps a gap the size of the status bar after the keyboard closes. The keyboard height
 * of the events has no such offset: show reports it above the navigation bar, hide reports 0.
 */
export function useKeyboardHeight(){
 const [height,setHeight]=useState(0);
 useEffect(()=>{const shown=Keyboard.addListener('keyboardDidShow',e=>setHeight(Math.max(1,e.endCoordinates?.height||0)));const hidden=Keyboard.addListener('keyboardDidHide',()=>setHeight(0));return()=>{shown.remove();hidden.remove()}},[]);
 return height;
}
