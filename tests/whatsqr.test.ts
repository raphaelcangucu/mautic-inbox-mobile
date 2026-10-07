import test from 'node:test';
import assert from 'node:assert/strict';
import {pairingFromApi,qrImageCurrent,type QrPairing} from '../src/api/whatsqr.ts';
const pairing=():QrPairing=>({id:16,name:'QA QR',stage:'waiting',cause:null,can_start:false,can_regenerate:false,image_base64:'iVBORw0KGgo=',image_mime:'image/png',version:'qa-version',refresh_after:5});
test('expired or disconnected QR material is never displayed or shared',()=>{
 const value=pairing();assert.equal(qrImageCurrent(value,1000,29999),true);assert.equal(qrImageCurrent(value,1000,31000),false);assert.equal(qrImageCurrent(value,1000,999),false);
 const connected=pairingFromApi({...value,stage:'connected',can_regenerate:true,can_start:true},16);assert.equal(connected.image_base64,null);assert.equal(connected.can_regenerate,false);assert.equal(connected.can_start,false);assert.equal(qrImageCurrent(connected,1000,1001),false);
});
test('QR responses must belong to the selected asset and contain a bounded PNG',()=>{
 assert.throws(()=>pairingFromApi(pairing(),17));assert.throws(()=>pairingFromApi({...pairing(),image_base64:'https://external.example/code.png'},16));assert.throws(()=>pairingFromApi({...pairing(),image_base64:'iVBORw0KGgo'+'A'.repeat(200000)},16));
 assert.equal(pairingFromApi(pairing(),16).image_mime,'image/png');
});
