// Arquivo <-> base64, para os anexos do post da atividade (o back recebe e
// devolve JSON, como a capa da turma).

/** O arquivo escolhido no <input type="file">, como data URL (base64). */
export function lerComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result));
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

/** Baixa um arquivo que veio em base64: download, nunca abre na aba. */
export function baixarBase64(nome: string, tipo: string, conteudo: string): void {
  const bytes = Uint8Array.from(atob(conteudo), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "812 KB", "1,4 MB". */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** ISO -> o valor de um <input type="datetime-local"> (hora local). */
export function paraDataLocal(iso: string | null): string {
  if (!iso) return '';
  const data = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}T${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

/** O valor do datetime-local -> ISO; vazio = null. */
export function deDataLocal(valor: string): string | null {
  return valor ? new Date(valor).toISOString() : null;
}
