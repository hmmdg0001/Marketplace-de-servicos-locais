import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { apiBase, readJson, apiErrorMessage, formatPrice, formatDate } from "../lib/api.js";

function hoje() {
  return new Date().toISOString().slice(0, 10);
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

    return () => {
      cancelado = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelado = false;

    fetch(`${apiBase}/services/${id}/avaliacoes`)
      .then(readJson)
      .then((data) => {
        if (!cancelado && Array.isArray(data)) setAvaliacoes(data);
      })
      .catch((err) => console.error("Erro ao carregar avaliações:", err));

    return () => {
      cancelado = true;
    };
  }, [id]);

  async function handleOrderSubmit(event) {
    event.preventDefault();
    setOrderError("");
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          servicoId: service._id,
          descricao: event.target.descricao.value,
          dataDesejada: event.target.dataDesejada.value,
          morada: event.target.morada.value,
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
            <button className="submit-button" type="button" onClick={() => { setShowForm(true); setOrderError(""); }}>
              Pedir este serviço
            </button>
          )}

          {user && !proprio && service.ativo && showForm && (
            <div className="order-form-panel">
              <h3>Enviar pedido ao prestador</h3>
              <form onSubmit={handleOrderSubmit}>
                <label>
                  Descrição do trabalho
                  <textarea
                    name="descricao"
                    rows={4}
                    required
                    placeholder="Explica o que precisas, o tamanho do espaço, etc."
                  />
                </label>
                <label>
                  Data desejada
                  <input type="date" name="dataDesejada" min={hoje()} required />
                </label>
                <label>
                  Morada
                  <input type="text" name="morada" required placeholder="Rua, número, código postal" />
                </label>
                <p className="field-hint">O valor do serviço é {formatPrice(service.preco)}. O prestador aceita ou recusa o pedido.</p>
                {orderError && <p className="form-message error">{orderError}</p>}
                <button className="submit-button" type="submit" disabled={busy}>
                  {busy ? "A enviar…" : "Enviar pedido"}
                </button>
                <button
                  className="submit-button"
                  type="button"
                  onClick={() => { setShowForm(false); setOrderError(""); }}
                  disabled={busy}
                >
                  Cancelar
                </button>
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
            {totalAvaliacoes > 0
              ? `${media.toFixed(1)}/5 · ${totalAvaliacoes} avaliação(ões) verificada(s)`
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
