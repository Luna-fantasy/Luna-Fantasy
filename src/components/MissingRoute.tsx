import React from 'react';

export function MissingRoute({locale,standalone=false}:{locale:string;standalone?:boolean}) {
  const ar=locale==='ar';
  const language=ar?'ar':'en';
  return <main lang={language} dir={ar?'rtl':'ltr'} data-missing-locale={language} style={{
    minHeight:standalone?'100vh':'60vh',display:'grid',placeItems:'center',padding:'2rem',
    background:'#211923',color:'#fae7dd',textAlign:'center',
  }}>
    <div style={{maxWidth:'36rem'}}>
      <div aria-hidden="true" style={{fontSize:'clamp(3rem,8vw,6rem)',lineHeight:1,color:'#d7a394'}}>404</div>
      <h1 style={{fontSize:'clamp(1.75rem,3.6vw,3.3rem)',margin:'.5em 0 .25em'}}>{ar?'الصفحة غير موجودة':'Page not found'}</h1>
      <p style={{margin:'0 0 1.3rem',color:'#e8d1d3'}}>{ar?'تعذّر العثور على الصفحة التي طلبتها.':'The page you are looking for does not exist.'}</p>
      <a href={'/'+language} style={{display:'inline-flex',alignItems:'center',minHeight:44,padding:'.5rem 1rem',
        background:'#efd0b3',color:'#402731',fontWeight:650,textDecoration:'underline',textUnderlineOffset:3}}>
        {ar?'العودة إلى الرئيسية':'Go home'}
      </a>
    </div>
  </main>;
}
