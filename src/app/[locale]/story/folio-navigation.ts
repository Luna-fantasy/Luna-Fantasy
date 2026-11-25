type ChapterClick = Pick<MouseEvent,'button'|'metaKey'|'ctrlKey'|'shiftKey'|'altKey'|'preventDefault'> & {
  currentTarget: Pick<HTMLAnchorElement,'hash'>;
};
type FolioBrowser = EventTarget & {
  location: {hash:string};
  document: {getElementById(id:string): Pick<Element,'scrollIntoView'> | null};
};

function chapterFrom(hash:string) {
  const match=/^#chapter-([123])$/.exec(hash);
  return match ? Number(match[1]) : undefined;
}

export function observeChapters(select:(chapter:number)=>void,browser:FolioBrowser=window) {
  const read=()=>{
    const chapter=browser.location.hash ? chapterFrom(browser.location.hash) : 1;
    if(chapter) select(chapter);
  };
  read();
  browser.addEventListener('hashchange',read);
  browser.addEventListener('popstate',read);
  return ()=>{
    browser.removeEventListener('hashchange',read);
    browser.removeEventListener('popstate',read);
  };
}

export function followChapterLink(event:ChapterClick,select:(chapter:number)=>void,browser:FolioBrowser=window) {
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
  // React can update this same anchor's href when the new chapter is rendered.
  const destination=event.currentTarget.hash;
  const chapter=chapterFrom(destination);
  if(!chapter) return;
  event.preventDefault();
  if(browser.location.hash!==destination) browser.location.hash=destination;
  else browser.document.getElementById(destination.slice(1))?.scrollIntoView({block:'start'});
  select(chapter);
}
