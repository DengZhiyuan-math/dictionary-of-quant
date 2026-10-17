import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root} from './model.mjs';

// Copy only maintained project assets; never sweep the workspace or old archives.
const destination=path.join(root,'publication/github');
const relative=path.relative(root,destination);
if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Public destination must stay inside this workspace');
execFileSync(process.execPath,[path.join(root,'scripts/build.mjs'),'--check'],{stdio:'inherit'});
const folders=['chapters','data','docs','examples','scripts','src','text'];
const files=['README.md','CONTRIBUTING.md','CHANGELOG.md','package.json','.gitignore',
 'quant_v1_audiobook.html','quant_v1_full.md','quant_v1_index.md','quant_v1_training_terms.md',
 'quant_v2_advanced.md','quant_v3_research.md','quant_v4_market.md'];
fs.mkdirSync(destination,{recursive:true});
for(const name of folders)fs.cpSync(path.join(root,name),path.join(destination,name),{recursive:true,
 filter:source=>!/(?:^|[\\/])(?:__pycache__|node_modules|\.git)(?:[\\/]|$)|\.(?:pdf|zip|pyc)$/i.test(source)});
for(const name of files)fs.copyFileSync(path.join(root,name),path.join(destination,name));
const bookFile=path.join(destination,'data/book.json');
const book=JSON.parse(fs.readFileSync(bookFile,'utf8'));
book.metadata.distribution='public';
book.metadata.publication_date='2026-10-17';
for(const source of book.sources)if(source.file){delete source.file;source.local_only=true;}
fs.writeFileSync(bookFile,JSON.stringify(book,null,2)+'\n');
fs.mkdirSync(path.join(destination,'sources'),{recursive:true});
fs.writeFileSync(path.join(destination,'sources/README.md'),'# Source materials\n\nOriginal PDFs are kept locally and are not distributed in this public repository. See [source notices](../docs/SOURCE_NOTICES.md).\n');
// Preserve source bytes: generated results contain code/CSV SHA-256 digests.
fs.writeFileSync(path.join(destination,'.gitattributes'),'* -text whitespace=cr-at-eol\n');
execFileSync(process.execPath,[path.join(destination,'scripts/build.mjs')],{stdio:'inherit',cwd:destination});
execFileSync(process.execPath,[path.join(destination,'scripts/check.mjs')],{stdio:'inherit',cwd:destination});
console.log('Public distribution prepared:',destination);
