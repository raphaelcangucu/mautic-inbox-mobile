import React,{useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,PanResponder,View} from 'react-native';
import {T,Tap,Icon} from './ui';
import {useTheme} from '../theme';

export type SwipeAction={label:string;icon:string;color:string;onPress:()=>void;testID?:string};
/** Só uma linha fica aberta por vez; a que abre fecha a anterior. */
let openRow:(()=>void)|null=null;
const WIDTH=88;

/** Arrastar para o lado revela as ações da conversa sem abri-la. Gesto novo, aprovado em 28/10/2026. */
export function SwipeRow({actions,enabled=true,children}:{actions:SwipeAction[];enabled?:boolean;children:React.ReactNode}){
 const c=useTheme();const span=WIDTH*actions.length;
 const translation=useRef(new Animated.Value(0)).current;const open=useRef(false);const reduced=useRef(false);const [opened,setOpened]=useState(false);
 const latest=useRef({enabled,span});latest.current={enabled,span};
 const settle=(to:number)=>{open.current=to!==0;setOpened(to!==0);if(reduced.current)translation.setValue(to);else Animated.spring(translation,{toValue:to,useNativeDriver:true,stiffness:240,damping:28,mass:1}).start()};
 // `close` muda a cada render, então o registro guarda um invólucro estável.
 const closeRef=useRef<()=>void>(()=>{});closeRef.current=()=>{if(openRow===stable)openRow=null;settle(0)};
 const stable=useRef(()=>closeRef.current()).current;
 useEffect(()=>{let current=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(current)reduced.current=value});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{reduced.current=value});return()=>{current=false;if(openRow===stable)openRow=null;translation.stopAnimation();listener.remove()}},[]);
 const responder=useRef(PanResponder.create({
  // Só captura com intenção horizontal clara, para não roubar a rolagem vertical da lista.
  onMoveShouldSetPanResponderCapture:(_event,gesture)=>latest.current.enabled&&gesture.numberActiveTouches===1&&Math.abs(gesture.dx)>=14&&Math.abs(gesture.dx)>Math.abs(gesture.dy)*1.6,
  onPanResponderGrant:()=>{translation.stopAnimation();if(openRow&&openRow!==stable)openRow();openRow=stable},
  onPanResponderMove:(_event,gesture)=>{const base=open.current?-latest.current.span:0;translation.setValue(Math.max(-latest.current.span,Math.min(0,base+gesture.dx)))},
  onPanResponderRelease:(_event,gesture)=>{const width=latest.current.span;const at=(open.current?-width:0)+gesture.dx;const keep=gesture.vx>.5?false:at<-width/2||gesture.vx<-.5;if(keep)openRow=stable;else if(openRow===stable)openRow=null;settle(keep?-width:0)},
  onPanResponderTerminate:()=>closeRef.current(),
 })).current;
 return <View style={{backgroundColor:c.paper}}>
  <View pointerEvents={opened?'auto':'none'} importantForAccessibility={opened?'auto':'no-hide-descendants'} accessibilityElementsHidden={!opened} style={{position:'absolute',right:0,top:0,bottom:0,flexDirection:'row'}}>
   {actions.map(action=><Tap key={action.label} label={action.label} testID={action.testID} onPress={()=>{closeRef.current();action.onPress()}} style={{width:WIDTH,backgroundColor:action.color,alignItems:'center',gap:6}}><Icon name={action.icon} size={22} strokeWidth={2.1} color="#FFFFFF"/><T size={13} heavy color="#FFFFFF">{action.label}</T></Tap>)}
  </View>
  <Animated.View {...responder.panHandlers} style={{transform:[{translateX:translation}],backgroundColor:c.paper}}>{children}</Animated.View>
 </View>;
}
