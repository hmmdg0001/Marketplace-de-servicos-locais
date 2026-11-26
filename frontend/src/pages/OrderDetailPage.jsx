import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import OrderChat from "../components/OrderChat.jsx";
import { onAuthStateChanged } from "firebase/auth";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquareText,
  Star,
} from "lucide-react";
import { auth } from "../firebase.js";
import { apiBase, readJson, apiErrorMessage, formatPrice, formatDate, formatDateTime } from "../lib/api.js";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

const ACOES_NOTA = ["recusar", "cancelar"];

const COR_ESTADO = {
  Submetido: "bg-sky-50 text-sky-700",
  Aceite: "bg-indigo-50 text-indigo-700",
  "Em execução": "bg-amber-50 text-amber-700",
  "Aguarda confirmação": "bg-violet-50 text-violet-700",
  "Concluído": "bg-emerald-50 text-emerald-700",
  Recusado: "bg-red-50 text-red-700",
  Cancelado: "bg-slate-100 text-slate-600",
};

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
    return <div className="min-h-screen bg-brand-mist py-20 text-center text-brand-muted">A carregar pedido…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-mist px-5 py-20 text-center">
        <p className="text-brand-muted">Entra na tua conta para ver este pedido.</p>
        <Button asChild className="mt-6">
          <Link to="/conta">Iniciar sessão</Link>
        </Button>
      </div>
    );
  }

  if (error || !pedido) {
    return (
      <div className="min-h-screen bg-brand-mist px-5 py-20 text-center">
        <p className="text-brand-muted">{error || "Pedido não encontrado."}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/pedidos">← Voltar aos pedidos</Link>
        </Button>
      </div>
    );
  }

  const papel =
    pedido.papel ||
    (pedido.prestadorId === user.uid ? "prestador" : pedido.clienteId === user.uid ? "cliente" : null);
  const acoes = papel ? acoesDisponiveis(papel, pedido.estado) : [];
  const rotuloPapel =
    papel === "prestador" ? "prestador" : papel === "admin" ? "administrador (suporte)" : "cliente";

  const factos = [
    ["Descrição do trabalho", pedido.descricao],
    ["Morada", pedido.morada],
    ["Data desejada", formatDate(pedido.dataDesejada)],
    pedido.inicio && ["Horário reservado", `${formatDateTime(pedido.inicio)} – ${formatDateTime(pedido.fim)}`],
    pedido.tempo_total_calculado > 0 && ["Duração estimada", `${pedido.tempo_total_calculado} min`],
    pedido.parametros_tempo?.area !== undefined && ["Área", `${pedido.parametros_tempo.area} m²`],
    pedido.parametros_tempo?.opcao && ["Opção escolhida", pedido.parametros_tempo.opcao],
    ["Preço", formatPrice(pedido.preco)],
    ["Pedido criado", formatDateTime(pedido.createdAt)],
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-brand-mist font-sans text-brand-ink [&_a]:no-underline">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <nav className="flex items-center gap-2 text-sm text-brand-muted" aria-label="Caminho">
          <Link to="/pedidos" className="hover:text-primary">Os meus pedidos</Link>
          <span>/</span>
          <span>Pedido</span>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <Card className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {pedido.servico?.categoria?.nome || "Serviço"}
                </span>
                <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-navy md:text-4xl">
                  {pedido.servico?.titulo || "Serviço"}
                </h1>
              </div>
              <Badge className={`border-transparent ${COR_ESTADO[pedido.estado] || "bg-brand-mist text-brand-muted"}`}>
                {pedido.estado}
              </Badge>
            </div>

            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-muted">
              <span>Cliente: <strong className="text-brand-ink">{pedido.cliente?.nome}</strong></span>
              <span>
                Prestador:{" "}
                <Link to={`/prestador/${pedido.prestador?.uid || ""}`} className="font-semibold text-primary hover:underline">
                  {pedido.prestador?.nome}
                </Link>
              </span>
            </p>

            <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-brand-line pt-6 sm:grid-cols-2">
              {factos.map(([titulo, valor]) => (
                <div key={titulo}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-brand-muted">{titulo}</dt>
                  <dd className="mt-1 text-sm text-brand-ink">{valor}</dd>
                </div>
              ))}
            </dl>

            {pedido.servico?._id && (
              <Button asChild variant="outline" size="sm" className="mt-7">
                <Link to={`/servico/${pedido.servico._id}`}>Ver página do serviço</Link>
              </Button>
            )}
          </Card>

          <Card className="p-6 md:p-8">
            <h2 className="font-display text-xl font-bold text-brand-navy">Ações do pedido</h2>
            <p className="mt-2 text-sm text-brand-muted">Estás a ver este pedido como <strong className="text-brand-ink">{rotuloPapel}</strong>.</p>

            {mensagem.text && (
              <p className={`mt-4 rounded-lg p-3 text-sm ${mensagem.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                {mensagem.text}
              </p>
            )}

            {acoes.length === 0 && (
              <p className="mt-4 text-sm text-brand-muted">
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
              <div className="mt-5 flex flex-wrap gap-3">
                {acoes.map((acao) => (
                  <Button
                    key={acao}
                    type="button"
                    variant={acao === "recusar" || acao === "cancelar" ? "outline" : "default"}
                    onClick={() => escolherAcao(acao)}
                    disabled={busy}
                  >
                    {ETIQUETAS[acao]}
                  </Button>
                ))}
              </div>
            )}

            {acaoPendente && (
              <form onSubmit={confirmarAcaoComNota} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold text-brand-muted">
                    {acaoPendente === "cancelar" ? "Motivo do cancelamento" : "Motivo da recusa"}
                  </span>
                  <textarea
                    rows={3}
                    value={nota}
                    onChange={(event) => setNota(event.target.value)}
                    required={acaoPendente === "cancelar" && papel === "prestador"}
                    placeholder={acaoPendente === "cancelar" ? "Explica porque estás a cancelar" : "Opcional"}
                    className="mt-2 w-full rounded-lg border border-brand-line bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={busy}>
                    {busy ? "A guardar…" : `Confirmar: ${ETIQUETAS[acaoPendente]}`}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setAcaoPendente(null); setNota(""); }} disabled={busy}>
                    Voltar
                  </Button>
                </div>
              </form>
            )}

            {pedido.estado === "Concluído" && papel === "cliente" && (
              pedido.avaliacao ? (
                <div className="mt-6 rounded-xl bg-brand-mist p-5">
                  <h3 className="font-display font-bold text-brand-navy">A tua avaliação</h3>
                  <p className="mt-2 inline-flex items-center gap-1 text-amber-500">
                    {Array.from({ length: pedido.avaliacao.classificacao }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </p>
                  {pedido.avaliacao.comentario && <p className="mt-2 text-sm text-brand-muted">{pedido.avaliacao.comentario}</p>}
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="mt-6 space-y-4 border-t border-brand-line pt-6">
                  <h3 className="font-display font-bold text-brand-navy">Avaliar o serviço</h3>
                  <label className="block">
                    <span className="text-xs font-semibold text-brand-muted">Classificação</span>
                    <select
                      value={classificacao}
                      onChange={(event) => setClassificacao(Number(event.target.value))}
                      className="mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary"
                    >
                      {[5, 4, 3, 2, 1].map((valor) => (
                        <option key={valor} value={valor}>{"★".repeat(valor)} ({valor}/5)</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-brand-muted">Comentário (opcional)</span>
                    <textarea
                      rows={3}
                      value={comentario}
                      onChange={(event) => setComentario(event.target.value)}
                      placeholder="Conta como foi a experiência"
                      className="mt-2 w-full rounded-lg border border-brand-line bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <Button type="submit" disabled={reviewBusy}>
                    {reviewBusy ? "A enviar…" : "Enviar avaliação"}
                  </Button>
                </form>
              )
            )}
          </Card>
        </div>

        {papel && <OrderChat orderId={id} user={user} />}

        <Card className="mt-8 p-6 md:p-8">
          <h2 className="font-display text-xl font-bold text-brand-navy">Histórico de estados</h2>
          <ol className="mt-5 space-y-4">
            {pedido.historico.map((entrada, index) => (
              <li key={index} className="flex gap-4">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <div>
                  <strong className="block text-sm text-brand-ink">
                    {entrada.de ? `${entrada.de} → ${entrada.para}` : entrada.para}
                  </strong>
                  <p className="mt-0.5 inline-flex flex-wrap items-center gap-2 text-xs text-brand-muted">
                    <CalendarDays className="h-3.5 w-3.5" /> {formatDateTime(entrada.data)} · {entrada.autorNome}
                  </p>
                  {entrada.nota && <p className="mt-1 text-sm text-brand-muted">{entrada.nota}</p>}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 inline-flex items-center gap-2 text-xs text-brand-muted">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Cada alteração fica registada com autor e data.
          </p>
        </Card>

        <p className="mt-6 flex items-center gap-2 text-xs text-brand-muted">
          <MessageSquareText className="h-4 w-4 text-primary" />
          <Clock3 className="h-4 w-4 text-primary" /> A conversa é privada entre cliente, prestador e suporte.
        </p>
      </div>
    </div>
  );
}
