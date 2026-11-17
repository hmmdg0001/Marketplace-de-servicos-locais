import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiBase, readJson, formatPrice } from "../lib/api.js";

export default function ServiceDetailPage() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <section className="catalog-page">
      <nav className="breadcrumb" aria-label="Caminho">
        <Link to="/">Explorar</Link>
        <span>/</span>
        <Link to={`/?categoria=${service.categoria?.slug || ""}`}>{service.categoria?.nome || "Serviço"}</Link>
      </nav>

      <div className="service-detail">
        <div className="service-detail-gallery" aria-label="Fotografias do serviço">
          <span>Fotografias do serviço</span>
        </div>

        <div className="service-detail-info">
          <p className="catalog-card-category">{service.categoria?.nome}</p>
          <h1>{service.titulo}</h1>
          <p className="service-detail-provider">
            Prestador: <strong>{service.prestador?.nome}</strong>
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

          <button className="submit-button" type="button" disabled>
            Pedir este serviço
          </button>
          <p className="service-detail-note">Os pedidos entram na próxima fase do projeto.</p>
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
        </div>
      )}
    </section>
  );
}
