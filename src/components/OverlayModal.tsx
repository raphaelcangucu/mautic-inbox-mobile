import React from 'react';
import {Modal,View,StyleSheet} from 'react-native';
import {useTheme} from '../theme';

/** The scrim fills the native window and never moves with the sheet or keyboard. */
export function OverlayModal({visible,onClose,onDismiss,children}:{visible:boolean;onClose:()=>void;onDismiss?:()=>void;children:React.ReactNode}){
 const c=useTheme();
 return <Modal visible={visible} transparent presentationStyle="overFullScreen" animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} onDismiss={onDismiss}>
  <View style={{flex:1}}>
   <View pointerEvents="none" style={[StyleSheet.absoluteFillObject,{backgroundColor:c.scrim}]}/>
   {children}
  </View>
 </Modal>;
}
