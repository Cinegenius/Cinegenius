import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCategoryForType} from './project-category-filter.ts';
import {sortProjects} from './projects-browse.ts';
test('both creation flows produce formats found in the same category',()=>{
 for(const [category,types] of Object.entries({werbung:['Werbefilm','Werbefilm / Commercial'],corporate:['Corporate','Corporate Film','Imagefilm'],event:['Event','Event / Live'],'social-media':['Social Media','Social Media Content']}))for(const type of types)assert.equal(projectCategoryForType(type),category);
 assert.equal(projectCategoryForType('A member format'),null);
});
test('year sorting keeps unknown years last; recent sorts actual updates without changing input',()=>{
 const rows=[{id:'a',title:'A',year:2020,updated_at:'2026-11-13'},{id:'b',title:'B',year:null,updated_at:'2020-01-01'},{id:'c',title:'C',year:2025,updated_at:'2025-01-01'}];
 assert.deepEqual(sortProjects(rows,'year_desc','de').map(x=>x.id),['c','a','b']);
 assert.deepEqual(sortProjects(rows,'year_asc','de').map(x=>x.id),['a','c','b']);
 assert.deepEqual(sortProjects(rows,'recent','de').map(x=>x.id),['a','c','b']);
 assert.deepEqual(rows.map(x=>x.id),['a','b','c']);
});
