import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PORTUGAL_CITIES } from "../data/cities.js";
import { apiBase, readJson, formatPrice } from "../lib/api.js";

const CITIES = PORTUGAL_CITIES.flatMap((group) => group.cities);

const PRICE_OPTIONS = [
  { label: "Qualquer preço", value: "" },
  { label: "Até 25 €", value: "25" },
  { label: "Até 50 €", value: "50" },
  { label: "Até 100 €", value: "100" },
  { label: "Até 250 €", value: "250" },
];

const SORT_OPTIONS = [
  { label: "Mais recentes", value: "" },
  { label: "Preço mais baixo", value: "preco_asc" },
  { label: "Preço mais alto", value: "preco_desc" },
];

const RATING_OPTIONS = [
  { label: "Qualquer classificação", value: "" },
  { label: "4 estrelas ou mais", value: "4" },
  { label: "4,5 estrelas ou mais", value: "4.5" },
];

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") || "";
  const zona = searchParams.get("zona") || "";
  const categoria = searchParams.get("categoria") || "";
  const precoMax = searchParams.get("precoMax") || "";
  const avaliacaoMin = searchParams.get("avaliacaoMin") || "";
  const sort = searchParams.get("sort") || "";
  const page = Math.max(1, Number(searchParams.get("page") || 1));

  const [categories, setCategories] = useState([]);
  const [resultado, setResultado] = useState({ items: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [formQ, setFormQ] = useState(q);
  const [formZona, setFormZona] = useState(zona);

  useEffect(() => {
    fetch(`${apiBase}/categories`)
      .then(readJson)
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Erro ao carregar categorias:", err));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "12" });
    if (q) params.set("q", q);
    if (zona) params.set("zona", zona);
    if (categoria) params.set("categoria", categoria);
    if (precoMax) params.set("precoMax", precoMax);
    if (avaliacaoMin) params.set("avaliacaoMin", avaliacaoMin);
    if (sort) params.set("sort", sort);

    let cancelado = false;
    setLoading(true);
    setError("");

    fetch(`${apiBase}/services?${params.toString()}`)
      .then(readJson)
      .then((data) => {
        if (cancelado) return;
        setResultado({
          items: Array.isArray(data.items) ? data.items : [],
          total: data.total || 0,
          pages: data.pages || 0,
        });
      })
      .catch(() => {
        if (!cancelado) setError("Não foi possível carregar os serviços.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [q, zona, categoria, precoMax, avaliacaoMin, sort, page]);

  function atualizarParametros(novos) {
    const params = new URLSearchParams(searchParams);
    Object.entries(novos).forEach(([chave, valor]) => {
      if (valor === undefined || valor === null || valor === "") params.delete(chave);
      else params.set(chave, String(valor));
    });
    setSearchParams(params);
  }

  function pesquisar(event) {
    event.preventDefault();
    atualizarParametros({ q: formQ.trim(), zona: formZona, page: undefined });
  }

  function escolherCategoria(slug) {
    atualizarParametros({ categoria: categoria === slug ? undefined : slug, page: undefined });
  }

  return (
    <section className="catalog-page">
      <div className="catalog-hero">
        <p className="kicker">Marketplace de serviços locais</p>
        <h1>Profissionais locais de confiança</h1>
        <p className="catalog-subtitle">Encontra o serviço de que precisas perto de ti.</p>

        <form className="catalog-search" onSubmit={pesquisar}>
          <input
            type="search"
            value={formQ}
            onChange={(event) => setFormQ(event.target.value)}
            placeholder="O que procuras? Ex: canalizador"
            aria-label="Pesquisar serviço"
          />
          <select
            value={formZona}
            onChange={(event) => setFormZona(event.target.value)}
            aria-label="Concelho ou zona"
          >
            <option value="">Todo o país</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <button className="submit-button" type="submit">Pesquisar</button>
        </form>
      </div>

      <div className="category-chips" aria-label="Categorias">
        <button
          type="button"
          className={categoria === "" ? "chip active" : "chip"}
          onClick={() => atualizarParametros({ categoria: undefined, page: undefined })}
        >
          Todas
        </button>
        {categories.map((item) => (
          <button
            key={item._id}
            type="button"
            className={categoria === item.slug ? "chip active" : "chip"}
            onClick={() => escolherCategoria(item.slug)}
          >
            <span aria-hidden="true">{item.icone}</span> {item.nome}
            <small>{item.totalServicos}</small>
          </button>
        ))}
      </div>

      <div className="catalog-filters">
        <label>
          Preço
          <select
            value={precoMax}
            onChange={(event) => atualizarParametros({ precoMax: event.target.value, page: undefined })}
          >
            {PRICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Classificação
          <select
            value={avaliacaoMin}
            onChange={(event) => atualizarParametros({ avaliacaoMin: event.target.value, page: undefined })}
          >
            {RATING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Ordenar
          <select
            value={sort}
            onChange={(event) => atualizarParametros({ sort: event.target.value, page: undefined })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {(q || zona || categoria || precoMax || avaliacaoMin) && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setFormQ("");
              setFormZona("");
              setSearchParams(new URLSearchParams());
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <p className="catalog-count">
        {loading ? "A carregar serviços…" : `${resultado.total} serviço(s) encontrado(s)`}
      </p>

      {error && <p className="form-message error">{error}</p>}

      {!loading && !error && resultado.items.length === 0 && (
        <p className="catalog-empty">Não encontrámos serviços com esses filtros. Tenta outra pesquisa.</p>
      )}

      <ul className="catalog-grid">
        {resultado.items.map((service) => (
          <li key={service._id} className="catalog-card">
            <div className="catalog-card-image" aria-hidden="true">
              {service.imagens?.[0] ? (
                <img src={service.imagens[0]} alt="" loading="lazy" />
              ) : (
                service.categoria?.icone || "✳"
              )}
            </div>
            <div className="catalog-card-body">
              <p className="catalog-card-category">{service.categoria?.nome || "Serviço"}</p>
              <h3>{service.titulo}</h3>
              <p className="catalog-card-provider">
                {service.prestador?.nome} · 📍 {service.zona || service.prestador?.zona}
                {service.prestador?.totalAvaliacoes > 0 && (
                  <> · ⭐ {Number(service.prestador.mediaAvaliacoes).toFixed(1)}</>
                )}
              </p>
              <div className="catalog-card-footer">
                <strong>{formatPrice(service.preco)}</strong>
                <Link className="card-link" to={`/servico/${service._id}`}>Ver serviço</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {resultado.pages > 1 && (
        <nav className="pagination" aria-label="Paginação">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => atualizarParametros({ page: page - 1 })}
          >
            ‹ Anterior
          </button>
          <span>Página {page} de {resultado.pages}</span>
          <button
            type="button"
            disabled={page >= resultado.pages}
            onClick={() => atualizarParametros({ page: page + 1 })}
          >
            Seguinte ›
          </button>
        </nav>
      )}
    </section>
  );
}
