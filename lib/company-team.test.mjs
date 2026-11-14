import test from 'node:test';
import assert from 'node:assert/strict';
import {groupPublicCompanyTeam} from './company-team.ts';
import {canCompanyRole} from './company-roles.ts';
const member=(id,title,extra={})=>({id,status:'accepted',public_titles:[title],profile:{display_name:id},...extra});
test('founders and directors precede department/project leads and staff, regardless of account privileges or join time',()=>{
 const rows=[member('Support','Mitarbeiter/in · Support',{role:'admin'}),member('Co-founder','Mitgründer/in',{role:'member'}),member('Director','Geschäftsführer/in'),member('A project lead','Projektleitung'),member('A head','Abteilungsleitung'),member('Technical owner','Mitarbeiter/in',{is_company_owner:true})];
 const before=structuredClone(rows);
 const groups=groupPublicCompanyTeam(rows,'de');
 assert.deepEqual(groups.leadership.map(m=>m.id),['Co-founder','Director','A head','A project lead']);
 assert.deepEqual(groups.team.map(m=>m.id),['Support','Technical owner']);
 assert.deepEqual(rows,before);
 assert.equal(canCompanyRole(groups.leadership[0].role,'manage_team'),false);
});
test('public functions use the legacy fallback, avoid substring guesses, and never show pending/private identities',()=>{
 const groups=groupPublicCompanyTeam([member('Legacy','',{public_titles:[],title:'Mitgründer/in'}),member('Assistant','Assistenz der Geschäftsführung'),member('Unknown','Own member text'),member('Pending','Gründer/in',{status:'pending'}),member('Private','CEO',{profile:null})],'de');
 assert.deepEqual(groups.leadership.map(m=>m.id),['Legacy']);
 assert.deepEqual(groups.team.map(m=>m.id),['Assistant','Unknown']);
});
test('multiple public functions appear once in the highest applicable group; equal functions sort by name',()=>{
 const groups=groupPublicCompanyTeam([member('Zeta','CEO'),member('Alpha','Projektleitung',{public_titles:['Projektleitung','Founder']})],'en');
 assert.deepEqual(groups.leadership.map(m=>m.id),['Alpha','Zeta']);assert.deepEqual(groups.team,[]);
});
