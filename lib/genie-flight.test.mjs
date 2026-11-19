import test from 'node:test';
import assert from 'node:assert/strict';
import {GENIE_FLIGHT_MS,launchGenieFlight,genieFlightPosition} from './genie-flight.ts';

const wide={left:-2000,right:2000,top:-2000,bottom:2000};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} differs from ${expected}`);
function bounded(point,bounds){
 assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
 assert.ok(point.x>=bounds.left&&point.x<=bounds.right);
 assert.ok(point.y>=bounds.top&&point.y<=bounds.bottom);
}
test('free glide follows analytic drag in pixels per second',()=>{
 const f=launchGenieFlight({x:100,y:300},{x:300,y:-400},5000,wide);assert.ok(f);
 assert.deepEqual(genieFlightPosition(f,5000),{x:100,y:300});
 for(const seconds of [.016,.1,.4,.9,1.3]){
  const p=genieFlightPosition(f,5000+seconds*1000),factor=(1-Math.exp(-4*seconds))/4;
  close(p.x,100+300*factor);close(p.y,300-400*factor);
 }
});
test('wall hit is continuous and reflects the remaining velocity with restitution',()=>{
 const f=launchGenieFlight({x:90,y:50},{x:100,y:0},0,{left:0,right:100,top:0,bottom:100});assert.ok(f);
 const hit=-Math.log(.6)/4;close(genieFlightPosition(f,hit*1000).x,100);
 assert.ok(genieFlightPosition(f,hit*1000-.001).x<100);
 assert.ok(genieFlightPosition(f,hit*1000+.001).x<100);
 close(genieFlightPosition(f,400).x,100-100*.6*.3*(1-Math.exp(-4*(.4-hit)))/4);
 close(genieFlightPosition(f,400).y,50);
});
test('an outward release at a corner rebounds immediately after clamping the origin',()=>{
 const bounds={left:0,right:100,top:0,bottom:100};
 const f=launchGenieFlight({x:-20,y:120},{x:-120,y:160},25,bounds);assert.ok(f);
 assert.deepEqual(f.origin,{x:0,y:100});
 const p=genieFlightPosition(f,225),factor=(1-Math.exp(-.8))/4;
 close(p.x,120*.3*factor);close(p.y,100-160*.3*factor);bounded(p,bounds);
});
test('minimum speed ignores movement in collapsed axes',()=>{
 assert.equal(launchGenieFlight({x:0,y:0},{x:64.999,y:0},0,wide),null);
 assert.ok(launchGenieFlight({x:0,y:0},{x:65,y:0},0,wide));
 const line={left:12,right:12,top:0,bottom:1000};
 assert.equal(launchGenieFlight({x:0,y:50},{x:1600,y:64},0,line),null);
 const f=launchGenieFlight({x:-20,y:50},{x:1600,y:65},0,line);assert.ok(f);
 assert.deepEqual(f.velocity,{x:0,y:65});assert.equal(genieFlightPosition(f,800).x,12);
 assert.equal(launchGenieFlight({x:1,y:2},{x:1000,y:1000},0,{left:1,right:1,top:2,bottom:2}),null);
});
test('vector cap preserves direction and bounds the longest free glide to about 398px',()=>{
 assert.equal(GENIE_FLIGHT_MS,1300);
 const f=launchGenieFlight({x:0,y:0},{x:8000,y:6000},0,wide);assert.ok(f);
 close(Math.hypot(f.velocity.x,f.velocity.y),1600);close(f.velocity.x/f.velocity.y,4/3);
 const p=genieFlightPosition(f,1300),distance=Math.hypot(p.x,p.y);
 close(distance,400*(1-Math.exp(-5.2)));assert.ok(distance>397&&distance<399);
 const huge=launchGenieFlight({x:0,y:0},{x:1e300,y:-1e300},0,wide);assert.ok(huge);
 close(Math.hypot(huge.velocity.x,huge.velocity.y),1600);bounded(genieFlightPosition(huge,1300),wide);
});
test('frame rate and sampling order do not alter the trajectory or mutate a flight',()=>{
 const f=launchGenieFlight({x:95,y:20},{x:900,y:-400},100,{left:0,right:180,top:0,bottom:130});assert.ok(f);
 const before=structuredClone(f),end=genieFlightPosition(f,1400);
 for(const step of [1000/120,1000/60,1000/24]){
  for(let at=100;at<=1400;at+=step)bounded(genieFlightPosition(f,at),f.bounds);
  assert.deepEqual(genieFlightPosition(f,1400),end);
 }
 const middle=genieFlightPosition(f,550);genieFlightPosition(f,1300);genieFlightPosition(f,101);
 assert.deepEqual(genieFlightPosition(f,550),middle);assert.deepEqual(f,before);
});
test('narrow nonzero bounds survive repeated rebounds without nonfinite or escaped coordinates',()=>{
 for(const width of [1,.01,1e-7]){
  const b={left:7,right:7+width,top:9,bottom:9+width};
  const f=launchGenieFlight({x:7+width/2,y:9+width/2},{x:1500,y:-1500},0,b);assert.ok(f);
  for(let at=0;at<=1500;at+=5)bounded(genieFlightPosition(f,at),b);
  assert.deepEqual(genieFlightPosition(f,5000),genieFlightPosition(f,1300));
 }
});
test('launch snapshots caller inputs without modifying their origin',()=>{
 const origin={x:-20,y:120},velocity={x:200,y:-100},bounds={left:0,right:100,top:0,bottom:100};
 const f=launchGenieFlight(origin,velocity,10,bounds);assert.ok(f);assert.deepEqual(origin,{x:-20,y:120});
 const before=structuredClone(f);origin.x=5000;velocity.y=999;bounds.left=-5000;bounds.right=9000;
 assert.deepEqual(f,before);assert.notEqual(f.origin,origin);assert.notEqual(f.velocity,velocity);assert.notEqual(f.bounds,bounds);
});
test('time clamps before release and after the endpoint even with extreme clocks',()=>{
 const f=launchGenieFlight({x:10,y:20},{x:200,y:-100},1000,wide);assert.ok(f);
 assert.deepEqual(genieFlightPosition(f,-1e300),f.origin);
 const end=genieFlightPosition(f,2300);
 for(const at of [2301,1e300])assert.deepEqual(genieFlightPosition(f,at),end);
 for(const at of [NaN,Infinity,-Infinity])bounded(genieFlightPosition(f,at),wide);
 const huge=launchGenieFlight({x:0,y:0},{x:200,y:0},-1e308,wide);assert.ok(huge);
 close(genieFlightPosition(huge,1e308).x,50*(1-Math.exp(-5.2)));
});
test('nonfinite input and inverted bounds reject safely',()=>{
 const origin={x:0,y:0},velocity={x:100,y:0};
 for(const bad of [NaN,Infinity,-Infinity]){
  for(const axis of ['x','y']){
   assert.equal(launchGenieFlight({...origin,[axis]:bad},velocity,0,wide),null);
   assert.equal(launchGenieFlight(origin,{...velocity,[axis]:bad},0,wide),null);
  }
  for(const side of Object.keys(wide))assert.equal(launchGenieFlight(origin,velocity,0,{...wide,[side]:bad}),null);
  assert.equal(launchGenieFlight(origin,velocity,bad,wide),null);
 }
 assert.equal(launchGenieFlight(origin,velocity,0,{...wide,left:2001}),null);
 assert.equal(launchGenieFlight(origin,velocity,0,{...wide,top:2001}),null);
 assert.equal(launchGenieFlight(origin,{x:Number.MAX_VALUE,y:Number.MAX_VALUE},0,wide),null);
 assert.deepEqual(origin,{x:0,y:0});assert.deepEqual(velocity,{x:100,y:0});
});
