import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import OrderChat from "../components/OrderChat.jsx";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import {
  apiBase,
  readJson,
  apiErrorMessage,
  formatPrice,
  formatDate,
  formatDateTime,
  estadoClasse,
} from "../lib/api.js";

const ACOES_NOTA = ["recusar", "cancelar"];

function acoesDisponiveis(papel, estado) {
  if (papel === "prestador") {
    if (estado === "Submetido") return ["aceitar", "recusar", "cancelar"];
    if (estado === "Aceite") return ["iniciar", "cancelar"];
    if (estado === "Em execução") return ["concluir"];
  }
  if (papel === "cliente") {
    if (estado === "Submetido" || estado === "Aceite") return ["cancelar"];
    if (estado === "Aguarda confirmação") return ["confirmar"];
  }
  return [];
}

const ETIQUETAS = {
  aceitar: "Aceitar pedido",
  recusar: "Recusar pedido",
  iniciar: "Iniciar execução",
  concluir: "Comunicar conclusão",
  confirmar: "Confirmar conclusão",
  cancelar: "Cancelar pedido",
};

const MENSAGENS = {
  aceitar: "Pedido aceite.",
  recusar: "Pedido recusado.",
  iniciar: "Execução iniciada.",
  concluir: "Conclusão comunicada ao cliente.",
  confirmar: "Pedido concluído. Obrigado!",
  cancelar: "Pedido cancelado.",
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [acaoPendente, setAcaoPendente] = useState(null);
  const [nota, setNota] = useState("");
  const [classificacao, setClassificacao] = useState(5);
  const [comentario, setComentario] = useState("");
  const [mensagem, setMensagem] = useState({ text: "", kind: "success" });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError("");

    user.getIdToken()
      .then((token) =>
        fetch(`${apiBase}/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(readJson)
      .then((data) => {
        if (cancelado) return;
        if (data.error) setError(data.error);
        else setPedido(data);
      })
      .catch(() => {
        if (!cancelado) setError("Não foi possível carregar este pedido.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [user, id]);

  async function aplicar(acao, notaTexto = "") {
    setMensagem({ text: "", kind: "success" });
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/orders/${id}/transicoes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ acao, nota: notaTexto }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao atualizar o pedido"));

      setPedido(data);
      setAcaoPendente(null);
      setNota("");
      setMensagem({ text: MENSAGENS[acao] || "Pedido atualizado.", kind: "success" });
    } catch (err) {
      setMensagem({ text: err.message || "Erro ao atualizar o pedido.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleReviewSubmit(event) {
    event.preventDefault();
    setMensagem({ text: "", kind: "success" });
    setReviewBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/orders/${id}/avaliacao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ classificacao: Number(classificacao), comentario }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao enviar avaliação"));

      setPedido(data);
      setMensagem({ text: "Avaliação enviada. Obrigado!", kind: "success" });
    } catch (err) {
      setMensagem({ text: err.message || "Erro ao enviar avaliação.", kind: "error" });
    } finally {
      setReviewBusy(false);
    }
  }

  function escolherAcao(acao) {
    if (ACOES_NOTA.includes(acao)) {
      setAcaoPendente(acao);
      setNota("");
      setMensagem({ text: "", kind: "success" });
      return;
    }
    aplicar(acao);
  }

  function confirmarAcaoComNota(event) {
    event.preventDefault();
    aplicar(acaoPendente, nota);
  }

  if (!authReady || loading) {
    return <section className="catalog-page"><p className="catalog-count">A carregar pedido…</p></section>;
  }

  if (!user) {
    return (
      <section className="catalog-page">
        <p className="form-message error">Entra na tua conta para ver este pedido.</p>
        <Link className="submit-button" to="/conta">Iniciar sessão</Link>
      </section>
    );
  }

  if (error || !pedido) {
    return (
      <section className="catalog-page">
        <p className="form-message error">{error || "Pedido não encontrado."}</p>
        <Link className="link-button" to="/pedidos">← Voltar aos pedidos</Link>
      </section>
    );
  }

  const papel = pedido.prestadorId === user.uid ? "prestador" : pedido.clienteId === user.uid ? "cliente" : null;
  const acoes = papel ? acoesDisponiveis(papel, pedido.estado) : [];

  return (
    <section className="catalog-page">
      <nav className="breadcrumb" aria-label="Caminho">
        <Link to="/pedidos">Os meus pedidos</Link>
        <span>/</span>
        <span>Pedido</span>
      </nav>

      <div className="order-detail-grid">
        <div className="order-card">
          <div className="order-card-head">
            <div>
              <p className="catalog-card-category">{pedido.servico?.categoria?.nome || "Serviço"}</p>
              <h1>{pedido.servico?.titulo || "Serviço"}</h1>
            </div>
            <span className={`order-badge ${estadoClasse(pedido.estado)}`}>{pedido.estado}</span>
          </div>

          <p className="order-card-people">
            Cliente: <strong>{pedido.cliente?.nome}</strong>
            <span aria-hidden="true"> · </span>
            Prestador:{" "}
            <Link to={`/prestador/${pedido.prestador?.uid || ""}`}>
              <strong>{pedido.prestador?.nome}</strong>
            </Link>
          </p>

          <dl className="order-facts">
            <div>
              <dt>Descrição do trabalho</dt>
              <dd>{pedido.descricao}</dd>
            </div>
            <div>
              <dt>Morada</dt>
              <dd>{pedido.morada}</dd>
            </div>
            <div>
              <dt>Data desejada</dt>
              <dd>{formatDate(pedido.dataDesejada)}</dd>
            </div>
            <div>
              <dt>Preço</dt>
              <dd>{formatPrice(pedido.preco)}</dd>
            </div>
            <div>
              <dt>Pedido criado</dt>
              <dd>{formatDateTime(pedido.createdAt)}</dd>
            </div>
          </dl>

          {pedido.servico?._id && (
            <Link className="link-button" to={`/servico/${pedido.servico._id}`}>Ver página do serviço</Link>
          )}
        </div>

        <div className="order-card order-actions">
          <h2>Ações do pedido</h2>
          <p className="order-role">
            Estás a ver este pedido como <strong>{papel === "prestador" ? "prestador" : "cliente"}</strong>.
          </p>

          {mensagem.text && <p className={`form-message ${mensagem.kind}`}>{mensagem.text}</p>}

          {acoes.length === 0 && (
            <p className="field-hint">
              {pedido.estado === "Concluído"
                ? "Este pedido está concluído."
                : pedido.estado === "Recusado" || pedido.estado === "Cancelado"
                  ? "Este pedido já terminou."
                  : papel === "prestador" && pedido.estado === "Aguarda confirmação"
                    ? "Aguardas que o cliente confirme a conclusão do trabalho."
                    : "Não há ações disponíveis neste momento."}
            </p>
          )}

          {acoes.length > 0 && !acaoPendente && (
            <div className="order-action-buttons">
              {acoes.map((acao) => (
                <button
                  key={acao}
                  className="submit-button"
                  type="button"
                  onClick={() => escolherAcao(acao)}
                  disabled={busy}
                >
                  {ETIQUETAS[acao]}
                </button>
              ))}
            </div>
          )}

          {acaoPendente && (
            <form onSubmit={confirmarAcaoComNota} className="order-note-form">
              <label>
                {acaoPendente === "cancelar" ? "Motivo do cancelamento" : "Motivo da recusa"}
                <textarea
                  rows={3}
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  required={acaoPendente === "cancelar" && papel === "prestador"}
                  placeholder={acaoPendente === "cancelar" ? "Explica porque estás a cancelar" : "Opcional"}
                />
              </label>
              <button className="submit-button" type="submit" disabled={busy}>
                {busy ? "A guardar…" : `Confirmar: ${ETIQUETAS[acaoPendente]}`}
              </button>
              <button
                className="submit-button"
                type="button"
                onClick={() => { setAcaoPendente(null); setNota(""); }}
                disabled={busy}
              >
                Voltar
              </button>
            </form>
          )}

          {pedido.estado === "Concluído" && papel === "cliente" && (
            pedido.avaliacao ? (
              <div className="my-review">
                <h3>A tua avaliação</h3>
                <p className="review-stars" aria-label={`${pedido.avaliacao.classificacao} de 5`}>
                  {"★".repeat(pedido.avaliacao.classificacao)}
                  <span className="review-stars-empty">{"★".repeat(5 - pedido.avaliacao.classificacao)}</span>
                </p>
                {pedido.avaliacao.comentario && <p>{pedido.avaliacao.comentario}</p>}
              </div>
            ) : (
              <form className="review-form" onSubmit={handleReviewSubmit}>
                <h3>Avaliar o serviço</h3>
                <label>
                  Classificação
                  <select
                    value={classificacao}
                    onChange={(event) => setClassificacao(Number(event.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((valor) => (
                      <option key={valor} value={valor}>
                        {"★".repeat(valor)} ({valor}/5)
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Comentário (opcional)
                  <textarea
                    rows={3}
                    value={comentario}
                    onChange={(event) => setComentario(event.target.value)}
                    placeholder="Conta como foi a experiência"
                  />
                </label>
                <button className="submit-button" type="submit" disabled={reviewBusy}>
                  {reviewBusy ? "A enviar…" : "Enviar avaliação"}
                </button>
              </form>
            )
          )}
        </div>
      </div>

      {papel && <OrderChat orderId={id} user={user} />}

      <div className="order-history">
        <h2>Histórico de estados</h2>
        <ol className="order-timeline">
          {pedido.historico.map((entrada, index) => (
            <li key={index}>
              <span className={`timeline-dot ${estadoClasse(entrada.para)}`} aria-hidden="true" />
              <div>
                <strong>{entrada.de ? `${entrada.de} → ${entrada.para}` : entrada.para}</strong>
                <small>{formatDateTime(entrada.data)} · {entrada.autorNome}</small>
                {entrada.nota && <p>{entrada.nota}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
