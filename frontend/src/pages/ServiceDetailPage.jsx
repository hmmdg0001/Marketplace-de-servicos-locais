import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";
import { auth } from "../firebase.js";
import { apiBase, readJson, apiErrorMessage, formatPrice, formatDate } from "../lib/api.js";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import { Input } from "../components/ui/input.jsx";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function horaCurta(iso) {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function Estrelas({ nota, vazias = 0 }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${nota} de 5`}>
      {Array.from({ length: nota }).map((_, i) => (
        <Star key={`cheia-${i}`} className="h-4 w-4 fill-current" />
      ))}
      {Array.from({ length: vazias }).map((_, i) => (
        <Star key={`vazia-${i}`} className="h-4 w-4 text-brand-line" />
      ))}
    </span>
  );
}

export default function ServiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [orderError, setOrderError] = useState("");

  // Fluxo de marcação: 1 = dados, 2 = parâmetros de tempo, 3 = horário.
  const [etapa, setEtapa] = useState(1);
  const [dados, setDados] = useState({ descricao: "", morada: "", dataDesejada: "" });
  const [parametros, setParametros] = useState({ area: "", opcao: "" });
  const [duracao, setDuracao] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotEscolhido, setSlotEscolhido] = useState("");
  const [aCarregarSlots, setACarregarSlots] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError("");

    fetch(`${apiBase}/services/${id}`)
      .then(readJson)
      .then((data) => {
        if (cancelado) return;
        if (data.error) setError(data.error);
        else setService(data);
      })
      .catch(() => {
        if (!cancelado) setError("Não foi possível carregar este serviço.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => { cancelado = true; };
  }, [id]);

  useEffect(() => {
    let cancelado = false;
    fetch(`${apiBase}/services/${id}/avaliacoes`)
      .then(readJson)
      .then((data) => { if (!cancelado && Array.isArray(data)) setAvaliacoes(data); })
      .catch((err) => console.error("Erro ao carregar avaliações:", err));
    return () => { cancelado = true; };
  }, [id]);

  const tipo = service?.regras_tempo?.tipo || "fixo";
  const opcoes = service?.regras_tempo?.opcoes || {};
  const temParametros = tipo !== "fixo";

  function abrirFormulario() {
    setDados({ descricao: "", morada: "", dataDesejada: "" });
    setParametros({ area: "", opcao: "" });
    setDuracao(null);
    setSlots([]);
    setSlotEscolhido("");
    setEtapa(1);
    setOrderError("");
    setShowForm(true);
  }

  function atualizarDado(campo, valor) {
    setDados((prev) => ({ ...prev, [campo]: valor }));
  }

  async function calcular(params) {
    const res = await fetch(`${apiBase}/services/${id}/duracao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.error || "Não foi possível calcular a duração");
    setDuracao(data);
    return data;
  }

  async function carregarSlots(minutos) {
    setACarregarSlots(true);
    setSlots([]);
    setSlotEscolhido("");
    try {
      const params = new URLSearchParams({
        prestadorId: service.prestador?.uid || service.prestadorId || "",
        clienteId: user?.uid || "",
        data: dados.dataDesejada,
        duracao: String(minutos),
      });
      const data = await fetch(`${apiBase}/agenda/slots?${params.toString()}`).then(readJson);
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch (err) {
      setOrderError("Não foi possível carregar os horários.");
    } finally {
      setACarregarSlots(false);
    }
  }

  async function avancarDados(event) {
    event.preventDefault();
    setOrderError("");
    setBusy(true);
    try {
      if (tipo === "fixo") {
        const calculado = await calcular({});
        setEtapa(3);
        await carregarSlots(calculado.tempoTotal);
      } else {
        setEtapa(2);
      }
    } catch (err) {
      setOrderError(err.message || "Erro ao calcular a duração.");
    } finally {
      setBusy(false);
    }
  }

  function alterarParametro(campo, valor) {
    const proximo = { ...parametros, [campo]: valor };
    setParametros(proximo);
    if ((campo === "area" && valor === "") || (campo === "opcao" && valor === "")) {
      setDuracao(null);
      return;
    }
    calcular(
      tipo === "por_m2" ? { area: Number(proximo.area) } : { opcao: proximo.opcao }
    ).catch(() => setDuracao(null));
  }

  async function avancarParametros() {
    setOrderError("");
    setBusy(true);
    try {
      const calculado = await calcular(
        tipo === "por_m2" ? { area: Number(parametros.area) } : { opcao: parametros.opcao }
      );
      setEtapa(3);
      await carregarSlots(calculado.tempoTotal);
    } catch (err) {
      setOrderError(err.message || "Erro ao calcular a duração.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOrderSubmit(event) {
    event.preventDefault();
    if (etapa !== 3) return;
    setOrderError("");
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const parametrosTempo =
        tipo === "por_m2"
          ? { area: Number(parametros.area) }
          : tipo === "opcoes"
            ? { opcao: parametros.opcao }
            : {};

      const res = await fetch(`${apiBase}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          servicoId: service._id,
          descricao: dados.descricao,
          dataDesejada: dados.dataDesejada,
          morada: dados.morada,
          inicio: slotEscolhido,
          parametrosTempo,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao enviar pedido"));
      navigate(`/pedidos/${data._id}`);
    } catch (err) {
      setOrderError(err.message || "Erro ao enviar pedido.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-brand-mist py-20 text-center text-brand-muted">A carregar serviço…</div>;
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-brand-mist px-5 py-20 text-center">
        <p className="text-brand-muted">{error || "Serviço não encontrado."}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">← Voltar ao catálogo</Link>
        </Button>
      </div>
    );
  }

  const media = service.prestador?.mediaAvaliacoes || 0;
  const totalAvaliacoes = service.prestador?.totalAvaliacoes || 0;
  const proprio = user?.uid === service.prestador?.uid;
  const etapas = temParametros ? ["Dados", "Duração", "Horário"] : ["Dados", "Horário"];

  return (
    <div className="min-h-screen bg-brand-mist font-sans text-brand-ink [&_a]:no-underline">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <nav className="flex items-center gap-2 text-sm text-brand-muted" aria-label="Caminho">
          <Link to="/" className="hover:text-primary">Explorar</Link>
          <span>/</span>
          <Link to={`/?categoria=${service.categoria?.slug || ""}`} className="hover:text-primary">
            {service.categoria?.nome || "Serviço"}
          </Link>
        </nav>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            {service.imagens?.length > 0 ? (
              <>
                <img src={service.imagens[0]} alt={service.titulo} className="h-[360px] w-full object-cover md:h-[420px]" />
                {service.imagens.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-3">
                    {service.imagens.slice(1).map((img, i) => (
                      <img key={i} src={img} alt={`${service.titulo} ${i + 2}`} className="h-16 w-20 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-[360px] items-center justify-center text-brand-muted">Sem fotografias</div>
            )}
          </div>

          <div>
            <Badge variant="outline" className="uppercase tracking-widest text-brand-muted">
              {service.categoria?.nome || "Serviço"}
            </Badge>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight tracking-tight text-brand-navy md:text-5xl">
              {service.titulo}
            </h1>
            <p className="mt-4 text-sm text-brand-muted">
              Prestador:{" "}
              <Link to={`/prestador/${service.prestador?.uid || ""}`} className="font-semibold text-primary hover:underline">
                {service.prestador?.nome}
              </Link>
              <span className="mx-2">·</span>
              <MapPin className="inline h-3.5 w-3.5" /> {service.zona || service.prestador?.zona}
            </p>

            <div className="mt-3 flex items-center gap-2 text-sm">
              {totalAvaliacoes > 0 ? (
                <>
                  <Estrelas nota={Math.round(media)} vazias={5 - Math.round(media)} />
                  <span className="text-brand-muted">{media.toFixed(1)}/5 · {totalAvaliacoes} avaliações</span>
                </>
              ) : (
                <span className="text-brand-muted">Ainda sem avaliações</span>
              )}
            </div>

            <p className="mt-6 leading-relaxed text-brand-muted">{service.descricao}</p>

            {!service.ativo && <p className="mt-4 text-sm text-red-600">Este serviço está desativado.</p>}

            <p className="mt-7 text-sm text-brand-muted">Desde</p>
            <p className="font-display text-3xl font-extrabold text-brand-navy">{formatPrice(service.preco)}</p>

            <div className="mt-7">
              {authReady && !user && (
                <div className="space-y-3">
                  <Button asChild size="lg" className="w-full">
                    <Link to="/conta">Inicia sessão para pedir este serviço <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                  <p className="text-xs text-brand-muted">Precisas de conta para enviar um pedido ao prestador.</p>
                </div>
              )}
              {user && proprio && (
                <p className="rounded-xl bg-white p-4 text-sm text-brand-muted shadow-card">Este é um dos teus serviços.</p>
              )}
              {user && !proprio && service.ativo && !showForm && (
                <Button size="lg" className="w-full" onClick={abrirFormulario}>
                  Pedir este serviço <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {user && !proprio && service.ativo && showForm && (
              <Card className="mt-6 p-6">
                <h2 className="font-display text-xl font-bold text-brand-navy">Enviar pedido ao prestador</h2>

                <ol className="mt-4 flex flex-wrap gap-2">
                  {etapas.map((nome, indice) => (
                    <li
                      key={nome}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        etapa === indice + 1 ? "bg-primary text-brand-navy" : "bg-brand-mist text-brand-muted"
                      }`}
                    >
                      {indice + 1}. {nome}
                    </li>
                  ))}
                </ol>

                <form onSubmit={handleOrderSubmit} className="mt-6 space-y-4">
                  {etapa === 1 && (
                    <>
                      <label className="block">
                        <span className="text-xs font-semibold text-brand-muted">Descrição do trabalho</span>
                        <textarea
                          rows={4}
                          required
                          value={dados.descricao}
                          onChange={(event) => atualizarDado("descricao", event.target.value)}
                          placeholder="Explica o que precisas, o tamanho do espaço, etc."
                          className="mt-2 w-full rounded-lg border border-brand-line bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-brand-muted">Data desejada</span>
                        <Input type="date" min={hoje()} required value={dados.dataDesejada} onChange={(event) => atualizarDado("dataDesejada", event.target.value)} className="mt-2" />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-brand-muted">Morada</span>
                        <Input type="text" required value={dados.morada} onChange={(event) => atualizarDado("morada", event.target.value)} placeholder="Rua, número, código postal" className="mt-2" />
                      </label>
                      <div className="flex flex-wrap gap-3 pt-2">
                        <Button type="button" onClick={avancarDados} disabled={busy}>
                          {busy ? "A calcular…" : "Continuar"} <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={busy}>
                          Cancelar
                        </Button>
                      </div>
                    </>
                  )}

                  {etapa === 2 && temParametros && (
                    <>
                      {tipo === "por_m2" ? (
                        <label className="block">
                          <span className="text-xs font-semibold text-brand-muted">Área a tratar (m²)</span>
                          <Input type="number" min="1" step="0.5" required value={parametros.area} onChange={(event) => alterarParametro("area", event.target.value)} placeholder="Ex: 80" className="mt-2" />
                        </label>
                      ) : (
                        <label className="block">
                          <span className="text-xs font-semibold text-brand-muted">Opção</span>
                          <select
                            required
                            value={parametros.opcao}
                            onChange={(event) => alterarParametro("opcao", event.target.value)}
                            className="mt-2 h-11 w-full rounded-lg border border-brand-line bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="" disabled>Escolhe uma opção</option>
                            {Object.entries(opcoes).map(([nome]) => (
                              <option key={nome} value={nome}>{nome}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <p className="flex items-center gap-2 rounded-xl bg-brand-mist p-4 text-sm text-brand-muted">
                        <Clock3 className="h-4 w-4 text-primary" />
                        Duração estimada: <strong className="text-brand-navy">{duracao ? `${duracao.tempoTotal} min` : "por calcular"}</strong>
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button type="button" onClick={avancarParametros} disabled={busy}>
                          {busy ? "A procurar horários…" : "Ver horários disponíveis"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEtapa(1)} disabled={busy}>Voltar</Button>
                      </div>
                    </>
                  )}

                  {etapa === 3 && (
                    <>
                      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-mist p-4 text-sm text-brand-muted">
                        <Clock3 className="h-4 w-4 text-primary" />
                        Duração estimada: <strong className="text-brand-navy">{duracao ? `${duracao.tempoTotal} min` : "por calcular"}</strong>
                        <span>· Horários das 09h às 18h, em dias úteis.</span>
                      </p>

                      {aCarregarSlots ? (
                        <p className="text-sm text-brand-muted">A carregar horários…</p>
                      ) : slots.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-brand-line p-6 text-center text-sm text-brand-muted">
                          Não há horários disponíveis para esta data e duração.
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                          {slots.map((slot) => (
                            <button
                              key={slot.inicio}
                              type="button"
                              onClick={() => setSlotEscolhido(slot.inicio)}
                              className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                                slotEscolhido === slot.inicio
                                  ? "border-primary bg-primary text-brand-navy"
                                  : "border-brand-line bg-white text-brand-navy hover:bg-brand-mist"
                              }`}
                            >
                              {horaCurta(slot.inicio)}
                            </button>
                          ))}
                        </div>
                      )}

                      <p className="text-xs text-brand-muted">O valor do serviço é {formatPrice(service.preco)}. O prestador aceita ou recusa o pedido.</p>
                      <div className="flex flex-wrap gap-3">
                        <Button type="submit" disabled={busy || !slotEscolhido}>
                          {busy ? "A enviar…" : "Enviar pedido"} <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setEtapa(temParametros ? 2 : 1)} disabled={busy}>
                          <ArrowLeft className="h-4 w-4" /> Voltar
                        </Button>
                      </div>
                    </>
                  )}

                  {orderError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{orderError}</p>}
                </form>
              </Card>
            )}
          </div>
        </div>

        {service.prestador?.bio && (
          <Card className="mt-10 p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-brand-navy">Sobre o prestador</h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-brand-muted">{service.prestador.bio}</p>
                <p className="mt-3 text-sm text-brand-muted">
                  {service.prestador.nome} · {service.prestador.zona}
                  {totalAvaliacoes > 0 ? ` · ${media.toFixed(1)}/5` : ""}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/prestador/${service.prestador?.uid || ""}`}>Ver perfil completo <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </Card>
        )}

        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-extrabold text-brand-navy">Avaliações</h2>
            <span className="text-sm text-brand-muted">
              {avaliacoes.length > 0
                ? `${media.toFixed(1)}/5 · ${avaliacoes.length} ${avaliacoes.length === 1 ? "avaliação verificada" : "avaliações verificadas"}`
                : "Ainda sem avaliações"}
            </span>
          </div>

          {avaliacoes.length === 0 ? (
            <p className="mt-5 text-sm text-brand-muted">As avaliações aparecem aqui depois de um pedido ser concluído.</p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {avaliacoes.map((avaliacao) => (
                <Card key={avaliacao._id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <strong className="text-sm text-brand-navy">{avaliacao.cliente?.nome}</strong>
                    <Badge variant="success"><CheckCircle2 className="h-3.5 w-3.5" /> Avaliação verificada</Badge>
                  </div>
                  <div className="mt-3"><Estrelas nota={avaliacao.classificacao} vazias={5 - avaliacao.classificacao} /></div>
                  {avaliacao.comentario && <p className="mt-3 text-sm leading-relaxed text-brand-muted">{avaliacao.comentario}</p>}
                  <p className="mt-4 text-xs text-brand-muted">{formatDate(avaliacao.createdAt)}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="mt-10 flex items-center gap-2 text-xs text-brand-muted">
          <ShieldCheck className="h-4 w-4 text-primary" /> Avaliações apenas de pedidos concluídos e verificados.
        </div>
      </div>
    </div>
  );
}
