import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmDialog, promptDialog, dismissNativeDialog} from './native-dialog.ts';

function fixture(t) {
  const before=Object.fromEntries(['window','document','HTMLElement'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  let focused;
  class Element extends EventTarget {
    constructor(tag){super();this.tagName=tag;this.children=[];this.style={};this.attributes={};this.value='';this.isConnected=true;}
    append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
    setAttribute(key,value){this.attributes[key]=value;}
    focus(){focused=this;}
    showModal(){this.open=true;}
    close(){this.open=false;this.dispatchEvent(new Event('close'));}
    remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
  }
  globalThis.HTMLElement=Element;
  const trigger=new Element('button');
  const body=new Element('body');body.style.overflow='auto';
  globalThis.document={body,activeElement:trigger,createElement:tag=>new Element(tag)};
  const viewport=Object.assign(new EventTarget(),{offsetTop:10,height:560});
  globalThis.window=Object.assign(new EventTarget(),{innerHeight:800,visualViewport:viewport});
  t.after(()=>{dismissNativeDialog();for(const[key,descriptor]of Object.entries(before)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  function find(tag,node=body){return node.tagName===tag?node:node.children.map(child=>find(tag,child)).find(Boolean);}
  return {body,trigger,viewport,find,get focused(){return focused;},submit(){find('form').dispatchEvent(new Event('submit',{cancelable:true}));}};
}
const options={message:'Decision for own test entry',confirmLabel:'Save',cancelLabel:'Cancel',minLength:5,maxLength:500,validationMessage:'At least five characters'};
test('reason dialog keeps invalid input visible and returns only the trimmed confirmed reason',async t=>{
 const f=fixture(t);const pending=promptDialog(options);const field=f.find('textarea');
 assert.equal(document.body.style.overflow,'hidden');assert.equal(f.find('dialog').open,true);assert.equal(f.focused.textContent,'Cancel');
 assert.equal(f.find('dialog').style.maxHeight,'calc(536px - env(safe-area-inset-bottom, 0px))');
 field.value='  no ';f.submit();assert.equal(f.find('p').hidden,false);assert.equal(field.value,'  no ');assert.equal(field.attributes['aria-invalid'],'true');assert.equal(f.focused,field);
 field.value='  Reviewed personally  ';f.submit();assert.equal(await pending,'Reviewed personally');assert.equal(f.body.children.length,0);assert.equal(f.body.style.overflow,'auto');assert.equal(f.focused,f.trigger);
});
test('Back, Escape and explicit page/session cleanup cancel without retaining private dialog content',async t=>{
 const f=fixture(t);
 let pending=confirmDialog(options);window.dispatchEvent(new Event('popstate'));assert.equal(await pending,false);assert.equal(f.body.children.length,0);
 pending=promptDialog(options);const dialog=f.find('dialog');const cancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);assert.equal(cancel.defaultPrevented,true);assert.equal(await pending,null);
 pending=promptDialog(options);f.find('textarea').value='Unsaved private reason';dismissNativeDialog();assert.equal(await pending,null);assert.equal(f.body.children.length,0);assert.equal(f.body.style.overflow,'auto');
});
test('a replacement dialog cancels the former request and follows the visible keyboard viewport',async t=>{
 const f=fixture(t);const first=promptDialog(options);const second=confirmDialog(options);assert.equal(await first,null);assert.equal(f.body.children.length,1);
 f.viewport.height=300;f.viewport.offsetTop=35;f.viewport.dispatchEvent(new Event('resize'));assert.equal(f.find('dialog').style.maxHeight,'calc(276px - env(safe-area-inset-bottom, 0px))');assert.equal(f.find('dialog').style.top,'max(47px, env(safe-area-inset-top, 0px))');
 f.submit();assert.equal(await second,true);assert.equal(f.body.style.overflow,'auto');
});
