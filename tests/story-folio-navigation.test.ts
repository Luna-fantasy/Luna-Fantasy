import assert from 'node:assert/strict';
import test from 'node:test';
import { followChapterLink, observeChapters } from '../src/app/[locale]/story/folio-navigation';

function reader(hash:string) {
  const scrolled:string[]=[];
  return Object.assign(new EventTarget(), {
    location:{hash},
    document:{getElementById:(id:string)=>({scrollIntoView:()=>{scrolled.push(id)}})},
    scrolled,
  });
}

function click(hash:string) {
  return {button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,prevented:false,
    currentTarget:{hash},preventDefault(){this.prevented=true}};
}

test('one activation follows the captured chapter even when rendering rewrites the clicked anchor',()=>{
  const browser=reader('#chapter-1');
  const displayed:number[]=[];
  for(const [next,rewritten] of [[2,3],[3,3],[2,1],[1,1]]){
    const link=click('#chapter-'+next);
    followChapterLink(link,chapter=>{
      displayed.push(chapter);
      link.currentTarget.hash='#chapter-'+rewritten;
    },browser);
    if(!link.prevented)browser.location.hash=link.currentTarget.hash;
    assert.equal(browser.location.hash,'#chapter-'+next);
    assert.equal(link.prevented,true);
  }
  assert.deepEqual(displayed,[2,3,2,1]);
  followChapterLink(click('#chapter-1'),()=>{},browser);
  assert.deepEqual(browser.scrolled,['chapter-1']);
  const modified={...click('#chapter-2'),ctrlKey:true};
  followChapterLink(modified,()=>assert.fail('modified navigation should remain native'),browser);
  assert.equal(modified.prevented,false);
});

test('deep links, browser history and an empty fragment select the matching chapter while subscribed',()=>{
  const browser=reader('#chapter-3'),displayed:number[]=[];
  const remove=observeChapters(chapter=>displayed.push(chapter),browser);
  for(const [hash,event] of [['#chapter-2','popstate'],['#chapter-1','hashchange'],['#other','hashchange'],['','popstate']]){
    browser.location.hash=hash;browser.dispatchEvent(new Event(event));
  }
  remove();
  browser.location.hash='#chapter-3';browser.dispatchEvent(new Event('hashchange'));
  assert.deepEqual(displayed,[3,2,1,1]);
});
