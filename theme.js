/* v139: الشكل (ليل/صبح) بيتحط قبل أي رسم، فمفيش وميض صبح لما التطبيق يفتح وانت على الليل أو العكس */
(function(){var t='iron';try{t=localStorage.getItem('gl_th')||'iron'}catch(e){}if(t!=='morning')t='iron';
document.documentElement.setAttribute('data-th',t);var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='morning'?'#f3eee5':'#0e0e0f')})();
