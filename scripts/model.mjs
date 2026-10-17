import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const book=JSON.parse(fs.readFileSync(path.join(root,'data/book.json'),'utf8'));
export const clean=t=>t.replace(/【[^】]+】/g,'').trim();
for(const c of book.chapters){
  let n=0;
  c.toc=c.blocks.flatMap((b,index)=>b.kind==='heading'?[{index,title:b.text,anchor:`chapter-${c.num}-section-${String(++n).padStart(2,'0')}`}]:[]);
}
book.stats={chapters:book.chapters.length,concept_chapters:book.chapters.filter(c=>c.micro).length,advanced_chapters:book.chapters.filter(c=>c.advanced).length,glossary_entries:book.glossary.length,quiz_questions:book.questions.length,advanced_questions:(book.advanced_questions||[]).length,total_questions:book.questions.length+(book.advanced_questions||[]).length,case_studies:new Set(book.cases.map(c=>c.id.split('.')[0])).size,case_rounds:book.cases.length,research_cases:(book.research_cases||[]).length,new_subsections:book.chapters.reduce((s,c)=>s+c.toc.length,0),sources:book.sources.length,body_characters:book.chapters.flatMap(c=>c.blocks.map(b=>b.text)).join('').length};
export const chapterText=c=>`第 ${c.num} 讲。${c.title}。\n\n`+c.blocks.map(b=>b.text.replace(/【答题停顿】/g,'（请暂停，先尝试回答。）')).join('\n\n')+'\n';
export const sourceUrl=(s,prefix='')=>s.local_only?prefix+`docs/SOURCE_NOTICES.md#source-${s.id}`:s.file?prefix+'sources/'+encodeURIComponent(s.file).replace(/\(/g,'%28').replace(/\)/g,'%29'):s.url;
export function markdown(c,prefix=''){
  const anchors=new Map(c.toc.map(t=>[t.index,t.anchor]));
  return `<a id="chapter-${c.num}"></a>\n\n## 第 ${c.num} 讲｜${c.title}\n\n领域：${c.group}\n\n`+
  c.blocks.map((b,i)=>b.kind==='heading'?`<a id="${anchors.get(i)}"></a>\n\n### ${b.text}`:b.text.replace(/【答题停顿】/g,'**先自行回答，再核对：** ')).join('\n\n')+
  '\n\n参考资料（播放器不朗读链接）：'+c.source_ids.map(id=>{const s=book.sources.find(s=>s.id===id);return `[S${id} ${s.title}](${sourceUrl(s,prefix)})`}).join('；')+'\n';
}
