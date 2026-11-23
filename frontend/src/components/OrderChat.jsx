import { useEffect, useRef, useState } from "react";
import { apiBase, readJson, apiErrorMessage, formatDateTime } from "../lib/api.js";

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
    <div className="order-chat">
      <div className="reviews-head">
        <h2>Conversa sobre o pedido</h2>
        <span>{mensagens.length} mensagem(ns)</span>
      </div>

      <div className="chat-messages" ref={listaRef}>
        {mensagens.length === 0 ? (
          <p className="catalog-empty">Ainda não há mensagens. Escreve a primeira para combinarem os detalhes.</p>
        ) : (
          mensagens.map((mensagem) => {
            const propria = mensagem.remetenteUid === user.uid;
            return (
              <div key={mensagem._id} className={`chat-bubble ${propria ? "propria" : "alheia"}`}>
                <div className="chat-meta">
                  <strong>{propria ? "Tu" : mensagem.remetenteNome}</strong>
                  <span>{formatDateTime(mensagem.criadoEm)}</span>
                </div>
                <p>{mensagem.texto}</p>
              </div>
            );
          })
        )}
      </div>

      <form className="chat-form" onSubmit={enviar}>
        <input
          type="text"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Escreve uma mensagem…"
          maxLength={2000}
          aria-label="Mensagem"
          required
        />
        <button className="submit-button compact-button" type="submit" disabled={enviando}>
          {enviando ? "A enviar…" : "Enviar"}
        </button>
      </form>
      {erro && <p className="form-message error" role="status">{erro}</p>}
    </div>
  );
}
