import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as motion from './company-logo-motion.ts';

test('only the immediate pointer click after a drag is suppressed, never keyboard activation or a later click',()=>{
  assert.equal(motion.isLogoDragClick(1,1600,1100),true);
  assert.equal(motion.isLogoDragClick(1,1600,1700),false);
  assert.equal(motion.isLogoDragClick(0,1600,1100),false);
});

test('taps and small pointer jitter never become spins; vertical and diagonal scrolling remain available',()=>{
  for(const type of ['mouse','touch','pen']) {
    assert.equal(motion.logoGestureAxis(3,2,type),'pending');
    assert.equal(motion.logoGestureAxis(5,40,type),'vertical');
    assert.equal(motion.logoGestureAxis(20,22,type),'vertical');
    assert.equal(motion.logoGestureAxis(40,10,type),'horizontal');
    assert.equal(motion.logoGestureAxis(-40,10,type),'horizontal');
  }
  assert.equal(motion.logoGestureAxis(4,0,'mouse'),'horizontal');
  assert.equal(motion.logoGestureAxis(5,0,'touch'),'pending');
  assert.equal(motion.logoGestureAxis(6,0,'touch'),'horizontal');
  assert.equal(motion.logoGestureAxis(-6,0,'touch'),'horizontal');
  assert.equal(motion.logoGestureAxis(13,11,'touch'),'vertical');
});

test('the logo follows the current finger position before release, reverses directly and scales to its displayed width',()=>{
  for(const width of [144,168,188,320]) {
    assert.equal(motion.logoDragAngle(20,width/4,width),110);
    assert.equal(motion.logoDragAngle(20,-width/4,width),-70);
    assert.equal(motion.logoDragAngle(20,width,width),380);
    assert.equal(motion.logoDragAngle(20,0,width),20);
  }
});

test('fast, slow and reversed swipes produce corresponding momentum independent of pointer event frequency',()=>{
  function velocity(totalAngle,duration,steps) {
    let speed=0;
    for(let step=0;step<steps;step++) speed=motion.logoDragVelocity(speed,totalAngle/steps,duration/steps);
    return speed;
  }
  const slow=velocity(180,900,30),medium=velocity(180,300,20),fast=velocity(180,60,6);
  assert.ok(slow<medium && medium<fast);
  assert.ok(Math.abs(velocity(180,300,10)-velocity(180,300,40))<0.00001);
  assert.ok(motion.logoDragVelocity(1,-90,60)<0);
  assert.equal(motion.logoDragVelocity(1,90,0),1);
  assert.ok(motion.logoDragVelocity(0,10000,16)<=4);
  const plans=[slow,medium,fast].map(speed=>motion.logoSpinPlan(180,speed,1));
  assert.ok(plans[2].target>plans[0].target);
  const startSpeeds=plans.map(plan=>3*(plan.target-180)/plan.duration);
  assert.ok(startSpeeds[0]<startSpeeds[1] && startSpeeds[1]<startSpeeds[2]);
});

test('flings settle frontally in the chosen direction within a bounded duration',()=>{
  for(const angle of [-1080,-720,-500,-180,-1,0,1,180,500,720,1080]) {
    for(const velocity of [-200,-1.5,-0.5,0,0.5,1.5,200]) {
      const direction=velocity<0?-1:1;
      const plan=motion.logoSpinPlan(angle,velocity,direction);
      assert.equal(Math.abs(plan.target%360),0);
      assert.ok((plan.target-angle)*direction>=0);
      assert.ok(plan.duration>=650 && plan.duration<=2400);
      assert.ok(Math.abs(plan.target-angle)<=1240);
    }
  }
  const fast=motion.logoSpinPlan(30,1.5,1),slow=motion.logoSpinPlan(30,0.2,1);
  assert.ok(fast.target>=slow.target);
  assert.ok(3*(fast.target-30)/fast.duration>3*(slow.target-30)/slow.duration);
  assert.equal(motion.logoSpinPlan(-30,0,-1).target,-360);
  assert.ok(motion.logoSpinPlan(1,-0.01,1).target>=1);
  assert.ok(motion.logoSpinPlan(-1,0.01,-1).target<=-1);
});

test('animation starts at the current angle, slows down and reaches an exact front-facing endpoint',()=>{
  assert.equal(motion.logoSpinAngle(20,720,0,2000),20);
  assert.equal(motion.logoSpinAngle(20,720,2000,2000),720);
  assert.equal(motion.logoSpinAngle(20,720,3000,2000),720);
  const a=motion.logoSpinAngle(20,720,500,2000),b=motion.logoSpinAngle(20,720,1000,2000),c=motion.logoSpinAngle(20,720,1500,2000);
  assert.ok(a-20>b-a && b-a>c-b);
});

test('touch handlers update the actual rotor during the swipe, including reversal, and only start coasting on release',()=>{
  const require=createRequire(import.meta.url),mod={exports:{}},frames=new Map();let frame=0,release;
  const source=readFileSync('components/HomeCompanyPartners.tsx','utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mocks={
    react:{...React,useRef:value=>({current:value===true?false:value}),useEffect:()=>{}},
    'next/link':{default:'a'},'next-intl':{useTranslations:()=>key=>key},
    '@/components/CompanyLogo':{default:'img'},
    '@/lib/company-logo-motion':{...motion,logoSpinPlan:(...args)=>{release=args;return motion.logoSpinPlan(...args)}},
    '@/lib/company-logo-demo':{observeCompanyLogoDemos:()=>null},
    './HomeCompanyPartners.module.css':{default:{}},
  };
  new Function('require','module','exports','requestAnimationFrame','cancelAnimationFrame',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports,callback=>{frames.set(++frame,callback);return frame;},id=>frames.delete(id));
  const tree=mod.exports.default({companies:[{id:'own',href:'/companies/own',name:'Own Film',logo:'/own.svg',city:''}]});
  function find(element){if(!element?.props)return; if(Object.hasOwn(element.props,'data-logo-coin'))return element.props;for(const child of React.Children.toArray(element.props.children)){const found=find(child);if(found)return found}}
  const handlers=find(tree),rotor={style:{}},link={},captured=new Set();
  const coin={dataset:{},isConnected:true,querySelector:()=>rotor,querySelectorAll:()=>[{complete:true,naturalWidth:180}],getBoundingClientRect:()=>({width:180}),closest:()=>link,setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
  const event=(type,x,time)=>({type,currentTarget:coin,isPrimary:true,button:0,pointerId:1,pointerType:'touch',clientX:x,clientY:50,timeStamp:time,preventDefault:()=>{}});
  handlers.onPointerDown(event('pointerdown',100,0));
  handlers.onPointerMove(event('pointermove',106,30));
  assert.equal(rotor.style.transform,'rotateY(12deg)');
  assert.equal(frames.size,0,'no release animation while the finger is down');
  // Touch starts with implicit capture on the hit-tested child. Transferring
  // capture to the logo bubbles a lostpointercapture from that former child.
  handlers.onLostPointerCapture({...event('lostpointercapture',106,31),target:{}});
  assert.equal(rotor.style.transform,'rotateY(12deg)','child capture transfer must not cancel the active touch gesture');
  handlers.onLostPointerCapture({...event('lostpointercapture',106,32),target:coin,pointerId:2});
  assert.equal(rotor.style.transform,'rotateY(12deg)','a different finger must not cancel this gesture');
  handlers.onPointerMove(event('pointermove',160,120));
  assert.equal(rotor.style.transform,'rotateY(120deg)');
  handlers.onPointerMove(event('pointermove',120,180));
  assert.equal(rotor.style.transform,'rotateY(40deg)','reversing the finger updates the logo immediately');
  handlers.onPointerUp(event('pointerup',120,190));
  assert.equal(release[0],40);
  assert.ok(release[1]<0,'release momentum follows the last movement, not the net displacement');
  assert.equal(frames.size,1);
  assert.equal(captured.size,0);
  for(const callback of frames.values())callback(performance.now()+3000);
  assert.equal(rotor.style.transform,'');
  handlers.onPointerDown(event('pointerdown',100,4000));
  handlers.onPointerMove(event('pointermove',120,4030));
  assert.equal(rotor.style.transform,'rotateY(40deg)');
  captured.delete(1);
  handlers.onLostPointerCapture({...event('lostpointercapture',120,4040),target:coin});
  assert.equal(rotor.style.transform,'','genuine loss of the active logo capture still cancels cleanly');
});

test('taking over a running demo preserves its angle; vertical scroll and taps do not rewind it',()=>{
  const require=createRequire(import.meta.url),mod={exports:{}},refs=[];let takeovers=0,paused=0;
  const source=readFileSync('components/HomeCompanyPartners.tsx','utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const controller={has:()=>true,pause:()=>paused++,takeover:()=>{takeovers++;return true}};
  const mocks={react:{...React,useRef:value=>{const ref={current:value===true?false:value};refs.push(ref);return ref},useEffect:()=>{}},'next/link':{default:'a'},'next-intl':{useTranslations:()=>key=>key},'@/components/CompanyLogo':{default:'img'},'@/lib/company-logo-motion':motion,'@/lib/company-logo-demo':{observeCompanyLogoDemos:()=>null},'./HomeCompanyPartners.module.css':{default:{}}};
  new Function('require','module','exports','requestAnimationFrame','cancelAnimationFrame',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports,()=>1,()=>{});
  const tree=mod.exports.default({companies:[{id:'own',href:'/companies/own',name:'Own Film',logo:'/own.svg',city:''}]});
  refs[3].current=controller;
  function find(element){if(!element?.props)return; if(Object.hasOwn(element.props,'data-logo-coin'))return element.props;for(const child of React.Children.toArray(element.props.children)){const found=find(child);if(found)return found}}
  const handlers=find(tree),rotor={style:{transform:'rotateY(125deg)'}},captured=new Set();
  const coin={dataset:{},querySelector:()=>rotor,querySelectorAll:()=>[{complete:true,naturalWidth:180}],getBoundingClientRect:()=>({width:180}),closest:()=>({}),setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
  const state={rotor,angle:125,frame:0,gesture:null};refs[1].current.set(coin,state);
  const event=(type,x,y,time)=>({type,currentTarget:coin,isPrimary:true,button:0,pointerId:1,pointerType:'touch',clientX:x,clientY:y,timeStamp:time,preventDefault:()=>{}});
  tree.props.onPointerDownCapture();handlers.onPointerDown(event('pointerdown',100,50,0));
  assert.equal(rotor.style.transform,'rotateY(125deg)');
  handlers.onPointerMove(event('pointermove',106,50,20));
  assert.equal(rotor.style.transform,'rotateY(137deg)');assert.equal(takeovers,1);
  handlers.onPointerUp(event('pointerup',106,50,30));
  state.angle=125;state.frame=0;rotor.style.transform='rotateY(125deg)';
  tree.props.onPointerDownCapture();handlers.onPointerDown(event('pointerdown',100,50,40));
  handlers.onPointerMove(event('pointermove',100,100,60));handlers.onPointerUp(event('pointerup',100,100,80));
  assert.equal(rotor.style.transform,'rotateY(125deg)','vertical scrolling resumes the same paused demo');
  tree.props.onPointerDownCapture();handlers.onPointerDown(event('pointerdown',100,50,100));handlers.onPointerUp(event('pointerup',100,50,120));
  assert.equal(rotor.style.transform,'rotateY(125deg)','ordinary tapping does not rewind before link navigation');
  assert.equal(paused,3);assert.equal(takeovers,1);
});

function renderPartners(companies){
  const require=createRequire(import.meta.url),mod={exports:{}};
  const source=readFileSync('components/HomeCompanyPartners.tsx','utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const mocks={
    'next/link':{default:({href,children,...props})=>React.createElement('a',{...props,href},children)},
    'next-intl':{useTranslations:()=>key=>key},
    '@/components/CompanyLogo':{default:({src,name})=>src?React.createElement('img',{src,alt:name}):React.createElement('span',null,'placeholder')},
    '@/lib/company-logo-motion':motion,
    '@/lib/company-logo-demo':{observeCompanyLogoDemos:()=>null},
    './HomeCompanyPartners.module.css':{default:{coin:'coin',rotor:'rotor',face:'face',back:'back',hint:'hint',touchHint:'touchHint',dragHint:'dragHint'}},
  };
  new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
  return renderToStaticMarkup(React.createElement(mod.exports.default,{companies}));
}

test('the same undistorted logo is on both faces while company details remain outside the rotor',()=>{
  const html=renderPartners([{id:'own',href:'/companies/own',name:'Own Film',logo:'/own-logo.svg',city:'Own city',category:'Own category'}]);
  assert.equal((html.match(/src="\/own-logo.svg"/g)??[]).length,2);
  assert.match(html,/href="\/companies\/own"/);
  assert.match(html,/class="face back" aria-hidden="true"/);
  assert.ok(html.indexOf('<h3')>html.lastIndexOf('src="/own-logo.svg"'));
  const css=readFileSync('components/HomeCompanyPartners.module.css','utf8');
  assert.match(css,/backface-visibility: hidden/);
  assert.match(css,/\.back \{ transform: rotateY\(180deg\)/);
  assert.match(css,/touch-action: pan-y pinch-zoom/);
  assert.match(css,/\.rotor\s*\{[^}]*pointer-events: none/s);
  assert.match(css,/prefers-reduced-motion: reduce/);
});

test('missing logos are static and still provide one ordinary company link',()=>{
  const html=renderPartners([{id:'own',href:'/companies/own',name:'Own Film',logo:null,city:'Own city'}]);
  assert.equal((html.match(/<a /g)??[]).length,1);
  assert.doesNotMatch(html,/data-logo-coin=|class="face back"|touchHint|dragHint/);
  assert.match(html,/placeholder/);
});

test('gesture hints exist in every supported language with no placeholders or empty values',()=>{
  for(const locale of ['de','en','es','it','cs','hu']){
    const hints=JSON.parse(readFileSync(`messages/${locale}.json`,'utf8')).homeCompanyLogos;
    assert.ok(hints.touchHint.trim());assert.ok(hints.dragHint.trim());
    assert.doesNotMatch(hints.touchHint+hints.dragHint,/[{}]/);
  }
});
