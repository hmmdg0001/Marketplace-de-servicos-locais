import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { apiBase, readJson, apiErrorMessage, formatDateTime } from "../lib/api.js";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Card, CardContent } from "./ui/card.jsx";

// Conversa entre o cliente e o prestador, limitada a este pedido.
export default function OrderChat({ orderId, user }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const listaRef = useRef(null);

  async function carregar() {
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/orders/${orderId}/mensagens`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao carregar mensagens"));
      setMensagens(Array.isArray(data) ? data : []);
    } catch (err) {
      // Nas atualizações em segundo plano não inundamos o ecrã com erros.
      console.error("Erro ao carregar mensagens:", err);
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 5000);
    return () => clearInterval(intervalo);
  }, [orderId, user]);

  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [mensagens.length]);

  async function enviar(event) {
    event.preventDefault();
    const limpo = texto.trim();
    if (!limpo) return;

    setEnviando(true);
    setErro("");
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/orders/${orderId}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ texto: limpo }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao enviar mensagem"));
      setTexto("");
      await carregar();
    } catch (err) {
      setErro(err.message || "Erro ao enviar mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="mt-8">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold text-brand-navy">Conversa sobre o pedido</h2>
          <span className="text-sm text-brand-muted">
            {mensagens.length} {mensagens.length === 1 ? "mensagem" : "mensagens"}
          </span>
        </div>

        <div ref={listaRef} className="mt-5 max-h-96 space-y-3 overflow-y-auto pr-1">
          {mensagens.length === 0 ? (
            <p className="rounded-xl border border-dashed border-brand-line p-6 text-center text-sm text-brand-muted">
              Ainda não há mensagens. Escreve a primeira para combinarem os detalhes.
            </p>
          ) : (
            mensagens.map((mensagem) => {
              const propria = mensagem.remetenteUid === user.uid;
              return (
                <div
                  key={mensagem._id}
                  className={`max-w-[80%] rounded-2xl p-4 ${propria ? "ml-auto bg-primary/10" : "bg-brand-mist"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <strong className="text-brand-navy">{propria ? "Tu" : mensagem.remetenteNome}</strong>
                    <span className="text-brand-muted">{formatDateTime(mensagem.criadoEm)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink">{mensagem.texto}</p>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={enviar} className="mt-5 flex gap-3">
          <Input
            type="text"
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Escreve uma mensagem…"
            maxLength={2000}
            aria-label="Mensagem"
            required
          />
          <Button type="submit" disabled={enviando} className="shrink-0">
            {enviando ? "A enviar…" : "Enviar"} <Send className="h-4 w-4" />
          </Button>
        </form>
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
      </CardContent>
    </Card>
  );
}
