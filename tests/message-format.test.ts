import test from 'node:test';
import assert from 'node:assert/strict';
import {messageDocument,messageLink,type MessageNode} from '../src/components/message-format.ts';
const flatten=(nodes:MessageNode[]):MessageNode[]=>nodes.flatMap(n=>[n,...flatten(n.children)]);
test('real assistant deposit reply renders emphasis, paragraphs and lists instead of raw markers',()=>{
 const doc=messageDocument('Para depositar, abra **Carteira**.\nDepois:\n\n- **PIX/cartão:** selecione **Depósito → Use Dinheiro/Cartão**.\n- **Cripto:** escolha a moeda.\n\nOs métodos podem variar.');
 const all=flatten(doc);assert.equal(doc.filter(n=>n.type==='paragraph').length,2);assert.equal(all.filter(n=>n.type==='list_item').length,2);assert.equal(all.filter(n=>n.type==='strong').length,4);assert.equal(all.filter(n=>n.type==='text').some(n=>n.text?.includes('**')),false);
});
test('native format handles numbered lists, code, WhatsApp emphasis and safe links',()=>{
 const all=flatten(messageDocument('3. *Olá* e _oi_\n4. `**literal**`\n\n[Site](https://example.com)\n\n```txt\n<hello>\n```'));
 assert.equal(all.find(n=>n.type==='ordered_list')?.start,3);assert.equal(all.find(n=>n.type==='em')?.markup,'*');assert.equal(all.find(n=>n.type==='code_inline')?.text,'**literal**');assert.equal(all.find(n=>n.type==='fence')?.text,'<hello>');assert.equal(all.find(n=>n.type==='link')?.href,'https://example.com/');
});
test('HTML and image payloads stay inert and URLs cannot execute application schemes',()=>{
 const all=flatten(messageDocument('<script>alert(1)</script> ![photo](https://tracker.example/x) [bad](javascript:alert(1))'));
 assert.equal(all.some(n=>n.type==='html_inline'),false);assert.equal(all.find(n=>n.type==='image')?.text,'photo');assert.equal(messageLink('javascript:alert(1)'),null);assert.equal(messageLink('file:///etc/passwd'),null);assert.equal(messageLink('https://user:pass@example.com'),null);
});
