// O som do treino: um toque curto e grave quando a tecla sai errada, para a
// pessoa sentir o erro sem tirar o olho do texto. Gerado na hora (WebAudio),
// sem arquivo para baixar; baixo, para não incomodar uma sala inteira.
// Vem desligado; liga em Configurações > Acessibilidade ("Sons do treino").

let contexto: AudioContext | null = null;

export function tocarErro(): void {
  try {
    // Criado na primeira tecla errada: o navegador só libera áudio depois
    // de um gesto da pessoa, e a tecla é esse gesto.
    contexto ??= new AudioContext();
    const agora = contexto.currentTime;
    const oscilador = contexto.createOscillator();
    const volume = contexto.createGain();
    oscilador.type = 'triangle';
    oscilador.frequency.value = 196;
    volume.gain.setValueAtTime(0.06, agora);
    volume.gain.exponentialRampToValueAtTime(0.0001, agora + 0.08);
    oscilador.connect(volume).connect(contexto.destination);
    oscilador.start(agora);
    oscilador.stop(agora + 0.09);
  } catch {
    // Sem áudio no aparelho (ou bloqueado): o treino segue em silêncio.
  }
}
