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
  assert.equal(motion.logoGestureAxis(9,0,'mouse'),'horizontal');
  assert.equal(motion.logoGestureAxis(9,0,'touch'),'pending');
  assert.equal(motion.logoGestureAxis(13,11,'touch'),'vertical');
});

test('flings settle frontally in the chosen direction within a bounded duration',()=>{
  for(const angle of [-1080,-720,-500,-180,-1,0,1,180,500,720,1080]) {
    for(const velocity of [-200,-1.5,-0.5,0,0.5,1.5,200]) {
      const direction=velocity<0?-1:1;
      const plan=motion.logoSpinPlan(angle,velocity,direction);
      assert.equal(Math.abs(plan.target%360),0);
      assert.ok((plan.target-angle)*direction>=0);
      assert.ok(plan.duration>=1100 && plan.duration<=2300);
      assert.ok(Math.abs(plan.target-angle)<=720);
    }
  }
  assert.ok(motion.logoSpinPlan(30,1.5,1).target>motion.logoSpinPlan(30,0.2,1).target);
  assert.equal(motion.logoSpinPlan(-30,0,-1).target,-360);
});

test('animation starts at the current angle, slows down and reaches an exact front-facing endpoint',()=>{
  assert.equal(motion.logoSpinAngle(20,720,0,2000),20);
  assert.equal(motion.logoSpinAngle(20,720,2000,2000),720);
  assert.equal(motion.logoSpinAngle(20,720,3000,2000),720);
  const a=motion.logoSpinAngle(20,720,500,2000),b=motion.logoSpinAngle(20,720,1000,2000),c=motion.logoSpinAngle(20,720,1500,2000);
  assert.ok(a-20>b-a && b-a>c-b);
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
