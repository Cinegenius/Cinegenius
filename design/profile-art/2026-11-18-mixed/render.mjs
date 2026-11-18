// Original SVG studies extending the six operator-selected CineGenius styles.
// Local collage only. No catalogue, member profile or generation-worker writes.
import {writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../../../package.json', import.meta.url))('sharp');
const root=new URL('./',import.meta.url);
const p=(d,f)=>`<path d="${d}" fill="${f}"/>`;
const line=(d,f,w=3,o=1)=>`<path d="${d}" fill="none" stroke="${f}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o}"/>`;
const c=(x,y,r,f)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
const rect=(x,y,w,h,f)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const ink='#23333e',lime='#c7ed4b';
// Each entry owns distinct geometry, not a recolour of an existing portrait.
const people=[
 ['masculine','studio','Abendprofil','M137 127Q125 78 182 71Q231 64 255 108L248 145L267 165L249 177L245 208L210 231L163 209L143 177Z','M135 156Q111 123 126 84Q143 43 195 52Q252 40 265 96L258 120L219 100L196 81L164 102L151 148Z'],
 ['feminine','paper','Faltenlicht','M147 114L184 65L237 89L253 139L233 195L195 225L157 201L136 158Z','M127 238L115 120L131 76L183 44L241 66L273 124L267 243L239 222L239 128L196 80L166 124L156 228Z'],
 ['neutral','flow','Lagune','M127 129Q121 91 161 72Q202 54 234 82L251 121L241 171Q223 211 185 229Q145 210 132 177Z','M127 150Q92 102 126 70Q161 30 200 51Q239 43 259 81L256 118L230 107L207 90L177 117L147 119Z'],
 ['masculine','blocks','Terrakotta','M144 88H237L255 142L235 190L194 228L151 199L136 155Z','M125 127V67H196L217 48L264 74V119L222 112L191 95L163 123Z'],
 ['feminine','soft','Blaue Stunde','M139 131Q138 78 188 74Q238 71 251 125L243 175Q239 209 207 228Q172 236 148 202Z','M117 259Q92 211 111 173Q91 139 117 109Q111 63 159 51Q191 29 222 52Q270 47 279 96Q299 124 277 159Q293 194 266 222L255 267L230 234L237 135Q201 128 186 91L156 137L151 236Z'],
 ['neutral','facets','Jade','M134 128L159 71L214 60L259 108L243 174L201 230L156 201Z','M127 133L116 87L158 43L210 36L247 63L268 107L231 98L202 74L172 115Z'],
 ['masculine','paper','Ocker','M151 101L194 70L238 96L248 143L236 195L204 230L162 214L145 166Z','M144 142L127 107L145 76L173 60L216 62L254 91L260 130L219 107L191 94L166 131Z'],
 ['feminine','studio','Kupferlicht','M129 128Q136 77 178 72Q225 66 246 106L245 162L234 201L200 224Q160 223 140 190Z','M107 246Q84 167 113 105Q119 59 174 49Q224 30 260 78Q282 115 264 187L251 238L224 225L235 122Q190 117 175 81L144 124L144 237Z'],
 ['neutral','blocks','Kobalt','M137 107L172 73H222L253 121L248 178L205 223L160 204L139 161Z','M122 143L118 88L146 57L207 44L252 67L263 113L228 102L198 93L180 121L146 118L147 157Z'],
 ['masculine','facets','Kante','M142 112L176 59L231 74L255 127L239 183L205 220L163 200Z','M139 119L130 80L172 41L220 51L254 86L266 126L228 112L210 86L181 100L158 133Z'],
 ['feminine','flow','Koralle','M148 128Q145 90 183 77Q226 68 248 108L253 151L237 193Q218 221 193 228Q156 210 150 173Z','M127 229Q109 178 129 126Q117 93 143 72Q168 40 205 51Q246 34 266 78Q286 111 267 147L280 237L250 251L236 206L239 135Q208 135 191 97L165 139L169 223Z'],
 ['neutral','soft','Salbei','M132 125Q130 75 182 69Q239 63 256 117L247 179Q237 218 200 232Q162 220 143 187Z','M128 151Q111 136 113 108Q111 71 147 61Q179 30 218 52Q254 48 267 89L263 131L243 146L222 111L199 97L170 125L146 128L145 159Z'],
 ['masculine','soft','Morgenruhe','M151 119Q150 75 195 72Q243 71 257 113L249 170Q244 205 216 227Q179 227 157 195Z','M146 142Q128 112 145 86Q157 54 193 51Q234 42 258 79L263 112L239 102L212 83L182 100L160 133Z'],
 ['feminine','blocks','Aprikose','M144 109L176 73L217 75L247 117L248 174L219 209L184 225L151 187Z','M118 246V110L139 67L183 44L231 60L266 105V243L235 256V130L197 91L157 133L156 257Z'],
 ['neutral','paper','Naturpapier','M138 119L177 69L226 80L252 124L241 174L202 230L161 207L140 165Z','M115 173L119 96L152 50L202 43L247 75L263 126L238 152L225 112L193 86L165 131L144 144L147 188Z'],
 ['masculine','flow','Polar','M139 124Q131 79 178 70Q218 55 249 103L252 146L235 182L214 218L181 234L147 199Z','M132 148Q110 117 122 85Q144 45 180 49Q219 31 253 66Q275 88 266 122L243 114L220 89L193 103L166 121L146 118Z'],
 ['feminine','facets','Pflaume','M144 112L175 62L226 78L252 125L237 182L206 220L167 205L147 173Z','M110 240L112 117L137 62L185 34L233 54L274 104L272 230L241 250L233 133L205 83L171 118L150 150L150 263Z'],
 ['neutral','studio','Nebelblau','M147 130Q141 89 180 75Q227 61 250 105L257 147L239 194Q220 224 187 230L155 200Z','M137 158Q109 136 120 100Q112 69 151 54Q183 28 220 48Q260 50 271 87L265 122L246 140L225 105L201 96L174 122L151 137Z'],
 ['masculine','blocks','Azur','M135 108L166 70L215 63L250 102L254 151L234 197L192 232L155 208L135 162Z','M115 123V85L147 51L196 38L243 58L266 98V126L235 117L204 83L171 107L143 107L144 146Z'],
 ['feminine','paper','Rosengold','M148 126L163 80L202 64L241 92L256 138L239 186L211 221L174 218L150 181Z','M132 234L116 150L122 101L152 52L203 40L246 69L277 122L269 239L238 251L241 144L211 91L185 117L159 139L165 237Z'],
];
const palettes=[
 ['#756272','#d2ac8b','#293a49','#9f7f89'],['#c4b393','#e2cfaa','#41584d','#8e9b7e'],['#635079','#96cbb8','#353c61','#c5ef50'],['#c59172','#efc599','#235c66','#bbdb73'],
 ['#5b768f','#c1d3cf','#293b55','#a0a3bc'],['#2d7878','#c6d88d','#233d54','#e5b65d'],['#ad926c','#e6cba0','#42584e','#7e8870'],['#906e72','#e1bc9e','#2c3849','#bf9091'],
 ['#486eaf','#b9d8c2','#243d6b','#dfbf73'],['#79617f','#e0be89','#344f5c','#7dabb0'],['#764b78','#eaa58d','#35536e','#c3ec69'],['#77918a','#d3d5b7','#2d4950','#a3a6bc'],
 ['#687e8d','#cbbaa0','#344852','#96b6aa'],['#ca8a77','#f1d2a3','#315e67','#afcf85'],['#a5b09a','#e0d3ad','#3e6155','#7f9d9c'],['#465b81','#7fc2c5','#29395c','#c6ed5c'],
 ['#886b94','#d9c59c','#2c4256','#75adb0'],['#64878f','#cbd0bf','#2b4258','#9794b0'],['#3c87a2','#d1d783','#244e69','#e2aa71'],['#b98782','#e5c8a1','#4c6062','#adbd92']
];
function defs(i,P,head,body,neck,hair){return `<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="${P[1]}"/><stop offset=".55" stop-color="${P[3]}"/><stop offset="1" stop-color="${P[2]}"/></linearGradient><linearGradient id="flow" x1="0" y1="1" x2="1" y2="0"><stop stop-color="${i%2?P[1]:lime}"/><stop offset=".45" stop-color="${i%2?'#7387c7':'#58aebc'}"/><stop offset="1" stop-color="${i%2?'#bf76a4':P[0]}"/></linearGradient><radialGradient id="light" cx="${.15+(i%3)*.3}" cy=".15" r="1"><stop stop-color="#fff8dc" stop-opacity=".33"/><stop offset="1" stop-color="#fff8dc" stop-opacity="0"/></radialGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="2" seed="${23+i}"/><feColorMatrix type="saturate" values="0"/></filter><clipPath id="head">${p(head,'white')}</clipPath><clipPath id="person">${p(body,'white')}${p(neck,'white')}${p(head,'white')}${p(hair,'white')}</clipPath></defs>`;}
function avatar(i){const [presentation,mode,,head,hair]=people[i],P=palettes[i];
 if(i===17)return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 400 400"><defs><linearGradient id="dusk" x2="1" y2=".8"><stop stop-color="#d4d9c8"/><stop offset=".55" stop-color="#a0a5be"/><stop offset="1" stop-color="#678494"/></linearGradient></defs><rect width="400" height="400" fill="#526879"/><path d="M0 0H186Q123 100 150 201L77 400H0Z" fill="#82958f"/><path d="M58 400Q54 320 101 283L178 248L240 272L315 308Q350 350 348 400Z" fill="#243f51"/><path d="M175 197L216 190L246 280L213 309L164 271Z" fill="#c4ccbb"/><path d="M145 110Q164 72 207 77L244 97L249 129L267 150L246 159L242 191L213 221L179 217L146 175Z" fill="url(#dusk)"/><path d="M135 177Q95 154 109 113Q95 84 122 65Q158 38 204 50Q241 41 257 78L247 105L216 94L195 79L173 115L156 153L151 192Z" fill="#253949"/><path d="M217 130l15 2M221 184q12 1 20-5" fill="none" stroke="#354958" stroke-width="2" stroke-linecap="round"/><circle cx="226" cy="136" r="2" fill="#354958"/><path d="M163 267L214 308L185 341L129 285Z" fill="#9d9db0"/><path d="M247 281L214 308L235 327L268 295Z" fill="#9d9db0"/><path d="M98 347L118 342" stroke="#c7ed4b" stroke-width="4"/></svg>`;

 const shoulder=93+(i*13)%42,left=20+(i*11)%39,right=371-(i*7)%27,tilt=12+(i*5)%24;
 const body=`M${left} 400Q${left+10} ${310+tilt} ${shoulder} ${283+tilt/3}L164 260L197 287L229 259L${286+i%4*5} ${282+tilt}Q${right-7} 322 ${right} 400Z`;
 const neck=`M167 205L214 209L230 265L199 291L162 268Z`;
 const faces=line(`M160 ${144+i%4}q9-4 18 0m31-3q9-3 18 1`,P[2],2,0.68)+c(169,148+i%4,2,P[2])+c(219,146+i%3,1.9,P[2])+line('M197 151L191 174L198 177',P[2],1.9,.65)+line('M181 197Q196 203 211 195',P[2],2,.72);
 let b=mode==='studio'||mode==='soft'?rect(0,0,400,400,'url(#light)'):'';
 if(mode==='blocks')b+=p(i%2?'M0 245L400 106V400H0Z':'M262 0H400V400H334L262 183Z',P[3]);
 if(mode==='facets')b+=p(i%2?'M0 0H122L318 400H0Z':'M273 0H400V400L306 273L241 151Z',P[3]);
 if(mode==='paper')b+=p(`M0 ${132+i*6}L400 ${44+i*3}V400H0Z`,P[3]);
 b+=p(body,P[2])+p(neck,P[1]);
 if(mode==='flow'){
   b+=`<g clip-path="url(#person)">${rect(0,0,400,400,'url(#flow)')}`;
   for(let j=0;j<5;j++)b+=p(`M-40 ${27+j*72}Q${80+i*3} ${-31+j*62} 440 ${91+j*59}L440 ${117+j*59}Q${95+i*3} ${7+j*62} -40 ${56+j*72}Z`,j%2?'#8fb7c2':'#f4dec5');
   b+='</g>';b+=line('M173 145L190 141M218 142L232 147',P[2],2,.28);
 }else{
   b+=p(head,mode==='studio'||mode==='soft'?'url(#shade)':P[1]);
   if(mode==='blocks')b+=`<g clip-path="url(#head)">${p(`M${187+i%5*3} 72L261 119L240 187L${191+i%4*3} 188Z`,P[3])}${p('M190 187H257V239H190Z',P[0])}</g>`;
   if(mode==='paper')b+=`<g clip-path="url(#head)">${p(`M${194+i%5*3} 71L194 230L260 177L242 109Z`,P[3])}</g>`;
   if(mode==='facets')b+=`<g clip-path="url(#head)">${p('M130 115L190 91L181 227L129 177Z',P[3])}${p('M190 91L215 61L260 128L233 170Z','#d5d8ad')}${p('M190 91L233 170L181 227Z',P[0])}</g>`;
   b+=p(hair,P[2]);
   if(mode==='studio'||mode==='soft')b+=faces;
   if(mode==='blocks')b+=p('M188 139L180 171L195 174Z',P[2])+line('M208 144H226',P[2],3)+line('M178 194L200 195',P[2],2);
   if(mode==='paper')b+=p('M193 133L184 172L197 176Z',P[0])+line('M207 143L220 146',P[2],1.8,.6);
 }
 if(mode!=='flow'){
   if(i%3===0)b+=p('M164 261L196 290L178 316L145 277Z',P[3])+p('M230 260L198 289L218 313L248 277Z',P[3]);
   else if(i%3===1)b+=p('M164 262Q200 292 230 260L247 276Q199 324 146 278Z',P[3]);
   else b+=p('M165 263L185 286L159 400H113L140 281Z',P[3]);
   if([3,5,8,9,13,18].includes(i))b+=p(`M${251+i%3*8} 330h22v5h-22Z`,lime);
 }
 if(mode==='paper')b+=`<rect width="400" height="400" filter="url(#grain)" opacity=".035"/>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 400 400">${defs(i,P,head,body,neck,hair)}${rect(0,0,400,400,P[0])}${b}</svg>`;
}
const themes=['Wasser','Mond','Sonne','Erde','Himmel','Kalt','Heiß','Berge','Tal','Wald','Wüste','Polar','Küste','See','Fluss','Regen','Felsen','Wiese','Wasserfall','Wolken'];
function scenery(i,P){const [bg,light,dark,mid]=P; switch(i){
 case 0:return c(795,81,45,light)+p('M0 212Q211 121 402 204T1000 184V400H0Z',mid)+p('M0 289Q188 240 373 285Q611 359 1000 244V400H0Z',dark)+p('M560 262Q696 223 824 252L800 261Q691 243 589 276Z',light);
 case 1:return c(197,85,61,light)+c(222,61,58,bg)+p('M0 341L120 256L276 284L450 163L604 254L745 227L1000 302V400H0Z',mid)+p('M0 400L226 330L447 369L790 267L1000 332V400Z',dark);
 case 2:return c(705,119,86,light)+p('M0 266Q154 152 399 257T1000 210V400H0Z',mid)+p('M0 339Q253 243 504 339T1000 282V400H0Z',dark)+p('M564 299Q670 266 823 283L782 294Q653 281 589 308Z',light);
 case 3:return p('M0 174L241 94L412 210L600 148L1000 241V400H0Z',mid)+p('M0 305L186 228L397 282L671 200L1000 296V400H0Z',light)+p('M0 400L265 304L529 352L733 271L1000 329V400Z',dark);
 case 4:return p('M-50 167Q24 75 100 111Q167 20 231 115Q315 109 335 167Z',light)+p('M561 116Q631 46 686 97Q752 26 806 104Q897 87 957 153H561Z',mid)+p('M0 350Q317 265 600 337T1000 315V400H0Z',dark);
 case 5:return p('M0 280L114 81L231 247L415 92L575 274L792 159L1000 279V400H0Z',light)+p('M114 81L165 266L231 247L197 323L0 365Z',mid)+p('M415 92L436 280L575 274L503 364L276 331Z',dark)+p('M618 400L768 306L829 328L754 400Z',mid);
 case 6:return c(855,98,52,light)+p('M0 297Q227 87 457 222Q688 371 1000 177V400H0Z',mid)+p('M0 400Q300 237 512 293L741 400Z',light)+p('M741 400Q802 307 1000 291V400Z',dark);
 case 7:return p('M0 307L145 183L278 258L446 53L628 265L846 127L1000 285V400H0Z',mid)+p('M446 53L393 192L446 160L492 201Z',light)+p('M846 127L813 213L844 195L878 230Z',light)+p('M0 400L246 302L422 352L706 259L1000 349V400Z',dark);
 case 8:return p('M0 133L197 197L451 286L0 365Z',mid)+p('M1000 75L779 179L540 279L1000 361Z',dark)+p('M0 400L218 310L455 319L571 400Z',dark)+p('M502 273L465 311L506 344L437 400H362L459 346L428 317Z',light);
 case 9:return c(718,105,48,light)+p('M0 294Q270 226 505 292T1000 249V400H0Z',mid)+p('M108 400L123 174L59 174L140 87L213 179H152L168 400Z',dark)+p('M812 400L826 207L762 207L843 97L928 207H858L874 400Z',dark)+p('M319 400L336 219L290 219L351 128L413 219H367L383 400Z',dark)+p('M550 400Q518 325 634 280L660 281Q565 330 622 400Z',light);
 case 10:return p('M0 288Q231 148 492 252T1000 174V400H0Z',light)+p('M0 400Q188 312 478 331Q740 359 1000 261V400Z',mid)+p('M660 251L669 167L699 101L743 90L774 126L792 242Z',dark)+p('M710 228L716 165Q731 138 742 166L753 226Z',light);
 case 11:return p('M-20 105Q228 260 478 137T1020 78L1020 110Q762 56 493 178T-20 136Z',light)+p('M-20 155Q236 290 501 199T1020 141L1020 165Q773 127 514 227T-20 178Z',mid)+p('M0 326L207 265L409 321L672 254L1000 306V400H0Z',light)+p('M0 400L274 335L522 389L817 315L1000 355V400Z',dark);
 case 12:return c(700,76,36,light)+rect(0,163,1000,237,mid)+p('M0 170L99 96L202 136L263 181L149 216L0 264Z',dark)+p('M0 400Q138 269 408 257Q748 273 1000 176V400Z',light)+p('M0 400Q191 290 458 298Q760 318 1000 224L1000 245Q760 336 473 321Q207 319 57 400Z',bg);
 case 13:return p('M0 223L178 158L318 196L535 114L721 206L1000 166V400H0Z',mid)+rect(0,238,1000,162,light)+p('M0 238L188 295L324 250L533 321L717 249L1000 272V400H0Z',mid)+p('M0 400L109 304L238 320L289 400Z',dark)+p('M1000 400L872 312L791 321L737 400Z',dark)+line('M591 271H773M614 291H749M638 310H722',light,5);
 case 14:return p('M0 178L272 246L483 265L321 302L0 302Z',mid)+p('M1000 136L695 231L537 265L719 299L1000 272Z',dark)+p('M486 265Q430 293 501 312Q566 341 465 365L342 400H627L617 371Q625 340 550 318Q478 294 543 265Z',light)+p('M0 319Q243 276 422 328L274 400H0Z',dark)+p('M1000 307Q818 268 644 324L702 400H1000Z',mid);
 case 15:return p('M-40 155Q14 62 99 98Q178 22 257 104Q332 63 404 160Z',light)+p('M520 168Q555 67 651 111Q718 29 797 108Q885 70 967 167Z',mid)+p('M0 363Q217 267 471 333T1000 297V400H0Z',dark)+Array.from({length:9},(_,j)=>p(`M${96+j*99} ${205+j%2*28}l-19 37 7 4 19-37Z`,j%2?light:mid)).join('');
 case 16:return p('M0 400V177L117 96L187 123L242 271L366 211L479 258L560 400Z',dark)+p('M117 96L149 276L242 271L187 123Z',light)+p('M366 211L385 335L479 258Z',mid)+p('M1000 0H822L756 96L820 218L741 313L839 400H1000Z',mid)+p('M822 0L835 125L916 187L879 303L1000 400V0Z',light);
 case 17:return p('M0 263Q291 137 537 253T1000 238V400H0Z',mid)+p('M0 370Q223 252 424 318T1000 295V400H0Z',dark)+p('M188 400Q436 289 620 272L663 275Q411 333 295 400Z',light)+[130,303,753,875].map((x,j)=>c(x,332+j%2*33,5,light)).join('');
 case 18:return p('M0 128L241 78L413 131L488 107L734 152L1000 86V400H0Z',dark)+p('M0 256L258 213L425 269L334 400H0Z',mid)+p('M1000 272L739 224L592 270L675 400H1000Z',mid)+p('M488 107L549 115Q521 217 557 301L603 371L505 400L449 370Q486 281 468 227Z',light)+p('M472 400Q509 340 589 371L645 400Z',light);
 default:return p('M-40 191Q16 96 110 147Q174 44 260 131Q338 77 420 171Q486 155 535 223H-40Z',light)+p('M498 90Q551 33 611 75Q661 17 729 81Q815 36 869 113Q953 95 1018 158H498Z',mid)+p('M0 330Q280 245 523 326T1000 300V400H0Z',dark);
 }}
function cover(i){const P=palettes[i],mode=people[i][1];let b=scenery(i,P);const d=defs(i,P,'','','','');
 if(mode==='studio'||mode==='soft')b=rect(0,0,1000,400,'url(#shade)')+b;
 if(mode==='flow')b=rect(0,0,1000,400,'url(#flow)')+`<g opacity=".72">${b}</g>`;
 if(mode==='paper')b+=`<rect width="1000" height="400" filter="url(#grain)" opacity=".04"/>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="600" viewBox="0 0 1000 400">${d}${rect(0,0,1000,400,P[0])}${b}</svg>`;
}
const labels={masculine:'Männlich',feminine:'Weiblich',neutral:'Neutral'};
const styles={studio:'Abendlicht',paper:'Papiercollage',flow:'Farbfluss',blocks:'Farbflächen',soft:'Weiche Formen',facets:'Facetten'};
await mkdir(root,{recursive:true});const catalog=[];
for(let i=0;i<20;i++)for(const kind of ['avatar','cover']){
 const id=`${String(i+1).padStart(2,'0')}-${kind}`,source=kind==='avatar'?avatar(i):cover(i);
 await writeFile(new URL(id+'.svg',root),source);await sharp(Buffer.from(source)).png().toFile(new URL(id+'.png',root).pathname);
 catalog.push({id,kind,pair:i+1,presentation:kind==='avatar'?people[i][0]:null,style:people[i][1],name:kind==='avatar'?people[i][2]:themes[i],source:id+'.svg',input:id+'.png',previewOnly:true});
}
await writeFile(new URL('rendered-studies.json',root),JSON.stringify(catalog,null,2)+'\n');
async function sheet(indices,name,columns=4){const W=columns*352+48,rowH=432,H=126+Math.ceil(indices.length/columns)*rowH+35,tiles=[];
 const t=(v,y,n,col='#edf1ed')=>`<text x="24" y="${y}" font-family="sans-serif" font-size="${n}" fill="${col}">${v}</text>`;
 tiles.push({input:Buffer.from(`<svg width="${W}" height="112">${t('CINEGENIUS · 20 NEUE MOTIVE',29,15,lime)}${t('Etwas abstrakt. Mehr Abwechslung.',66,30)}${t('7 männliche · 7 weibliche · 6 neutrale Avatare — mit passenden Cover-Beispielen',97,15,'#a5b4bd')}</svg>`),left:0,top:0});
 for(const [slot,i]of indices.entries()){
   const id=String(i+1).padStart(2,'0'),x=24+(slot%columns)*352,y=126+Math.floor(slot/columns)*rowH;
   tiles.push({input:await sharp(new URL(id+'-avatar.png',root).pathname).resize(220,220).png().toBuffer(),left:x+54,top:y});
   const title=`${id} · ${people[i][2]}`;
   tiles.push({input:Buffer.from(`<svg width="328" height="60"><text x="164" y="25" text-anchor="middle" font-family="sans-serif" font-size="19" fill="#edf1ed">${title}</text><text x="164" y="48" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#a5b4bd">${labels[people[i][0]]} · ${styles[people[i][1]]}</text></svg>`),left:x,top:y+224});
   tiles.push({input:await sharp(new URL(id+'-cover.png',root).pathname).resize(328,131).png().toBuffer(),left:x,top:y+288});
 }
 await sharp({create:{width:W,height:H,channels:3,background:'#171d27'}}).composite(tiles).png().toFile(new URL(name,root).pathname);
}
await sheet(Array.from({length:20},(_,i)=>i),'20-avatare-und-cover.png');
await sheet(Array.from({length:10},(_,i)=>i),'details-01-bis-10.png',2);
await sheet(Array.from({length:10},(_,i)=>i+10),'details-11-bis-20.png',2);
await writeFile(new URL('README.md',root),'# 20 CineGenius-Studien – nur Vorschau\n\nMarkus bestätigt die sechs frühen Richtungen 03/04/07/12/13/16: Abendlicht, Farbflächen, Papiercollage, Weiche Formen, Facetten und Farbfluss. Die zuletzt veröffentlichten einheitlichen Silhouetten sind ihm zu langweilig; die anschließend gezeigten illustrativen Gesichter wurden abgelehnt. Diese Studien mischen die sechs bestätigten Richtungen und mehrere kräftigere Farben. Es gibt 7 männliche,7weibliche,6neutrale Präsentationen; alle sind für jeden frei wählbar und bestimmen weder Geschlecht noch Pronomen.\n\n20 neue editierbare Avatar-Kompositionen mit20verschiedenen Naturcovern. Immer zuerst Collage zeigen. Keine Datenbank-/Profiländerungen, Uploads, automatischen Generierungen oder Veröffentlichungen. Die endgültige Aufnahme verlangt aktuelle Fingerabdruck-/Ähnlichkeitsprüfung und erneute Stilprüfung; weltweite Einzigartigkeit lässt sich damit nicht beweisen.\n\nDie Gestaltung variiert Konturen, Kompositionen, Licht, Formen und Farben. Andere Arbeiten bleiben pausiert.\n');
console.log(JSON.stringify({previewOnly:true,avatars:20,covers:20,masculine:7,feminine:7,neutral:6,collage:new URL('20-avatare-und-cover.png',root).pathname}));
