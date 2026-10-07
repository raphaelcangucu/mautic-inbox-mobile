import {useEffect,useRef} from 'react';
import {AccessibilityInfo,Animated,PanResponder,Platform,View} from 'react-native';
import {backDirection,captureBack,completeBack,type BackDirection} from '../navigation/swipe-back';

/** Attach responders to the history only, while translating the whole chat. */
export function useSwipeBack(onBack:()=>void,enabled=true){
 const area=useRef<View>(null);const bounds=useRef({x:0,width:0});const latest=useRef({onBack,enabled});latest.current={onBack,enabled};
 const translation=useRef(new Animated.Value(0)).current;const direction=useRef<BackDirection|null>(null);const verticalIntent=useRef(false);const multiTouch=useRef(false);const completing=useRef(false);const alive=useRef(true);const reduced=useRef(false);
 useEffect(()=>{alive.current=true;let current=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(current)reduced.current=value});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{reduced.current=value});return()=>{current=false;alive.current=false;translation.stopAnimation();listener.remove()}},[]);
 const measure=()=>area.current?.measureInWindow((x,_y,width)=>{bounds.current={x,width}});
 const reset=()=>{direction.current=null;completing.current=false;if(reduced.current)translation.setValue(0);else Animated.spring(translation,{toValue:0,useNativeDriver:true,stiffness:240,damping:28,mass:1}).start()};
 const responder=useRef(PanResponder.create({
  onStartShouldSetPanResponderCapture:(event,gesture)=>{
   direction.current=latest.current.enabled&&Platform.OS!=='web'&&!completing.current?backDirection(event.nativeEvent.pageX-bounds.current.x,bounds.current.width):null;verticalIntent.current=false;multiTouch.current=false;return false;
  },
  onMoveShouldSetPanResponderCapture:(_event,gesture)=>{
   if(Math.abs(gesture.dy)>=12&&Math.abs(gesture.dy)>=Math.abs(gesture.dx))verticalIntent.current=true;
   return latest.current.enabled&&!completing.current&&!verticalIntent.current&&captureBack(direction.current,gesture.dx,gesture.dy,gesture.numberActiveTouches);
  },
  onPanResponderGrant:()=>translation.stopAnimation(),
  onPanResponderStart:(_event,gesture)=>{if(gesture.numberActiveTouches>1)multiTouch.current=true},
  onPanResponderMove:(_event,gesture)=>{if(gesture.numberActiveTouches>1)multiTouch.current=true;if(direction.current!==null)translation.setValue(direction.current*Math.max(0,Math.min(bounds.current.width,direction.current*gesture.dx)))},
  onPanResponderRelease:(_event,gesture)=>{
   const sign=direction.current;
   if(!latest.current.enabled||multiTouch.current||sign===null||!completeBack(sign,gesture.dx,gesture.dy,gesture.vx,bounds.current.width)){reset();return}
   completing.current=true;
   const finish=()=>{if(alive.current&&latest.current.enabled)latest.current.onBack();else reset()};
   if(reduced.current){finish();return}
   Animated.timing(translation,{toValue:sign*bounds.current.width,duration:160,useNativeDriver:true}).start(({finished})=>{if(finished)finish()});
  },
  onPanResponderTerminationRequest:()=>!completing.current,
  onPanResponderTerminate:reset,
 })).current;
 return {area,measure,panHandlers:responder.panHandlers,style:{transform:[{translateX:translation}]}};
}
