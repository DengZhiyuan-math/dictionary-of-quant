import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {root,book} from './model.mjs';
execFileSync(process.execPath,[path.join(root,'scripts/build.mjs'),'--check'],{stdio:'inherit'});
const expected=['M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M11','M12','R13','R14','R15','R16',...['E','B','T','C'].flatMap((p,j)=>Array.from({length:[26,30,25,10][j]},(_,i)=>p+String(i+1).padStart(2,'0')))];
assert.equal(book.chapters.length,128);
assert.equal(book.questions.length,107);
assert.deepEqual([...new Set(book.questions.map(q=>q.id))].sort(),expected.sort());
assert.equal(book.cases.length,25);
assert.equal(new Set(book.cases.map(q=>q.id)).size,25);
assert.equal(book.glossary.length,260);
assert.equal(book.advanced_questions.length,168);
assert.equal(new Set(book.advanced_questions.map(q=>q.id)).size,168);
assert.equal(new Set(book.glossary.map(g=>g.en.toLowerCase())).size,book.glossary.length);
for(const c of book.chapters.filter(c=>c.advanced)){
 assert.equal(c.toc.length,7,c.num+' section completeness');
 assert(c.blocks.map(b=>b.text).join('').length>=600,c.num+' concept, derivation, example and boundary');
 if(c.edition>=3)assert(c.blocks.map(b=>b.text).join('').length>=1000,c.num+' detailed mechanism and worked reasoning');
 assert.equal(book.advanced_questions.filter(q=>q.chapter===c.id+1).length,2);
}
for(const q of book.advanced_questions){
 const c=book.chapters[q.chapter-1];
 assert(c.toc.some(s=>s.title.startsWith(q.id+' ')),q.id);
 assert(q.source_ids.every(id=>book.sources.some(s=>s.id===id)));
}
for(const [domain,count] of Object.entries({stochastic:8,options:8,factor:7,backtest:7,portfolio:6,timeseries:8,mlquant:8,systems:8,microstructure:8,hft:8,statarb:8}))
 assert.equal(book.chapters.filter(c=>c.domain===domain).length,count);
for(const [i,c] of book.chapters.entries()){
 assert.equal(c.id,i);assert.equal(c.num,String(i+1).padStart(2,'0'));
 assert(c.blocks.length>0);assert(c.source_ids.every(id=>book.sources.some(s=>s.id===id)));
 assert(!/计算机科学与 AI|LeetCode|BCEWithLogitsLoss/.test(JSON.stringify(c)));
}
for(const q of [...book.questions,...book.cases]){
 const c=book.chapters[q.chapter-1];
 assert(c.toc.some(s=>s.title.startsWith(q.id+' ')),q.id+' chapter mapping');
 assert(q.question.length>15&&q.answer.length>15,q.id+' content');
 assert(!/\b[MERBCT]\d{2}\b/.test(q.question),q.id+' swallowed another question');
 if(q.page)assert(q.page>=1&&q.page<=(q.source===2?21:32));
}
for(const g of book.glossary)assert(book.chapters[g.chapter-1]&&g.definition&&g.confusion,g.en);
for(const s of book.sources)if(s.file)assert(fs.existsSync(path.join(root,'sources',s.file)),s.file);
const files=[];
function visit(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(['tmp','dist','.git','publication'].includes(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())visit(p);else if(p.endsWith('.md'))files.push(p)}}
visit(root);
let links=0;
for(const file of files){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)){
 const url=m[1];if(/^(?:https?:|mailto:)/.test(url))continue;
 const [name,anchor]=url.split('#');const target=name?path.resolve(path.dirname(file),decodeURIComponent(name)):file;
 assert(fs.existsSync(target),path.relative(root,file)+' broken link '+url);links++;
 if(anchor&&target.endsWith('.md'))assert(fs.readFileSync(target,'utf8').includes(`id="${anchor}"`),url+' missing explicit anchor');
}}
const html=fs.readFileSync(path.join(root,'quant_v1_audiobook.html'),'utf8');
const data=html.match(/<script id="bookData" type="application\/json">([\s\S]*?)<\/script>/);
assert(data);const player=JSON.parse(data[1]);assert.equal(player.stats.quiz_questions,107);assert.equal(player.stats.advanced_questions,168);assert.equal(player.chapters.length,128);
assert(!html.includes('__BOOK_DATA__'));assert(!/BCE|LeetCode|cs_ai_v2|CS_AI/.test(html));
for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(script[0].includes('application/json'))continue;new vm.Script(script[1]);}
const near=(actual,expected,tol=1e-8)=>assert(Math.abs(actual-expected)<tol,`${actual} != ${expected}`);
// Independent numerical checks for direction, units, costs and conditioning.
near(80*(1+.25*.04),80.8);
near(.4*122.4+.3*80+10*1.1385+3,87.345);
near(100*(.6*.99*.995+.4),99.103);
near(-1.15*2400000/(4800*50),-11.5);
near((30000*100.36+20000*100.24)/50000,100.312);
near(50000*(100.312-100.19-.16),-1900,1e-6);
near(40+49*.97*1.17,95.6101);
near(20000*-.4,-8000);
near(.2*.8/(.2*.8+.8*.1),2/3);
let divisible=0;for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(a*b%6===0)divisible++;
near(divisible/36,5/12);
near(1-Math.exp(-5/6)*(1+5/6),.203236617737,1e-9);
near(Math.sqrt(.6**2*.02**2+.4**2*.03**2+2*.6*.4*.5*.02*.03),Math.sqrt(.000432));
// Waiting-time recurrence residuals, including self-overlap.
near(6,1+.5*4+.5*6);near(4,1+.5*6);
near(10,1+.5*8+.5*10);near(8,1+.5*8+.5*6);near(6,1+.5*10);
const numerical=JSON.parse(fs.readFileSync(path.join(root,'data/numerical-results.json'),'utf8'));
const digest=createHash('sha256').update(fs.readFileSync(path.join(root,'examples/quant_examples.py'))).digest('hex');
assert.equal(numerical.source_sha256,digest,'Rerun examples after editing the calculation script');
near(numerical.black_scholes.call-numerical.black_scholes.put,100-100*Math.exp(-.05));
near(numerical.implied_volatility.recovered_sigma,.22);
near(numerical.portfolio.constrained_forecast,.052);
near(numerical.factor_and_backtest.correct_future_return,-.1);
assert(numerical.monte_carlo.independent_pairs*2===numerical.monte_carlo.terminal_payoffs);
const research=JSON.parse(fs.readFileSync(path.join(root,'data/research-results.json'),'utf8'));
assert.equal(book.research_cases.length,6);
assert.deepEqual(book.research_cases.map(c=>c.chapter),[88,96,104,112,120,128]);
for(const c of book.research_cases){
 assert(book.chapters[c.chapter-1].edition>=3);
 assert(fs.existsSync(path.join(root,c.script)));
 assert(c.csv_files.length>0);
 for(const file of c.csv_files)assert(fs.existsSync(path.join(root,file)));
}
assert.equal(research.source_sha256,createHash('sha256').update(fs.readFileSync(path.join(root,'examples/research_cases.py'))).digest('hex'),'Rerun research cases after editing code');
assert.equal(research.artifacts.length,6);
for(const artifact of research.artifacts){
 const file=path.join(root,'examples/output',artifact.name);
 assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),artifact.sha256,artifact.name+' stale CSV');
}
for(const key of ['timeseries','machine_learning','trading_system'])
 for(const [name,value] of Object.entries(research[key].checks))assert.equal(value,true,key+': '+name);
const ts=research.timeseries,ml=research.machine_learning,system=research.trading_system;
assert.equal(ts.forecasts,500);assert.equal(ml.predictions,400);assert.equal(ml.folds.length,8);
for(const fold of ml.folds){
 assert.equal(fold.inner_train_last_label_time,fold.origin-60);
 assert.equal(fold.validation_last_label_time,fold.origin);
 assert.equal(fold.outer_fit_last_label_time,fold.origin);
 assert.equal(fold.test_end_exclusive,fold.origin+50);
 const scores=Object.entries(fold.validation_mse).map(([penalty,score])=>[Number(score),Number(penalty)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 assert.equal(fold.penalty,scores[0][1]);
}
for(const p of Object.values(ml.portfolios))near(p.gross_return_sum-p.net_return_sum,p.cost_return_sum);
assert.equal(system.final.position,5);assert.equal(system.final.cash_cents,100000-5*1000-2*2);
assert.deepEqual(system.final.risk_bounds,[5,5]);
// Independently audit the simple numeric CSVs as well as their source hashes.
for(const name of ['timeseries_forecasts.csv','ml_forecasts.csv']){
 const lines=fs.readFileSync(path.join(root,'examples/output',name),'utf8').trim().split(/\r?\n/);
 const headers=lines.shift().split(',');const rows=lines.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[headers[i],Number(v)])));
 assert.equal(rows.length,name.startsWith('ml')?400:500);
 for(const row of rows){assert.equal(row.target_end,row.origin+1);assert((row.max_train_label_time??row.fit_last_label_time)<=row.origin);}
 const modelKey=name.startsWith('ml')?'prediction':'ar';
 const independentMSE=rows.reduce((sum,row)=>sum+(row.actual-row[modelKey])**2,0)/rows.length;
 near(independentMSE,name.startsWith('ml')?ml.mse.ridge:ts.mse.ar,1e-12);
}
for(const domain of ['timeseries','mlquant','systems','microstructure','hft','statarb'])assert(html.includes(`['${domain}',`));
assert(html.includes("case'research'"));
const market=JSON.parse(fs.readFileSync(path.join(root,'data/market-results.json'),'utf8'));
assert.equal(market.source_sha256,createHash('sha256').update(fs.readFileSync(path.join(root,'examples/market_cases.py'))).digest('hex'),'Rerun market cases after changing code');
assert.equal(market.artifacts.length,8);
for(const artifact of market.artifacts)assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'examples/market_output',artifact.name))).digest('hex'),artifact.sha256,artifact.name+' stale');
for(const key of ['microstructure','high_frequency','statistical_arbitrage'])for(const [name,passed] of Object.entries(market[key].checks))assert.equal(passed,true,key+' '+name);
// These generated CSVs have fixed scalar columns, with no embedded comma/newline.
function marketCSV(name){const lines=fs.readFileSync(path.join(root,'examples/market_output',name),'utf8').trim().split(/\r?\n/);const keys=lines.shift().split(',');return lines.map(line=>{const values=line.split(',');assert.equal(values.length,keys.length);return Object.fromEntries(keys.map((key,i)=>[key,values[i]]))});}
const quotes=marketCSV('micro_quotes.csv'),forecasts=marketCSV('micro_forecasts.csv');
assert.equal(quotes.length,601);assert.equal(forecasts.length,500);
const scored=quotes.filter(q=>q.future_mid_5!=='');assert.equal(scored.length,596);
for(const q of scored){near(+q.effective_spread,+q.realized_spread_5+(+q.price_impact_5));near(+q.taker_markout_5,+q.direction*(+q.future_mid_5-(+q.trade_price)));}
for(const q of quotes)assert(+q.bid<=+q.weighted_mid&&+q.weighted_mid<=+q.ask);
for(const row of forecasts){assert(+row.fit_last_label_time<=+row.origin);assert.equal(+row.target_end,+row.origin+1);}
for(const key of ['prediction','zero','proxy'])near(forecasts.reduce((sum,row)=>sum+(+row.actual-(+row[key]))**2,0)/forecasts.length,market.microstructure.mse_next_mid_cents_squared[key],1e-12);
const scenarios=market.high_frequency.scenarios;
assert.deepEqual(scenarios.map(s=>s.filled),[4,4,2,4]);
for(const s of scenarios){assert.equal(s.final_cash_cents,100000-10000*s.filled-s.fees_cents);assert.equal(s.terminal_marked_pnl_cents,-3*s.filled-s.fees_cents);assert.equal(s.duplicate_reports,1);}
const reports=marketCSV('queue_reports.csv');
for(const s of scenarios){
 let position=0,cash=100000;const ids=new Set();
 for(const row of reports.filter(row=>row.scenario===s.scenario)){
  if(row.kind==='fill'&&!ids.has(row.eid)){position+=+row.quantity;cash-=(+row.quantity)*(+row.price)+(+row.fee);ids.add(row.eid);}
  assert.equal(+row.position,position);assert.equal(+row.cash_cents,cash);
 }
 assert.equal(position,s.filled);assert.equal(cash,s.final_cash_cents);
}
const pair=market.statistical_arbitrage,signals=marketCSV('pairs_signals.csv'),ledger=marketCSV('pairs_ledger.csv'),trades=marketCSV('pairs_trades.csv'),models=marketCSV('pairs_models.csv');
assert.equal(pair.formal_cointegration_test,false);
assert.equal(signals.length,700);assert.equal(ledger.length,701);assert.equal(models.length,7);
for(const s of signals)assert(+s.fit_last<+s.time);
for(const t of trades)assert.equal(+t.fill_time,+t.decision_time+1);
for(const row of ledger){
 assert.equal(+row.equity_cents,(+row.cash_cents)+(+row.x_shares)*(+row.x_cents)+(+row.y_shares)*(+row.y_cents));
 assert.equal(+row.equity_cents-pair.base.initial_cash_cents,(+row.price_pnl_cents)-(+row.fees_cents)-(+row.slippage_cents)-(+row.borrow_cents));
}
assert.equal(+ledger.at(-1).x_shares,0);assert.equal(+ledger.at(-1).y_shares,0);assert.equal(+ledger.at(-1).cash_cents,pair.base.final_cash_cents);
assert(pair.stress.pnl_cents<=pair.base.pnl_cents&&pair.base.pnl_cents<=pair.no_cost.pnl_cents);
assert.equal(trades.length,pair.base.fills);
assert.equal(1000-1500-50-4,-554);
near(Math.log(.5)/Math.log(.9),6.578813478960585);
assert.equal(book.chapters.filter(c=>c.edition===4).length,24);
assert.equal(player.stats.research_cases,6);
for(const c of book.research_cases.slice(3))assert.equal(c.guide,'docs/MARKET_RESEARCH_CASES.md');
console.log(`PASS: ${links} local links, 128 chapters, 107 original + 168 advanced questions, 25 case rounds, 6 research labs, 260 terms; player syntax and cross-method numerical checks.`);
