import test from 'node:test';
import assert from 'node:assert/strict';
import {backDirection,captureBack,completeBack} from '../src/navigation/swipe-back.ts';

test('left swipe from the right edge and standard iOS right swipe return through the same back action',()=>{
 for(const [start,dx,vx] of [[390,-110,-.8],[12,110,.8]]){
  const direction=backDirection(start,400);assert.ok(direction);assert.equal(captureBack(direction,dx,3,1),true);assert.equal(completeBack(direction,dx,3,vx,400),true);
 }
});
test('vertical scrolling, media gestures in the centre, wrong direction and multitouch cannot claim back',()=>{
 assert.equal(backDirection(200,400),null);assert.equal(backDirection(-1,400),null);assert.equal(backDirection(401,400),null);
 assert.equal(captureBack(1,10,60,1),false);assert.equal(captureBack(-1,60,0,1),false);assert.equal(captureBack(1,60,0,2),false);assert.equal(captureBack(1,12,0,1),false);
});
test('short, reversed or diagonal gestures cancel; an intentional quick flick can complete',()=>{
 assert.equal(completeBack(1,25,0,.2,400),false);assert.equal(completeBack(1,-110,0,-1,400),false);assert.equal(completeBack(-1,-100,90,-1,400),false);
 assert.equal(completeBack(-1,-50,2,-.8,400),true);assert.equal(completeBack(1,50,2,-.8,400),false);
 assert.equal(completeBack(1,70,2,.1,320),false);assert.equal(completeBack(1,125,2,.1,480),true);
});
