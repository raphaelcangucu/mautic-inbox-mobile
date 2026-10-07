import {useEffect,useRef} from 'react';
import {AppState,Platform} from 'react-native';
import {Accelerometer} from 'expo-sensors';
import {ShakeDetector} from './shake-detector';

/** Mounted only on Connections. No sensor collection while backgrounded or on another screen. */
export function useConnectionShake(onShake:()=>void){
 const callback=useRef(onShake);callback.current=onShake;
 useEffect(()=>{
  if(Platform.OS==='web')return;
  let alive=true;let pending=false;let subscription:ReturnType<typeof Accelerometer.addListener>|undefined;
  const stop=()=>{subscription?.remove();subscription=undefined};
  const start=async()=>{
   if(!alive||pending||subscription||AppState.currentState!=='active')return;
   pending=true;
   try{
    if(!await Accelerometer.isAvailableAsync()||!alive||AppState.currentState!=='active')return;
    const detector=new ShakeDetector();Accelerometer.setUpdateInterval(100);
    subscription=Accelerometer.addListener(value=>{if(AppState.currentState==='active'&&detector.sample(value,Date.now()))callback.current()});
   }catch{/* Sensor unavailable: never enable demo automatically. */}finally{pending=false}
  };
  void start();const app=AppState.addEventListener('change',state=>{if(state==='active')void start();else stop()});
  return()=>{alive=false;stop();app.remove()};
 },[]);
}
