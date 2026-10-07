import React from 'react';
import {Modal,View,StyleSheet} from 'react-native';

/** The scrim fills the native window and never moves with the sheet or keyboard. */
export function OverlayModal({visible,onClose,children}:{visible:boolean;onClose:()=>void;children:React.ReactNode}){
 return <Modal visible={visible} transparent presentationStyle="overFullScreen" animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
  <View style={{flex:1}}>
   <View pointerEvents="none" style={[StyleSheet.absoluteFillObject,{backgroundColor:'#0009'}]}/>
   {children}
  </View>
 </Modal>;
}
