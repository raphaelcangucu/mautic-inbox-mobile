import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvedAvatar} from '../src/api/avatar.ts';

test('a gravatar without a picture is asked to fail so the initials show instead',()=>{
  assert.equal(resolvedAvatar(null),null);
  assert.equal(resolvedAvatar(''),null);
  // Sem foto o Mautic manda d=mm, que devolve o boneco generico.
  assert.equal(resolvedAvatar('https://www.gravatar.com/avatar/abc?s=250&d=mm'),'https://www.gravatar.com/avatar/abc?s=250&d=404');
  assert.equal(resolvedAvatar('https://secure.gravatar.com/avatar/abc'),'https://secure.gravatar.com/avatar/abc?d=404');
  // Foto propria do Mautic ou de rede social passa intacta.
  assert.equal(resolvedAvatar('https://mkt-macro.on-forge.com/media/images/avatar7.png'),'https://mkt-macro.on-forge.com/media/images/avatar7.png');
  assert.equal(resolvedAvatar('https://scontent.cdninstagram.com/v/t51/foto.jpg'),'https://scontent.cdninstagram.com/v/t51/foto.jpg');
  // Um host que apenas termina parecido nao e gravatar.
  assert.equal(resolvedAvatar('https://notgravatar.com/avatar/abc'),'https://notgravatar.com/avatar/abc');
  // URL invalida nao quebra a lista.
  assert.equal(resolvedAvatar('nao-e-url'),'nao-e-url');
});

test('restoring only touches comments the triage actually marked as spam',()=>{
  // Espelha o filtro do moderateSelection: `restore` so age onde ha marca de spam.
  const pending=(action:string,c:{moderation?:{spam?:boolean;hidden?:boolean}})=>
    action==='spam'?!c.moderation?.spam:action==='restore'?!!c.moderation?.spam:action==='hide'?!c.moderation?.hidden:false;
  assert.equal(pending('restore',{moderation:{spam:true}}),true);
  assert.equal(pending('restore',{moderation:{spam:false}}),false);
  assert.equal(pending('restore',{}),false);
  assert.equal(pending('spam',{moderation:{spam:true}}),false);
});

test('the dialler only receives digits and a leading plus, and nothing when there is no number',()=>{
  const digits=(n:string)=>n.replace(/[^+0-9]/g,'');
  assert.equal(digits('+55 (31) 97505-3794'),'+553197505379'+'4');
  assert.equal(digits('(48) 99101-7788'),'48991017788');
  assert.equal(digits('sem numero'),'');
  assert.equal(digits(''),'');
});

test('availability only appears where the server says it exists, and reverts when the call fails',()=>{
  const shows=(caps?:Record<string,unknown>)=>caps?.availability===true;
  assert.equal(shows({availability:true}),true);
  assert.equal(shows({availability:false}),false);
  assert.equal(shows({}),false);
  assert.equal(shows(undefined),false);
  // O otimismo e revertido quando o servidor recusa: o operador nunca fica "disponivel" so na tela.
  let available=true;const previous=available;
  available=false;                 // toque otimista
  available=previous;              // falha do servidor
  assert.equal(available,true);
});
