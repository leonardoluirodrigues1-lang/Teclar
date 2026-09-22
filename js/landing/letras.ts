/* ==================================================================
   UTILITARIOS
   ================================================================== */
/* exportada: o campo de estrelas das telas de auth (js/auth/comum.ts) importa
   este mesmo gerador, para a composicao nao mudar a cada recarga.
   LCG de Numerical Recipes, modulo 2^32. As sementes de cada camada abaixo
   sao FIXAS de proposito: sem elas a composicao mudaria a cada recarga. */
export function rng(seed:number):()=>number{let s=seed;return()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296;};}
function el<K extends keyof HTMLElementTagNameMap>(tag:K,css?:string):HTMLElementTagNameMap[K]{const d=document.createElement(tag);if(css)d.style.cssText=css;return d;}

/* As tres funcoes abaixo recebem o host (uma .layer do hero) em vez de
   procurar por id: o Landing.tsx passa a ref de cada camada num useEffect
   e, ao desmontar, esvazia o host. Sao DOM direto de proposito -- 178 nos
   com animacao CSS nao precisam de reconciliacao, e continuam identicos
   ao que o .js fazia. */

/* ==================================================================
   (removido) CAMADAS DE CIRCULO EM CSS
   Havia 4 aneis desenhados em CSS por cima do shader: raios de 75vh,
   59vh, 44vh e um conico de 67vh. O anel de foton do proprio shader
   fica em 30vh, entao os circulos CSS apareciam como uma SEGUNDA esfera
   concentrica. Existiam so para fingir movimento enquanto o shader
   estava congelado; agora que ele anima de verdade, sao ruido visual.
   ================================================================== */

/* ==================================================================
   HALOS, RAIOS E PARTICULAS
   ================================================================== */
export function iniciarRaiosEParticulas(host:HTMLElement):void{

  /* os halos circulares tambem sairam: eram mais dois aneis competindo
     com o anel de foton do shader. Ficam so os raios de luz e as
     particulas, que nao tem forma de circulo. */

  let rand=rng(775511);
  for(let i=0;i<16;i++){
    const top=44+rand()*40, width=24+rand()*46, left=rand()*55;
    const dur=3.5+rand()*9, delay=-rand()*10;
    const op=.08+rand()*.26, th=1+Math.round(rand()*2);
    const d=el('div',`position:absolute;top:${top.toFixed(1)}%;left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;height:${th}px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent);animation:teclar-streak ${dur.toFixed(2)}s linear infinite;animation-delay:${delay.toFixed(2)}s;will-change:transform,opacity`);
    d.style.setProperty('--so',op.toFixed(2));
    host.appendChild(d);
  }

  rand=rng(4242421);
  for(let i=0;i<52;i++){
    const angle=rand()*360, radius=16+rand()*44;
    const dur=6+rand()*14, delay=-rand()*18;
    const size=1+rand()*2.2, op=.25+rand()*.5;
    const orbit=14+rand()*26, rev=rand()>.5;
    const a=el('div'); a.className='orbit-anchor'; a.style.transform=`rotate(${angle.toFixed(1)}deg)`;
    const s=el('div',`height:0;width:0;animation:${rev?'tc-orbit-rev':'tc-orbit'} ${orbit.toFixed(2)}s linear infinite;will-change:transform`);
    const f=el('div',`animation:teclar-particle ${dur.toFixed(2)}s linear infinite;animation-delay:${delay.toFixed(2)}s;will-change:transform,opacity`);
    f.style.setProperty('--r',radius.toFixed(1)+'vh');
    f.style.setProperty('--o',op.toFixed(2));
    const dot=el('span',`width:${size.toFixed(1)}px;height:${size.toFixed(1)}px`); dot.className='particle';
    f.appendChild(dot); s.appendChild(f); a.appendChild(s); host.appendChild(a);
  }
}

/* ==================================================================
   LETRAS EM ESPIRAL - caem acelerando para dentro do horizonte
   ================================================================== */
export function iniciarLetrasOrbitando(host:HTMLElement):void{
  const POOL='ASDFJKLÇQWERTYUIOPGHZXCVBNM'.split('');
  const rand=rng(20260903);

  for(let i=0;i<38;i++){
    const ch=POOL[Math.floor(rand()*POOL.length)];
    const orbit=11+rand()*20;          /* volta completa */
    const infall=9+rand()*13;          /* tempo ate sumir no centro */
    const rev=i%3===0;
    const radius=20+rand()*32;         /* vh */
    const profundidade=rand();         /* 0 longe .. 1 perto */
    const size=9+profundidade*17;
    const op=.14+profundidade*.42;
    const tumble=(rand()>.5?1:-1)*(200+rand()*520);
    const spin=(rand()>.5?1:-1)*(140+rand()*400);
    const squash=.52+rand()*.46;       /* achatamento = disco visto de lado */

    const anchor=el('div'); anchor.className='orbit-anchor';
    anchor.style.transform=`rotate(${(rand()*360).toFixed(1)}deg) scaleY(${squash.toFixed(2)})`;

    const rot=el('div',`height:0;width:0;animation:${rev?'tc-orbit-rev':'tc-orbit'} ${orbit.toFixed(2)}s linear infinite;animation-delay:${(-rand()*orbit).toFixed(2)}s;will-change:transform`);

    const fall=el('div',`animation:tc-infall ${infall.toFixed(2)}s cubic-bezier(.42,0,.85,.42) infinite;animation-delay:${(-rand()*infall).toFixed(2)}s;will-change:transform,opacity,filter`);
    fall.style.setProperty('--r',radius.toFixed(1)+'vh');
    fall.style.setProperty('--o',op.toFixed(2));
    fall.style.setProperty('--spin',spin.toFixed(0)+'deg');

    const span=el('span',`font-size:${size.toFixed(1)}px;animation:tc-tumble ${(orbit*.7).toFixed(2)}s linear infinite;will-change:transform`);
    span.className='glyph'; span.textContent=ch;
    span.style.setProperty('--tumble',tumble.toFixed(0)+'deg');
    if(profundidade<.35) span.style.filter=`blur(${((.35-profundidade)*3).toFixed(2)}px)`;

    fall.appendChild(span); rot.appendChild(fall); anchor.appendChild(rot); host.appendChild(anchor);
  }
}

/* ==================================================================
   LETRAS ESPALHADAS - atravessam, sao puxadas ou apenas respiram
   ================================================================== */
export function iniciarLetrasEspalhadas(host:HTMLElement):void{
  const rand=rng(99117733);
  const POOL='ASDFJKLÇQWERTYUIOPGHZXCVBNM'.split('');

  /* empurra as posicoes para as bordas, deixando o centro respirar */
  const bordas=(v:number)=>{const t=Math.abs(v-.5)*2;const p=Math.pow(t,.42);
    return (v<.5?.5-p/2:.5+p/2)*100;};

  for(let i=0;i<72;i++){
    const tipo=i%3;                       /* 0 atravessa | 1 puxada | 2 respira */
    const left=bordas(rand()), top=bordas(rand());
    const prof=rand();
    const dir=rand()>.5?1:-1;
    const dur = tipo===0 ? 18+rand()*26 : tipo===1 ? 13+rand()*19 : 9+rand()*13;
    const ch=POOL[Math.floor(rand()*POOL.length)];
    const size=8+prof*28, op=.07+prof*.4;
    const blur=(1-prof)*1.7;

    const s=el('span'); s.className='scatter'; s.textContent=ch;
    s.style.left=left.toFixed(1)+'%';
    s.style.top=top.toFixed(1)+'%';
    s.style.fontSize=size.toFixed(1)+'px';
    if(blur>.2) s.style.filter=`blur(${blur.toFixed(2)}px)`;
    s.style.setProperty('--fs','1');
    s.style.setProperty('--fo',op.toFixed(2));

    if(tipo===0){
      s.style.setProperty('--fx',(dir*-(62+rand()*30))+'vw');
      s.style.setProperty('--fy',((rand()-.5)*10)+'vh');
      s.style.setProperty('--tx',(dir*(62+rand()*30))+'vw');
      s.style.setProperty('--ty',((rand()-.5)*20)+'vh');
      s.style.setProperty('--rot',(dir*(30+rand()*130))+'deg');
      s.style.animationName='tc-drift';
      s.style.animationTimingFunction='linear';
    } else if(tipo===1){
      /* vetor apontando para o centro do buraco negro */
      s.style.setProperty('--tx',((50-left)*.92).toFixed(1)+'vw');
      s.style.setProperty('--ty',((44-top)*.92).toFixed(1)+'vh');
      s.style.animationName='tc-pull';
      s.style.animationTimingFunction='cubic-bezier(.45,0,.9,.5)';
    } else {
      s.style.setProperty('--tx',(dir*(1.5+rand()*3)).toFixed(1)+'vw');
      s.style.setProperty('--ty',(-(2+rand()*4)).toFixed(1)+'vh');
      s.style.animationName='tc-breathe';
      s.style.animationTimingFunction='ease-in-out';
    }
    s.style.animationDuration=dur.toFixed(2)+'s';
    s.style.animationIterationCount='infinite';
    s.style.animationDelay=(-rand()*dur).toFixed(2)+'s';
    s.style.willChange='transform,opacity,filter';
    host.appendChild(s);
  }
}
