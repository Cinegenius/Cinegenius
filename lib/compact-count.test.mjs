import test from 'node:test';
import assert from 'node:assert/strict';
import {compactCount} from './compact-count.ts';
for(const [count,expected] of [[0,'0'],[9,'9'],[157,'157'],[999,'999'],[1000,'1k'],[1100,'1.1k'],[9949,'9.9k'],[999949,'999.9k'],[999950,'1M'],[1e6,'1M'],[1.1e6,'1.1M'],[999950000,'1B'],[1e12,'1T']])test(`compact ${count}`,()=>assert.equal(compactCount(count,'en'),expected));
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(`${locale}: localized decimal and stable unit`,()=>assert.equal(compactCount(1100,locale),new Intl.NumberFormat(locale).format(1.1)+'k'));
test('unknown or invalid counts do not present a misleading zero',()=>{for(const invalid of [NaN,Infinity,-1])assert.equal(compactCount(invalid,'de'),'—');});
