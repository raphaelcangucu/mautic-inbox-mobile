import {test} from 'node:test';
import assert from 'node:assert/strict';
import {androidKeyboardInset} from '../src/hooks/keyboard-inset-rule.ts';

test('edge to edge: the content ends on top of the keyboard and the navigation bar under it',()=>{
 assert.equal(androidKeyboardInset(300,24,0),324);
});

test('a closed keyboard leaves no space, whatever the last layout said',()=>{
 assert.equal(androidKeyboardInset(0,24,0),0);
 assert.equal(androidKeyboardInset(0,24,-40),0);
});

test('a window the system already shrank for the keyboard gets no extra space',()=>{
 assert.equal(androidKeyboardInset(300,24,324),0);
 assert.equal(androidKeyboardInset(300,24,10),324,'A small layout change is not a resize.');
});
