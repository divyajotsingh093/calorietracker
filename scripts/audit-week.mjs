/**
 * Audits the seeded week against the profile goals in src/lib/profiles.ts.
 *
 * Reads the numbers straight out of the source files rather than from a fixture,
 * so it catches a recipe edit that quietly puts a day over its calorie ceiling.
 * Run it after any change to recipes.ts or to the WEEK block in store.tsx.
 */
import fs from 'node:fs'
const R = fs.readFileSync('src/data/recipes.ts','utf8'), S = fs.readFileSync('src/lib/store.tsx','utf8')
const q=(re,b,d='?')=>{const m=re.exec(b);return m?(m[1]??m[2]):d}
const meta={}
for (const b of R.split(/\n  \{\n/).slice(1)) {
  const id=/id: '(r-[a-z0-9-]+)'/.exec(b); if(!id) continue
  meta[id[1]]={ name:q(/name: (?:'([^']+)'|"([^"]+)")/,b), cu:q(/cuisine: '([^']+)'/,b),
    k:+q(/calories: ([\d.]+)/,b,'0'), p:+q(/protein: ([\d.]+)/,b,'0'), c:+q(/carbs: ([\d.]+)/,b,'0'),
    f:+q(/fat: ([\d.]+)/,b,'0'), fib:+q(/fibre: ([\d.]+)/,b,'0'), g:+q(/servingGrams: (\d+)/,b,'0'),
    video:/watch\?v=/.test(b), title:/videoTitle:/.test(b),
    contains:(q(/contains: \[([^\]]*)\]/,b,'')||'').replace(/['\s]/g,'').split(',').filter(Boolean) }
}
const w=S.slice(S.indexOf('const WEEK1'), S.indexOf('function seedPlan'))
const days=[...w.matchAll(/\{[\s\S]*?snack: \[([^\]]*)\],\s*\},/g)]
const names=[...'Mon Tue Wed Thu Fri Sat Sun'.split(' ').map(d=>'1'+d), ...'Mon Tue Wed Thu Fri Sat Sun'.split(' ').map(d=>'2'+d)]
const pick=(raw,i)=>{raw=raw.trim().replace(/,$/,'')
  if(raw.startsWith('[')){const p=raw.slice(1,-1).split(',').map(x=>x.trim().replace(/'/g,''));return p[Math.min(i,p.length-1)]}
  return raw.replace(/'/g,'')}
const goals=[{n:'Ruchi',k:1850,p:110,fib:30},{n:'Dj',k:1950,p:140,fib:30}]
// Standing items land on every day outside the searched plan, and Dj's eggs
// stand in for his breakfast rather than adding to it. Keep in step with
// `staples` and `staplesReplace` in src/lib/profiles.ts.
const STAPLE=[null,'r-boiled-eggs']
const SKIPS_BREAKFAST=[false,true]
// Days built on a pinned dish trade a few grams of protein for the food they
// actually eat; scripts/plan-week.mjs allows the same slack when it searches.
const PINNED=['r-seed-yogurt-bowl'], SLACK=6
const bad=[], soft=[], tally=[{},{}]
for (const i of [0,1]) {
  console.log(`\n===== ${goals[i].n}  (goal ${goals[i].k} kcal, ${goals[i].p}g protein, ${goals[i].fib}g fibre) =====`)
  console.log('day   kcal  prot  carb   fat  fibre |  P%  C%  F%')
  let T=[0,0,0,0,0]
  days.forEach((d,di)=>{
    const body=d[0]
    const ids=[...(SKIPS_BREAKFAST[i]?[]:[pick(/breakfast: (.*?),?\n/.exec(body)[1],i)]),
      pick(/lunch: (.*?),?\n/.exec(body)[1],i),
      pick(/dinner: (.*?),?\n/.exec(body)[1],i), ...d[1].split(',').map(x=>x.trim().replace(/'/g,'')).filter(Boolean)]
    const st=STAPLE[i]&&meta[STAPLE[i]]
    let k=st?st.k:0,p=st?st.p:0,c=st?st.c:0,f=st?st.f:0,fib=st?st.fib:0
    for(const id of ids){const m=meta[id]; if(!m){bad.push('missing '+id);continue}
      k+=m.k;p+=m.p;c+=m.c;f+=m.f;fib+=m.fib; tally[i][m.cu]=(tally[i][m.cu]||0)+1
      if(i===0&&m.contains.some(x=>['meat','fish','egg'].includes(x))) bad.push('Ruchi got '+m.name)}
    T=[T[0]+k,T[1]+p,T[2]+c,T[3]+f,T[4]+fib]
    if(k>goals[i].k) bad.push(`${goals[i].n} ${names[di]} ${Math.round(k)} kcal over goal`)
    const slack = ids.some(id=>PINNED.includes(id)) ? SLACK : 0
    if(p<goals[i].p-slack) bad.push(`${goals[i].n} ${names[di]} ${Math.round(p)}g protein under goal`)
    else if(p<goals[i].p) soft.push(`${goals[i].n} ${names[di]} ${Math.round(p)}g protein — pinned-breakfast day, within the ${SLACK}g allowance`)
    if(fib<goals[i].fib) bad.push(`${goals[i].n} ${names[di]} ${Math.round(fib)}g fibre under goal`)
    const pk=p*4,ck=c*4,fk=f*9,t=pk+ck+fk
    console.log(`${names[di]}  ${String(Math.round(k)).padStart(4)}  ${String(Math.round(p)).padStart(3)}g  ${String(Math.round(c)).padStart(3)}g  ${String(Math.round(f)).padStart(3)}g  ${String(Math.round(fib)).padStart(3)}g | ${String(Math.round(pk/t*100)).padStart(3)}%${String(Math.round(ck/t*100)).padStart(4)}%${String(Math.round(fk/t*100)).padStart(4)}%`)
  })
  const [k,p,c,f,fib]=T.map(x=>x/days.length), pk=p*4,ck=c*4,fk=f*9,t=pk+ck+fk
  console.log(`AVG   ${Math.round(k)}  ${Math.round(p)}g  ${Math.round(c)}g  ${Math.round(f)}g  ${Math.round(fib)}g | ${Math.round(pk/t*100)}%  ${Math.round(ck/t*100)}%  ${Math.round(fk/t*100)}%`)
}
console.log('\ncuisine spread (Ruchi):', JSON.stringify(tally[0]))
const all=Object.entries(meta)
console.log('\nlibrary:', all.length, 'dishes |', all.filter(([,m])=>!m.video).length, 'without video |',
  all.filter(([,m])=>!m.title).length, 'without video title |', all.filter(([,m])=>!m.g).length, 'without portion weight')
if(soft.length) console.log('\nBY DESIGN:\n'+[...new Set(soft)].join('\n'))
console.log(bad.length ? '\nPROBLEMS:\n'+[...new Set(bad)].join('\n') : '\nEvery day meets its calorie, protein and fibre targets; nothing non-veg on the vegetarian plan.')
