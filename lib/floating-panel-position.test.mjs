import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {floatingPanelPosition} from './floating-panel-position.ts';
const anchor=(left,top,width=44,height=44)=>({left,top,width,right:left+width,bottom:top+height});
test('profile menu is aligned to its trigger and uses the space below when available',()=>{
 const p=floatingPanelPosition(anchor(600,180),{left:0,top:0,width:1366,height:900},208,240);
 assert.deepEqual(p,{left:436,top:232,width:208,maxHeight:656,placement:'bottom'});
});
test('phone edges, tablet, desktop and keyboard viewport never force a menu outside the usable area',()=>{
 for(const viewport of [
  {left:0,top:0,width:320,height:568,bottomInset:88},
  {left:0,top:0,width:390,height:844,bottomInset:88},
  {left:0,top:0,width:768,height:1024,bottomInset:88},
  {left:0,top:0,width:1366,height:768,bottomInset:12},
  {left:20,top:160,width:320,height:320,bottomInset:88},
 ])for(const align of ['left','right'])for(const bounds of [anchor(0,220),anchor(viewport.width-35,viewport.top+viewport.height-110)]){
  const p=floatingPanelPosition(bounds,viewport,500,1200,align);
  assert.ok(p.left>=viewport.left+12);
  assert.ok(p.left+p.width<=viewport.left+viewport.width-12);
  assert.ok(p.top>=viewport.top+12);
  assert.ok(p.top+p.maxHeight<=viewport.top+viewport.height-viewport.bottomInset);
 }
});
test('short landscape view flips above rather than cutting options off or forcing a tall panel',()=>{
 const p=floatingPanelPosition(anchor(280,250),{left:0,top:0,width:568,height:320,bottomInset:88},208,400);
 assert.equal(p.placement,'top');assert.equal(p.top,12);assert.equal(p.maxHeight,220);
});
test('affected menus share the body portal, outside click and Escape handling instead of trapped z-index panels',()=>{
 const panel=readFileSync(new URL('../components/FloatingPanel.tsx',import.meta.url),'utf8');
 assert.match(panel,/createPortal/);assert.match(panel,/document\.body/);assert.match(panel,/pointerdown/);assert.match(panel,/Escape/);assert.match(panel,/visualViewport/);assert.match(panel,/overflow-y-auto/);
 for(const file of ['../app/profile/[slug]/ProfileView.tsx','../app/companies/[slug]/CompanyDetail.tsx','../components/RoleDropdown.tsx','../components/ReportButton.tsx'])assert.match(readFileSync(new URL(file,import.meta.url),'utf8'),/<FloatingPanel anchorRef=/);
});
