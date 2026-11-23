import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiBase, readJson, formatPrice, formatDate } from "../lib/api.js";

const estrelas = (nota) => "\u2605".repeat(Math.round(nota)) + "\u2606".repeat(5 - Math.round(nota));

export default function ProviderPage() {
  const { uid } = useParams();
  const [perfil, setPerfil] = useState(null);
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro("");

    Promise.all([
      fetch(`${apiBase}/profile/${encodeURIComponent(uid)}`).then(readJson),
      fetch(`${apiBase}/services?userId=${encodeURIComponent(uid)}&ativo=true`).then(readJson),
    ])
      .then(([dadosPerfil, dadosServicos]) => {
        if (cancelado) return;
        if (dadosPerfil.error) {
          setErro(dadosPerfil.error);
          return;
        }
        setPerfil(dadosPerfil);
        setServicos(Array.isArray(dadosServicos) ? dadosServicos : []);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar o perfil.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [uid]);

  if (carregando) {
    return <section className="catalog-page"><p className="catalog-count">A carregar perfil…</p></section>;
  }

  if (erro || !perfil) {
    return (
      <section className="catalog-page">
        <div className="catalog-hero">
          <p className="kicker">Perfil do prestador</p>
          <h1>Prestador não encontrado</h1>
          <p className="catalog-subtitle">{erro || "Não encontrámos este prestador."}</p>
          <Link className="submit-button" to="/">Voltar ao catálogo</Link>
        </div>
      </section>
    );
  }

  const { user, provider, avaliacoes } = perfil;
  const nome = user.nome || "Prestador";
  const zona = provider?.zona || user.cidade;
  const nota = Number(provider?.mediaAvaliacoes || 0);
  const totalAvaliacoes = Number(provider?.totalAvaliacoes || 0);
  const rotuloAvaliacoes = totalAvaliacoes === 1 ? "avaliação" : "avaliações";

  return (
    <section className="catalog-page">
      <div className="catalog-hero provider-hero">
        <div className="provider-avatar" aria-hidden="true">{nome.charAt(0).toUpperCase()}</div>
        <p className="kicker">Perfil do prestador</p>
        <h1>{nome}</h1>
        <p className="catalog-subtitle">
          {zona ? `📍 ${zona} · ` : ""}
          {totalAvaliacoes > 0
            ? `${nota.toFixed(1)}/5 (${totalAvaliacoes} ${rotuloAvaliacoes})`
            : "Ainda sem avaliações"}
        </p>
        {provider?.bio && <p className="provider-bio">{provider.bio}</p>}
        <p className="provider-desde">Na ServiPerto desde {formatDate(user.criadoEm) || "data desconhecida"}</p>
      </div>

      {servicos.length > 0 && (
        <>
          <h2 className="provider-section-title">Serviços de {nome}</h2>
          <ul className="catalog-grid">
            {servicos.map((servico) => (
              <li key={servico._id} className="catalog-card">
                <div className="catalog-card-image" aria-hidden="true">
                  {servico.imagens?.[0] ? (
                    <img src={servico.imagens[0]} alt="" loading="lazy" />
                  ) : (
                    servico.categoria?.icone || "✳"
                  )}
                </div>
                <div className="catalog-card-body">
                  <p className="catalog-card-category">{servico.categoria?.nome || "Serviço"}</p>
                  <h3>{servico.titulo}</h3>
                  <p className="catalog-card-provider">📍 {servico.zona || zona}</p>
                  <div className="catalog-card-footer">
                    <strong>{formatPrice(servico.preco)}</strong>
                    <Link className="card-link" to={`/servico/${servico._id}`}>Ver serviço</Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="reviews-section">
        <div className="reviews-head">
          <h2>Avaliações recebidas</h2>
          <span>{totalAvaliacoes} {rotuloAvaliacoes} no total</span>
        </div>
        {avaliacoes.length === 0 ? (
          <p className="catalog-empty">Ainda sem avaliações. As avaliações aparecem quando um pedido é concluído.</p>
        ) : (
          <ul className="review-list">
            {avaliacoes.map((avaliacao) => (
              <li key={avaliacao._id} className="review-item">
                <div className="review-top">
                  <strong>{avaliacao.cliente?.nome || "Cliente"}</strong>
                  <span className="review-stars" aria-label={`${avaliacao.classificacao} de 5`}>
                    {estrelas(avaliacao.classificacao)}
                  </span>
                </div>
                {avaliacao.comentario && <p className="review-comment">{avaliacao.comentario}</p>}
                <p className="review-date">{formatDate(avaliacao.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
