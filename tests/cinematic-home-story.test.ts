import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(),'public','luna-cinematic','home-story');
const c = (f: string) => readFileSync(f,'utf8');
const routes = 'src/app/[locale]';

test('Previously approved Gate frame bank remains available at all original addresses',()=>{
  for(const s of ['natural','settled','quay']) for(const w of [960,1600,2560])
    assert.ok(existsSync(path.join(root,'home',s+'-'+w+'.webp')),s+' '+w);
  assert.ok(existsSync(path.join(root,'home','gate-still-hd.webp')));
  assert.deepEqual(readdirSync(path.join(root,'home','gate-frames')).sort(),Array.from({length:97},(_,i)=>String(i).padStart(3,'0')+'.webp'));
});

test('the night folio preserves the guarded route, three deep links and editable chapter art',()=>{
  const page=c(routes+'/story/page.tsx'), folio=c(routes+'/story/StoryFolio.tsx');
  assert.match(page,/<TabGuard tabKey="story"><StoryFolio/);
  assert.match(folio,/<noscript>/);
  assert.match(folio,/id=\{'chapter-'\+n\}/);
  for(const locale of ['en','ar']) {
    const messages=JSON.parse(c('messages/'+locale+'.json')).storyPage;
    for(const n of [1,2,3]) assert.ok(messages['chapter'+n].title && messages['chapter'+n].p3);
  }
  for(const plate of ['lunvor-original-remastered','movarth-original-remastered','champion-remastered'])
    assert.ok(existsSync(path.join(root,'story',plate+'.webp')));
  assert.match(folio,/StoryCoverImage/);
  assert.match(folio,/editId=/);
});

test('each night scene has two display tiers, a motion fallback and local playable editions',()=>{
  const media=path.join(root,'..','night-worlds');
  for(const scene of ['passage','characters','bank','bazaar','trading','story','partners','members']){
    for(const width of [960,1920]) assert.equal(readFileSync(path.join(media,scene+'-'+width+'.webp')).toString('ascii',8,12),'WEBP');
    for(const edition of ['screen','mobile']) assert.equal(readFileSync(path.join(media,scene+'-'+edition+'.webm')).readUInt32BE(0),0x1a45dfa3);
    assert.equal(readFileSync(path.join(media,scene+'.mp4')).toString('ascii',4,8),'ftyp');
  }
  assert.ok(existsSync(path.join(media,'passage-3840.webp')));
  const home=c(routes+'/components/HeroSection.tsx'), projection=c('src/components/cinematic/NightProjection.tsx');
  assert.match(home,/<NightProjection/);
  assert.match(home,/<HarbourChart/);
  assert.match(projection,/IntersectionObserver/);
  assert.match(projection,/prefers-reduced-motion/);
  assert.match(projection,/video\.pause\(\)/);
  assert.match(projection,/io\.disconnect\(\)/);
});
