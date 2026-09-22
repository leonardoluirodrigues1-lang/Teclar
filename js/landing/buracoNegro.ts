/* ==================================================================
   HORIZONTE DE EVENTOS - shader animado
   No original o shader era desenhado UMA vez com uTime=0 e uMotion=0,
   entao o buraco negro ficava congelado. Agora roda em loop.

   Modulo ES puro, sem React: o Landing.tsx so monta o <canvas> e chama
   iniciarBuracoNegro() num useEffect. O loop NAO passa por estado React
   (um setState por frame destruiria a performance); ele fala direto
   com o WebGL, como sempre falou. A unica diferenca da versao .js e que
   a funcao devolve a limpeza (cancelar o rAF, desligar observadores e
   soltar o contexto) para o useEffect usar ao desmontar.
   ================================================================== */
const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;
const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uMotion; // 0 = reduced motion, 1 = full
uniform float uQuality;

// hash / noise ------------------------------------------------------
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 3; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  float t = uTime * uMotion;

  // Camera: extremely close to the horizon, slightly above the disk plane.
  // Very slow, non-repeating drift so the whole frame breathes.
  float bob = sin(t * 0.22) * 0.06 + sin(t * 0.11 + 1.3) * 0.035;
  vec3 ro = vec3(sin(t * 0.15) * 0.2, 1.35 + bob, -10.8);
  vec3 target = vec3(0.0, -0.05 + bob * 0.2, 0.0);
  vec3 fw = normalize(target - ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);

  // Wide-ish focal length so the horizon spills toward screen edges
  vec3 rd = normalize(uv.x * rt + uv.y * up + 2.15 * fw);

  vec3 pos = ro;
  vec3 vel = rd;

  // angular momentum term for photon deflection
  vec3 h = cross(pos, vel);
  float h2 = dot(h, h);

  vec3 col = vec3(0.0);
  float alphaDisk = 0.0;
  bool captured = false;

  const float RS = 1.0; // event horizon radius

  int steps = int(mix(52.0, 84.0, uQuality));
  float dt = 0.115;

  for (int i = 0; i < 84; i++) {
    if (i >= steps) break;
    float r = length(pos);
    if (r < RS) { captured = true; break; }
    if (r > 26.0) break;

    // adaptive step
    float step = dt * clamp(r * 0.42, 0.32, 2.0);

    vec3 prev = pos;
    // geodesic-like acceleration
    vec3 acc = -1.5 * h2 * pos / pow(dot(pos, pos), 2.5);
    vel += acc * step;
    pos += vel * step;

    // accretion disk in the y = 0 plane
    if (prev.y * pos.y < 0.0) {
      float f = prev.y / (prev.y - pos.y);
      vec3 hit = mix(prev, pos, f);
      float rr = length(hit.xz);
      if (rr > 2.05 && rr < 7.6) {
        float ang = atan(hit.z, hit.x);

        // Keplerian-ish differential rotation: inner layers orbit much faster
        float kep = 9.5 / pow(rr, 1.5);

        // ---- layer 1: broad luminous matter ----
        float swirlA = ang * 2.0 + t * kep;
        float densA = fbm(vec3(cos(swirlA) * rr * 0.85, sin(swirlA) * rr * 0.85, rr * 0.7 - t * 1.1));
        densA = pow(clamp(densA, 0.0, 1.0), 1.25);

        // ---- layer 2: slower, coarser trails (depth) ----
        float swirlB = ang * 2.0 + t * kep * 0.55 + 2.1;
        float densB = fbm(vec3(cos(swirlB) * rr * 0.42, sin(swirlB) * rr * 0.42, rr * 0.35 + t * 0.45));
        densB = pow(clamp(densB, 0.0, 1.0), 1.9);

        // ---- layer 3: thin sharp light streaks stretched along the orbit ----
        float streakPhase = ang * 9.0 + t * kep * 1.35 + fbm(vec3(rr * 1.6, ang * 1.2, t * 0.55)) * 5.0;
        float streak = pow(0.5 + 0.5 * sin(streakPhase), 14.0);
        streak *= smoothstep(0.0, 0.5, densA);

        // ---- layer 4: particle-like fragments ----
        float frag = pow(noise(vec3(cos(swirlA) * rr * 5.5, sin(swirlA) * rr * 5.5, t * 2.2)), 9.0) * 6.0;

        float inner = smoothstep(2.05, 3.0, rr);
        float outer = 1.0 - smoothstep(4.2, 7.6, rr);
        float falloff = inner * outer * exp(-(rr - 2.05) * 0.3) * 1.7;

        // relativistic beaming, monochrome, gently precessing
        float beam = 0.42 + 1.05 * pow(max(0.0, 0.5 + 0.5 * sin(ang - 1.55 + sin(t * 0.28) * 0.3)), 1.7);

        float amt = falloff * (0.28 + 1.15 * densA + 0.55 * densB + 2.4 * streak + frag * 0.35) * beam * 3.4;

        col += vec3(amt) * (1.0 - alphaDisk);
        alphaDisk = clamp(alphaDisk + amt * 0.45, 0.0, 1.0);
      }
    }
  }

  // faint lensed starfield / dust behind the hole
  if (!captured) {
    vec3 d = normalize(vel);
    float st = pow(noise(d * 190.0), 30.0) * 30.0;
    col += vec3(st) * 0.3;
  }

  // photon ring: sharp bright rim at the horizon silhouette, subtly shimmering
  float b = length(uv - vec2(0.0, 0.06));
  float shim = 0.985 + 0.03 * sin(atan(uv.y - 0.06, uv.x) * 3.0 + t * 1.6);
  float ring = exp(-pow(abs(b - 0.30 * shim) * 46.0, 1.6));
  float halo = exp(-pow(abs(b - 0.30) * 9.0, 2.0));
  col += vec3(ring) * 1.25 + vec3(halo) * 0.16;

  // monochrome white grade
  float lum = clamp(max(max(col.r, col.g), col.b), 0.0, 10.0);
  vec3 outc = vec3(lum);
  outc = outc / (outc + 0.62);          // tonemap (brighter highlights)
  outc = pow(outc, vec3(1.08));         // keep blacks deep, lift the light
  outc = clamp(outc * 1.12, 0.0, 1.0);
  outc = mix(outc, vec3(dot(outc, vec3(0.333))), 1.0); // strictly monochrome

  // vignette toward pure black edges
  vec2 vuv = uv * vec2(0.58, 1.0);
  float vig = exp(-2.2 * dot(vuv, vuv));
  outc *= vig;

  // subtle dither to avoid banding
  outc += (hash(vec3(gl_FragCoord.xy, 1.0)) - 0.5) * 0.006;

  gl_FragColor = vec4(max(outc, 0.0), 1.0);
}
`;

function compile(gl:WebGLRenderingContext,type:number,src:string):WebGLShader|null{
  const sh=gl.createShader(type);
  gl.shaderSource(sh,src); gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){
    console.error(gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null;
  }
  return sh;
}

/** Desfaz tudo o que iniciarBuracoNegro() ligou. Sem efeito na 2a chamada. */
export type PararBuracoNegro = () => void;

const NADA_A_PARAR: PararBuracoNegro = () => {};

/* Recebe o canvas do buraco negro e inicia o WebGL: compila o programa,
   define o tamanho do canvas e comeca o loop de animacao.
   Devolve a funcao que para o loop e solta o contexto (limpeza do
   useEffect). Quando o WebGL nao esta disponivel ou o shader nao
   compila, devolve uma limpeza vazia -- nao ha nada ligado. */
export function iniciarBuracoNegro(canvas:HTMLCanvasElement):PararBuracoNegro{
  /* 'experimental-webgl' nao tem overload tipado no lib.dom, dai o cast */
  const gl=(canvas.getContext('webgl',{antialias:false,alpha:false,powerPreference:'high-performance'})
        || canvas.getContext('experimental-webgl')) as WebGLRenderingContext|null;
  if(!gl){canvas.style.display='none';return NADA_A_PARAR;}

  const vs=compile(gl,gl.VERTEX_SHADER,VERT), fs=compile(gl,gl.FRAGMENT_SHADER,FRAG);
  if(!vs||!fs) return NADA_A_PARAR;
  const prog=gl.createProgram();
  gl.attachShader(prog,vs); gl.attachShader(prog,fs); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(prog));return NADA_A_PARAR;}
  gl.useProgram(prog);

  const buf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(prog,'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);

  const uRes=gl.getUniformLocation(prog,'uRes');
  const uTime=gl.getUniformLocation(prog,'uTime');
  const uMotion=gl.getUniformLocation(prog,'uMotion');
  const uQuality=gl.getUniformLocation(prog,'uQuality');

  const ESCALA=0.62;          /* mesma nitidez do projeto original */
  let small=false;
  function resize(){
    const w=canvas.clientWidth||1, h=canvas.clientHeight||1;
    small = w<900;
    const s=Math.min(window.devicePixelRatio||1,1.25)*(small?0.46:ESCALA);
    const pw=Math.max(1,Math.floor(w*s)), ph=Math.max(1,Math.floor(h*s));
    /* ignora variacao minima: quando o JS injeta as secoes aparece a
       barra de rolagem, a largura cai ~15px e o canvas era refeito a toa */
    if(Math.abs(canvas.width-pw)<24 && Math.abs(canvas.height-ph)<24) return;
    canvas.width=pw; canvas.height=ph;
  }
  resize();
  const ro=new ResizeObserver(resize);
  ro.observe(canvas);

  /* pausa quando o hero sai da tela, pra nao gastar GPU a toa */
  let visivel=true;
  const io=new IntersectionObserver(e=>{visivel=e[0].isIntersecting},{threshold:0});
  io.observe(document.getElementById('top'));

  const t0=performance.now();
  let ultimo=0;
  const INTERVALO=1000/40;   /* teto de 40fps: o shader e caro */

  /* A resolucao e escolhida UMA vez e nao muda mais.
     A versao anterior tinha um auto-degrade que somava frames lentos
     sem nunca zerar o contador: com tempo suficiente ele sempre
     acabava baixando a qualidade e nunca voltava. */

  let raf=0;
  function frame(now:number){
    raf=requestAnimationFrame(frame);
    if(!visivel){ ultimo=0; return; }        /* volta zerado ao reaparecer */
    if(ultimo && now-ultimo < INTERVALO) return;
    ultimo=now;

    gl.viewport(0,0,canvas.width,canvas.height);
    gl.uniform2f(uRes,canvas.width,canvas.height);
    /* o shader usa uTime dentro do ruido do disco. Se o numero cresce
       sem limite, o highp float perde precisao e a textura vira mancha.
       Limitar mantem o ruido nitido para sempre. */
    gl.uniform1f(uTime,((now-t0)/1000)%600);
    gl.uniform1f(uMotion,1);
    gl.uniform1f(uQuality,small?0:1);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  raf=requestAnimationFrame(frame);

  /* Limpeza para o useEffect: para o loop, desliga os observadores,
     devolve os recursos da GPU e solta o contexto. Sem isso, desmontar
     o componente deixaria o rAF rodando para sempre num canvas orfao. */
  let parado=false;
  return ()=>{
    if(parado) return; parado=true;
    cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.deleteShader(vs); gl.deleteShader(fs);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
