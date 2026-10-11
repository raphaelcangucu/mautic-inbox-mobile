import test from 'node:test';import assert from 'node:assert/strict';
import {contactProfiles,instagramProfile,profileURL,whatsappProfile,openSocialProfile} from '../src/api/social-profiles.ts';
import {conversationFromApi} from '../src/api/http.ts';
test('public profiles exclude post links, redirects, scoped numeric IDs and unsafe URLs',()=>{
 for(const value of ['http://instagram.com/person','https://instagram.com.evil.test/person','https://user:secret@instagram.com/person','https://instagram.com:444/person','https://instagram.com/p/post','https://instagram.com/reels/','https://instagram.com/12345','https://facebook.com/person','javascript:alert(1)'])assert.equal(profileURL('instagram',value),null,value);
 for(const value of ['https://facebook.com/123456789','https://facebook.com/l.php?u=x','https://facebook.com/reel/123','https://facebook.com/groups/group','https://facebook.com/profile.php?id=unsafe','https://m.me/123456789'])assert.equal(profileURL('facebook',value),null,value);
 assert.equal(profileURL('facebook','https://m.facebook.com/profile.php?id=123456789&tracking=unused'),'https://www.facebook.com/profile.php?id=123456789');
 assert.equal(profileURL('facebook','https://www.facebook.com/people/Real-Person/123456789/'),'https://www.facebook.com/people/Real-Person/123456789/');
 assert.equal(instagramProfile('@carol.suporte'),'https://www.instagram.com/carol.suporte/');
 assert.equal(instagramProfile('Carol Suporte'),null);
});
test('WhatsApp targets the participant number and never carries an unsolicited text',()=>{
 assert.equal(whatsappProfile('+55 (31) 97554-9190'),'https://wa.me/5531975549190');
 assert.equal(whatsappProfile('31975549190'),null);
 assert.equal(whatsappProfile('5531975549190',true),'https://wa.me/5531975549190');
 assert.equal(whatsappProfile('comment:5531975549190',true),null);
 assert.equal(profileURL('whatsapp','https://wa.me/5531975549190?text=do-not-send'),'https://wa.me/5531975549190');
 const c=conversationFromApi({id:1,channel:'whatsapp',recipient:'5531984326486',asset:{id:5,name:'Company',phone:'+5531975549190'},contact:{id:1,phone:'+5531000000000'}});
 assert.equal(contactProfiles(c.contact,c)[0].url,'https://wa.me/5531984326486');
});
test('API identity survives partial updates and overrides a different linked CRM profile',()=>{
 const c=conversationFromApi({id:1,channel:'instagram',recipient:'123456789',contact_handle:'@real.person',contact:{id:1,social_profiles:{instagram:'https://www.instagram.com/old.contact/',facebook:'https://www.facebook.com/real.person/'}}});
 const fresh=conversationFromApi({id:1,channel:'instagram'},c);
 const profiles=contactProfiles(fresh.contact,fresh);assert.equal(profiles[0].url,'https://www.instagram.com/real.person/');assert.equal(profiles[1].channel,'facebook');
 const fb=conversationFromApi({id:2,channel:'facebook',recipient:'scoped-psid',contact_name:'Real Person'});assert.deepEqual(contactProfiles(null,fb),[]);
});
test('native opener rejects missing/invalid profiles and reports launch failures',async()=>{
 let calls=0;assert.equal(await openSocialProfile({channel:'instagram',url:'https://evil.test/person',handle:'person'},async()=>{calls++}),false);assert.equal(calls,0);
 const profile={channel:'instagram' as const,url:'https://instagram.com/person/',handle:'person'};
 assert.equal(await openSocialProfile(profile,async url=>{assert.equal(url,'https://www.instagram.com/person/');calls++}),true);
 assert.equal(await openSocialProfile(profile,async()=>{throw Error('app unavailable')}),false);
});
