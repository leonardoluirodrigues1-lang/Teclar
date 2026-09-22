/* ==================================================================
   REVEAL PALAVRA POR PALAVRA NO SCROLL
   Quebra o texto em <span class="w"> e escalona o atraso de cada um.

   Virou hook (useRevelacao), mas o que ele faz e o mesmo do reveal.js:
   varre os [data-split] do documento, quebra o texto em palavras e liga
   dois IntersectionObserver. A quebra mexe em nos de texto que o React
   renderizou -- e seguro porque o Landing.tsx nao tem estado e nunca
   re-renderiza esses nos; e a quebra e idempotente (pula os .w e os
   espacos entre eles), entao rodar de novo nao duplica nada.
   ================================================================== */
import { useLayoutEffect } from 'react';

/** Desliga observadores e ouvintes que iniciarRevelacao() ligou. */
export type PararRevelacao = () => void;

export function iniciarRevelacao():PararRevelacao{
  /* quebra em palavras preservando os elementos filhos (ex: <span class="linha2">) */
  const ESPACOS=/\s+/;   /* montada em Python: evita problema de escape */

  function quebrar(no:Node){
    const filhos=[...no.childNodes];
    filhos.forEach(f=>{
      if(f.nodeType===3){
        const txt=f.textContent;
        if(!txt.trim()) return;              /* so espaco entre tags: deixa quieto */
        const frag=document.createDocumentFragment();
        txt.trim().split(ESPACOS).forEach((pt,i)=>{
          if(!pt) return;
          if(i) frag.appendChild(document.createTextNode(' '));
          const sp=document.createElement('span');
          sp.className='w'; sp.textContent=pt;
          frag.appendChild(sp);
        });
        (f as Text).replaceWith(frag);
      } else if(f.nodeType===1 && !(f as Element).classList.contains('w')){
        quebrar(f);
      }
    });
  }

  document.querySelectorAll('[data-split]').forEach(quebrar);

  const io=new IntersectionObserver(entradas=>{
    entradas.forEach(e=>{
      const alvo=e.target as HTMLElement;
      if(!e.isIntersecting) return;
      const base=parseInt(alvo.dataset.delay||'0',10);
      const palavras=alvo.querySelectorAll<HTMLElement>('.w');
      /* escalona: quanto mais palavras, menor o passo, pra nao ficar lento */
      const passo=Math.max(34,Math.min(80,1100/Math.max(palavras.length,1)));
      palavras.forEach((w,i)=>{ w.style.transitionDelay=(base+i*passo)+'ms'; });
      setTimeout(()=>alvo.classList.add('on'),0);
      if(alvo.classList.contains('reveal')) alvo.classList.add('on');
      io.unobserve(alvo);
    });
  },{threshold:.2,rootMargin:'0px 0px -22% 0px'});

  /* blocos simples que sobem inteiros (numeros, teclas, botao) */
  const io2=new IntersectionObserver(entradas=>{
    entradas.forEach(e=>{
      const alvo=e.target as HTMLElement;
      if(!e.isIntersecting) return;
      const d=parseInt(alvo.dataset.delay||'0',10);
      setTimeout(()=>alvo.classList.add('on'),d);
      io2.unobserve(alvo);
    });
  },{threshold:.2,rootMargin:'0px 0px -22% 0px'});

  /* as palavras so comecam a aparecer depois que o usuario rola a pagina */
  let ligado=false;
  function ligar(){
    if(ligado) return; ligado=true;
    document.querySelectorAll('[data-split]').forEach(n=>io.observe(n));
    document.querySelectorAll('.reveal').forEach(n=>io2.observe(n));
  }
  /* once:true de proposito, inclusive no keydown: e o comportamento
     original (a primeira tecla, seja qual for, consome o ouvinte). Os
     ouvintes tem nome so para a limpeza conseguir remove-los. */
  const aoTeclar=(e:KeyboardEvent)=>{
    if(['PageDown','ArrowDown',' ','End'].includes(e.key)) ligar();
  };
  addEventListener('scroll',ligar,{once:true,passive:true});
  addEventListener('wheel',ligar,{once:true,passive:true});
  addEventListener('touchmove',ligar,{once:true,passive:true});
  addEventListener('keydown',aoTeclar,{once:true});
  /* clicar em "Comecar a treinar" tambem conta como rolar */
  const ancoras=document.querySelectorAll('a[href^="#"]');
  ancoras.forEach(a=>a.addEventListener('click',ligar));

  return ()=>{
    io.disconnect(); io2.disconnect();
    removeEventListener('scroll',ligar);
    removeEventListener('wheel',ligar);
    removeEventListener('touchmove',ligar);
    removeEventListener('keydown',aoTeclar);
    ancoras.forEach(a=>a.removeEventListener('click',ligar));
  };
}

/* useLayoutEffect, nao useEffect: a quebra em .w e o que deixa o texto
   com opacity 0 ate o scroll. Se rodasse depois da pintura, o texto
   inteiro apareceria por um frame e sumiria -- coisa que o reveal.js,
   rodando antes da primeira pintura, nunca fez. */
export function useRevelacao():void{
  useLayoutEffect(iniciarRevelacao,[]);
}
