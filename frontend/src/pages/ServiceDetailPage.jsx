import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { apiBase, readJson, apiErrorMessage, formatPrice, formatDate } from "../lib/api.js";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function horaCurta(iso) {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
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
    return <section className="catalog-page"><p className="catalog-count">A carregar serviço…</p></section>;
  }

  if (error || !service) {
    return (
      <section className="catalog-page">
        <p className="form-message error">{error || "Serviço não encontrado."}</p>
        <Link className="link-button" to="/">← Voltar ao catálogo</Link>
      </section>
    );
  }

  const media = service.prestador?.mediaAvaliacoes || 0;
  const totalAvaliacoes = service.prestador?.totalAvaliacoes || 0;
  const proprio = user?.uid === service.prestador?.uid;

  return (
    <section className="catalog-page">
      <nav className="breadcrumb" aria-label="Caminho">
        <Link to="/">Explorar</Link>
        <span>/</span>
        <Link to={`/?categoria=${service.categoria?.slug || ""}`}>{service.categoria?.nome || "Serviço"}</Link>
      </nav>

      <div className="service-detail">
        <div className="service-detail-gallery" aria-label="Fotografias do serviço">
          {service.imagens && service.imagens.length > 0 ? (
            <div className="gallery">
              <img src={service.imagens[0]} alt={service.titulo} className="gallery-main" />
              {service.imagens.length > 1 && (
                <div className="gallery-thumbs">
                  {service.imagens.slice(1).map((img, i) => (
                    <img key={i} src={img} alt={`${service.titulo} ${i + 2}`} className="gallery-thumb" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="gallery-placeholder">Sem fotografias</div>
          )}
        </div>

        <div className="service-detail-info">
          <p className="catalog-card-category">{service.categoria?.nome}</p>
          <h1>{service.titulo}</h1>
          <p className="service-detail-provider">
            Prestador:{" "}
            <Link to={`/prestador/${service.prestador?.uid || ""}`}>
              <strong>{service.prestador?.nome}</strong>
            </Link>
            {" · "}
            📍 {service.zona || service.prestador?.zona}
          </p>

          <p className="service-detail-rating">
            {totalAvaliacoes > 0
              ? `Classificação: ${media.toFixed(1)}/5 (${totalAvaliacoes} avaliações)`
              : "Ainda sem avaliações"}
          </p>

          <p className="service-detail-description">{service.descricao}</p>

          {!service.ativo && <p className="form-message error">Este serviço está desativado.</p>}

          <p className="service-detail-price">Desde <strong>{formatPrice(service.preco)}</strong></p>

          {authReady && !user && (
            <>
              <Link className="submit-button" to="/conta">Inicia sessão para pedir este serviço</Link>
              <p className="service-detail-note">Precisas de conta para enviar um pedido ao prestador.</p>
            </>
          )}

          {user && proprio && (
            <p className="form-message">Este é um dos teus serviços.</p>
          )}

          {user && !proprio && service.ativo && !showForm && (
            <button className="submit-button" type="button" onClick={abrirFormulario}>
              Pedir este serviço
            </button>
          )}

          {user && !proprio && service.ativo && showForm && (
            <div className="order-form-panel">
              <h3>Enviar pedido ao prestador</h3>
              <div className="booking-steps" aria-label="Passos da marcação">
                <span className={etapa === 1 ? "ativo" : ""}>1. Dados</span>
                {temParametros && <span className={etapa === 2 ? "ativo" : ""}>2. Duração</span>}
                <span className={etapa === 3 ? "ativo" : ""}>{temParametros ? "3. Horário" : "2. Horário"}</span>
              </div>

              <form onSubmit={handleOrderSubmit}>
                {etapa === 1 && (
                  <>
                    <label>
                      Descrição do trabalho
                      <textarea
                        rows={4}
                        required
                        value={dados.descricao}
                        onChange={(event) => atualizarDado("descricao", event.target.value)}
                        placeholder="Explica o que precisas, o tamanho do espaço, etc."
                      />
                    </label>
                    <label>
                      Data desejada
                      <input
                        type="date"
                        min={hoje()}
                        required
                        value={dados.dataDesejada}
                        onChange={(event) => atualizarDado("dataDesejada", event.target.value)}
                      />
                    </label>
                    <label>
                      Morada
                      <input
                        type="text"
                        required
                        value={dados.morada}
                        onChange={(event) => atualizarDado("morada", event.target.value)}
                        placeholder="Rua, número, código postal"
                      />
                    </label>
                    <button className="submit-button" type="button" onClick={avancarDados} disabled={busy}>
                      {busy ? "A calcular…" : "Continuar"}
                    </button>
                    <button className="submit-button" type="button" onClick={() => setShowForm(false)} disabled={busy}>
                      Cancelar
                    </button>
                  </>
                )}

                {etapa === 2 && temParametros && (
                  <>
                    {tipo === "por_m2" ? (
                      <label>
                        Área a tratar (m²)
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          required
                          value={parametros.area}
                          onChange={(event) => alterarParametro("area", event.target.value)}
                          placeholder="Ex: 80"
                        />
                      </label>
                    ) : (
                      <label>
                        Tipo de veículo
                        <select
                          required
                          value={parametros.opcao}
                          onChange={(event) => alterarParametro("opcao", event.target.value)}
                        >
                          <option value="" disabled>Escolhe uma opção</option>
                          {Object.entries(opcoes).map(([nome]) => (
                            <option key={nome} value={nome}>{nome}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    <p className="duracao-estimada">
                      Duração estimada: <strong>{duracao ? `${duracao.tempoTotal} min` : "por calcular"}</strong>
                    </p>
                    <button className="submit-button" type="button" onClick={avancarParametros} disabled={busy}>
                      {busy ? "A procurar horários…" : "Ver horários disponíveis"}
                    </button>
                    <button className="submit-button" type="button" onClick={() => setEtapa(1)} disabled={busy}>
                      Voltar
                    </button>
                  </>
                )}

                {etapa === 3 && (
                  <>
                    <p className="duracao-estimada">
                      Duração estimada: <strong>{duracao ? `${duracao.tempoTotal} min` : "por calcular"}</strong>
                      {" · "}Horários das 09h às 18h, em dias úteis.
                    </p>

                    {aCarregarSlots ? (
                      <p className="catalog-count">A carregar horários…</p>
                    ) : slots.length === 0 ? (
                      <p className="catalog-empty">Não há horários disponíveis para esta data e duração.</p>
                    ) : (
                      <div className="slot-grid">
                        {slots.map((slot) => (
                          <button
                            key={slot.inicio}
                            type="button"
                            className={slotEscolhido === slot.inicio ? "slot selecionado" : "slot"}
                            onClick={() => setSlotEscolhido(slot.inicio)}
                          >
                            {horaCurta(slot.inicio)}
                          </button>
                        ))}
                      </div>
                    )}

                    <p className="field-hint">O valor do serviço é {formatPrice(service.preco)}. O prestador aceita ou recusa o pedido.</p>
                    {orderError && <p className="form-message error" role="status">{orderError}</p>}
                    <button className="submit-button" type="submit" disabled={busy || !slotEscolhido}>
                      {busy ? "A enviar…" : "Enviar pedido"}
                    </button>
                    <button className="submit-button" type="button" onClick={() => setEtapa(temParametros ? 2 : 1)} disabled={busy}>
                      Voltar
                    </button>
                  </>
                )}

                {etapa !== 3 && orderError && <p className="form-message error" role="status">{orderError}</p>}
              </form>
            </div>
          )}
        </div>
      </div>

      {service.prestador?.bio && (
        <div className="provider-card">
          <h3>Sobre o prestador</h3>
          <p>{service.prestador.bio}</p>
          <p className="provider-card-meta">
            {service.prestador.nome} · {service.prestador.zona}
            {totalAvaliacoes > 0 ? ` · ${media.toFixed(1)}/5` : ""}
          </p>
          <Link className="provider-card-link" to={`/prestador/${service.prestador?.uid || ""}`}>
            Ver perfil completo →
          </Link>
        </div>
      )}

      <div className="reviews-section">
        <div className="reviews-head">
          <h2>Avaliações</h2>
          <span>
            {avaliacoes.length > 0
              ? `${media.toFixed(1)}/5 · ${avaliacoes.length} ${avaliacoes.length === 1 ? "avaliação verificada" : "avaliações verificadas"}`
              : "Ainda sem avaliações"}
          </span>
        </div>

        {avaliacoes.length === 0 ? (
          <p className="field-hint">As avaliações aparecem aqui depois de um pedido ser concluído.</p>
        ) : (
          <ul className="review-list">
            {avaliacoes.map((avaliacao) => (
              <li key={avaliacao._id} className="review-item">
                <div className="review-top">
                  <strong>{avaliacao.cliente?.nome}</strong>
                  <span className="verified-badge">Avaliação verificada</span>
                </div>
                <p className="review-stars" aria-label={`${avaliacao.classificacao} de 5`}>
                  {"★".repeat(avaliacao.classificacao)}
                  <span className="review-stars-empty">{"★".repeat(5 - avaliacao.classificacao)}</span>
                </p>
                {avaliacao.comentario && <p className="review-comment">{avaliacao.comentario}</p>}
                <small className="review-date">{formatDate(avaliacao.createdAt)}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
