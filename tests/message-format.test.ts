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
test('Instagram mentions preserve the original comment and link full handles including dots and underscores',()=>{
 const body='Essa @fenix_dos.sl0ts é boa recomendo.👍🏻';const all=flatten(messageDocument(body,'instagram'));
 assert.equal(all.find(n=>n.type==='mention')?.href,'https://www.instagram.com/fenix_dos.sl0ts/');
 assert.equal(all.filter(n=>n.type==='text'||n.type==='mention').map(n=>n.text).join(''),body);
 const mentions=flatten(messageDocument('(@_carol_) @ana... **@pedro** e _@foo_bar_.','instagram')).filter(n=>n.type==='mention');
 assert.deepEqual(mentions.map(n=>n.text),['@_carol_','@ana','@pedro','@foo_bar']);
 assert.equal(mentions.at(-1)?.href,'https://www.instagram.com/foo_bar/');
 assert.deepEqual(flatten(messageDocument('@ana,@bia;@carol!','instagram')).filter(n=>n.type==='mention').map(n=>n.text),['@ana','@bia','@carol']);
});
test('mentions follow the current network and never assume a social network in WhatsApp or Web Chat',()=>{
 assert.equal(flatten(messageDocument('@carol.suporte','facebook')).find(n=>n.type==='mention')?.href,'https://www.facebook.com/carol.suporte/');
 assert.equal(flatten(messageDocument('@carol.suporte','instagram')).find(n=>n.type==='mention')?.href,'https://www.instagram.com/carol.suporte/');
 for(const channel of ['whatsapp','webchat',undefined] as const)assert.equal(flatten(messageDocument('@carol.suporte',channel)).some(n=>n.type==='mention'),false);
});
test('emails, existing links, escaped text, code and malformed handles never become social mentions',()=>{
 const body='pessoa@empresa.com https://example.com/@carol https://example.com?x=(@carol) [@carol](https://example.com) `@carol` \\@carol\n\n```txt\n@carol\n```';
 const all=flatten(messageDocument(body,'instagram'));assert.equal(all.some(n=>n.type==='mention'),false);
 assert.equal(all.some(n=>n.href==='mailto:pessoa@empresa.com'),true);
 assert.equal(all.some(n=>n.href==='https://example.com/@carol'),true);
 for(const body of ['@','@@carol','@josé','@bad-name','@'+'a'.repeat(31),'@123456789','@direct','word@carol'])assert.equal(flatten(messageDocument(body,'instagram')).some(n=>n.type==='mention'),false,body);
 assert.equal(flatten(messageDocument('@carol_name','facebook')).some(n=>n.type==='mention'),false);
});
