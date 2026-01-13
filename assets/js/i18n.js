// --- Logic ---
function setLang(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  
  // Save preference
  localStorage.setItem('luna_lang', lang);

  // Buttons state
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-' + lang);
  if(btn) btn.classList.add('active');

  // Update Text
  if(typeof translations !== 'undefined'){
    const t = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if(t[key]) {
        if(el.tagName === 'META' && el.getAttribute('name') === 'description'){
          el.setAttribute('content', t[key]);
        } else {
          el.innerText = t[key];
        }
      }
    });
  }
}

// Init Logic
(function(){
  // Check saved or default to Arabic
  const saved = localStorage.getItem('luna_lang') || 'ar';
  setLang(saved);

  // Parallax Logic
  document.addEventListener('mousemove', (e) => {
    document.querySelectorAll('.hero-layer').forEach(layer => {
      const speed = layer.getAttribute('data-speed');
      const x = (window.innerWidth - e.pageX * speed) / 100;
      const y = (window.innerHeight - e.pageY * speed) / 100;
      layer.style.transform = `translateX(${x}px) translateY(${y}px)`;
    });
  });
})();

// Lightbox
function openLightbox(src){
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = src;
  lb.className = 'lightbox active';
  document.body.style.overflow = 'hidden';
}
function closeLightbox(){
  const lb = document.getElementById('lightbox');
  lb.className = 'lightbox';
  document.body.style.overflow = '';
  setTimeout(() => document.getElementById('lightbox-img').src = '', 300);
}
