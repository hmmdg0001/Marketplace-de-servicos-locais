import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { PORTUGAL_CITIES } from "../data/cities.js";
import { apiBase, readJson, formatPrice } from "../lib/api.js";
import { NotificationBell } from "../components/NotificationCenter.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Card, CardContent, CardFooter } from "../components/ui/card.jsx";
import { Badge } from "../components/ui/badge.jsx";

const CITIES = PORTUGAL_CITIES.flatMap((group) => group.cities);

// Fotos de capa por categoria (mesmos anúncios do catálogo, servidos pelo Cloudinary).
const FOTOS_CATEGORIA = {
  limpeza: "limpeza-casa",
  reparacao: "fugas-agua",
  montagem: "roupeiro",
  beleza: "manicure",
  auto: "lavagem-carro",
  decoracao: "pintura-interior",
  jardinagem: "corte-relva",
  instalacao: "ar-condicionado",
  lavandaria: "lavar-passar",
  manutencao: "manutencao-ac",
  mudancas: "mudanca-casa",
  pragas: "baratas",
  impermeabilizacao: "terraco",
};

const foto = (chave, largura = 640, altura = 420) =>
  `https://res.cloudinary.com/agd59hox/image/upload/c_fill,w_${largura},h_${altura},q_auto/serviperto/catalogo/${chave}.jpg`;

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

const PASSOS = [
  {
    icone: Search,
    titulo: "Descreve o que precisas",
    texto: "Diz-nos o serviço e a zona. Em segundos vês profissionais disponíveis perto de ti.",
  },
  {
    icone: ClipboardList,
    titulo: "Compara e escolhe",
    texto: "Consulta avaliações verificadas, preços e fotografias antes de decidir.",
  },
  {
    icone: MessageSquareText,
    titulo: "Pede um orçamento",
    texto: "Envia o pedido e conversa diretamente com o profissional sobre os detalhes.",
  },
];

function Estrelas({ nota }) {
  return (
    <span className="inline-flex items-center gap-1 text-amber-500" aria-label={`${Number(nota).toFixed(1)} de 5`}>
      <Star className="h-4 w-4 fill-current" />
      <strong className="text-brand-ink">{Number(nota).toFixed(1)}</strong>
    </span>
  );
}

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
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  }

  function escolherCategoria(slug) {
    atualizarParametros({ categoria: categoria === slug ? undefined : slug, page: undefined });
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  }

  const destaques = resultado.items.slice(0, 4);

  return (
    <div className="min-h-screen bg-white font-sans text-brand-ink [&_a]:no-underline">
      <header className="w-full border-b border-brand-line bg-white">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-brand-navy">
            servi<span className="text-brand-purple">perto</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-3" aria-label="Navegação principal">
            <Link
              to="/servicos"
              className="hidden rounded-full px-3 py-2 font-medium text-brand-navy hover:bg-brand-mist md:inline-flex"
            >
              Juntar como profissional
            </Link>
            <Link to="/conta" className="rounded-full px-3 py-2 font-medium text-brand-navy hover:bg-brand-mist">
              Entrar
            </Link>
            <Button asChild size="sm" className="bg-brand-purple hover:bg-brand-purpleDark">
              <Link to="/conta">Registar</Link>
            </Button>
            <NotificationBell />
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-white">
          <div className="container grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
            <div>
              <Badge variant="outline" className="uppercase tracking-widest text-brand-muted">
                Marketplace de serviços locais
              </Badge>
              <h1 className="mt-5 max-w-2xl font-display text-5xl font-extrabold leading-[1.06] tracking-tight text-brand-navy md:text-6xl">
                O profissional certo, <span className="text-primary">mesmo aqui perto.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-muted">
                Limpeza, canalização, eletricidade, pintura, jardinagem ou mudanças. Encontra, compara e pede um
                orçamento sem complicações.
              </p>

              <form onSubmit={pesquisar} className="mt-8 flex flex-col gap-3 rounded-2xl border border-brand-line bg-white p-3 shadow-soft sm:flex-row">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-brand-line px-3">
                  <Search className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden="true" />
                  <Input
                    type="search"
                    value={formQ}
                    onChange={(event) => setFormQ(event.target.value)}
                    placeholder="Que serviço procuras?"
                    aria-label="Pesquisar serviço"
                    className="h-10 border-0 px-1 shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-brand-line px-3 sm:w-56">
                  <MapPin className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden="true" />
                  <select
                    value={formZona}
                    onChange={(event) => setFormZona(event.target.value)}
                    aria-label="Localização"
                    className="h-10 w-full bg-transparent text-sm text-brand-ink outline-none"
                  >
                    <option value="">Todo o país</option>
                    {CITIES.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="lg" className="shrink-0">
                  Procurar <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
              <p className="mt-4 flex items-center gap-2 text-xs text-brand-muted">
                <ShieldCheck className="h-4 w-4 text-primary" /> Fala diretamente com o prestador, sem intermédios.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-lg">
              <img
                src={foto("limpeza-profunda", 900, 1100)}
                alt="Profissional a limpar uma divisão"
                className="h-[420px] w-full rounded-3xl object-cover shadow-lift md:h-[480px]"
              />
              <div className="absolute -bottom-6 left-4 right-4 rounded-2xl border border-brand-line bg-white p-4 shadow-soft md:left-auto md:right-6 md:w-64">
                <div className="flex items-center gap-2 text-amber-500">
                  <Star className="h-5 w-5 fill-current" />
                  <span className="font-display text-2xl font-extrabold text-brand-navy">4,8</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-brand-ink">Avaliações verificadas</p>
                <p className="text-xs text-brand-muted">Clientes reais, pedidos concluídos.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-brand-line bg-brand-mist">
          <div className="container flex flex-wrap items-center justify-center gap-x-12 gap-y-5 py-7 text-center">
            {[
              ["4,8 ★", "classificação média"],
              ["348", "avaliações verificadas"],
              ["87", "serviços publicados"],
            ].map(([numero, legenda]) => (
              <div key={legenda}>
                <p className="font-display text-2xl font-extrabold text-brand-navy">{numero}</p>
                <p className="text-xs text-brand-muted">{legenda}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white py-16 md:py-20">
          <div className="container">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-brand-navy md:text-4xl">
                  Explora por categoria
                </h2>
                <p className="mt-2 text-brand-muted">Tudo o que precisas para casa e para o dia a dia.</p>
              </div>
              <button
                type="button"
                onClick={() => atualizarParametros({ categoria: undefined, page: undefined })}
                className="rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-mist"
              >
                Ver todos os serviços
              </button>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {categories.map((item) => (
                <button key={item._id} type="button" onClick={() => escolherCategoria(item.slug)} className="group border-0 bg-transparent p-0 text-left">
                  <Card className={`overflow-hidden border-0 transition-all group-hover:-translate-y-1 group-hover:shadow-lift ${categoria === item.slug ? "ring-2 ring-primary" : ""}`}>
                    <img
                      src={foto(FOTOS_CATEGORIA[item.slug] || "limpeza-casa")}
                      alt=""
                      className="h-32 w-full object-cover"
                      loading="lazy"
                    />
                    <CardContent className="flex items-center justify-between p-4">
                      <span className="text-sm font-bold text-brand-navy">{item.nome}</span>
                      <span className="text-xs text-brand-muted">{item.totalServicos}</span>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand-mist py-16 md:py-20">
          <div className="container">
            <h2 className="text-center font-display text-3xl font-extrabold tracking-tight text-brand-navy md:text-4xl">
              Como funciona
            </h2>
            <p className="mt-2 text-center text-brand-muted">Três passos simples, do pedido à conclusão.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PASSOS.map((passo, indice) => {
                const Icone = passo.icone;
                return (
                  <Card key={passo.titulo} className="p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icone className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-xs font-bold uppercase tracking-widest text-primary">
                      Passo {indice + 1}
                    </p>
                    <CardContent className="px-0 pb-0 pt-2">
                      <h3 className="font-display text-lg font-bold text-brand-navy">{passo.titulo}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-brand-muted">{passo.texto}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-white py-16 md:py-20">
          <div className="container">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-brand-navy md:text-4xl">
              Profissionais em destaque
            </h2>
            <p className="mt-2 text-brand-muted">Escolhidos entre os serviços melhor avaliados da comunidade.</p>

            {destaques.length === 0 ? (
              <p className="mt-8 text-sm text-brand-muted">A carregar profissionais…</p>
            ) : (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {destaques.map((servico) => {
                  const nota = Number(servico.prestador?.mediaAvaliacoes || 0);
                  const total = Number(servico.prestador?.totalAvaliacoes || 0);
                  return (
                    <Card key={servico._id} className="flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lift">
                      <div className="relative">
                        <img
                          src={servico.imagens?.[0] || foto(FOTOS_CATEGORIA[servico.categoria?.slug] || "limpeza-casa")}
                          alt=""
                          className="h-40 w-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute -bottom-5 left-4 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-primary font-display text-sm font-extrabold text-white shadow-soft">
                          {(servico.prestador?.nome || "S").charAt(0)}
                        </div>
                      </div>
                      <CardContent className="flex flex-1 flex-col pt-8">
                        <h3 className="font-display text-base font-bold leading-snug text-brand-navy">
                          {servico.prestador?.nome || "Profissional"}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm text-brand-muted">{servico.titulo}</p>
                        <div className="mt-3 flex items-center gap-3">
                          {total > 0 ? (
                            <>
                              <Estrelas nota={nota} />
                              <span className="text-xs text-brand-muted">({total})</span>
                            </>
                          ) : (
                            <span className="text-xs text-brand-muted">Sem avaliações</span>
                          )}
                        </div>
                        <p className="mt-auto pt-4 text-sm font-bold text-brand-navy">{formatPrice(servico.preco)}</p>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link to={`/servico/${servico._id}`}>Pedir orçamento</Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section id="catalogo" className="bg-brand-mist py-16 md:py-20">
          <div className="container">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-brand-navy md:text-4xl">
              Serviços perto de ti
            </h2>
            <p className="mt-2 text-brand-muted">
              {loading ? "A carregar serviços…" : `${resultado.total} serviço(s) encontrado(s)`}
            </p>

            <div className="mt-7 flex flex-wrap items-end gap-3 rounded-2xl border border-brand-line bg-white p-4 shadow-soft">
              <label className="flex flex-col gap-1 text-xs font-semibold text-brand-muted">
                Preço
                <select
                  value={precoMax}
                  onChange={(event) => atualizarParametros({ precoMax: event.target.value, page: undefined })}
                  className="h-10 rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink"
                >
                  {PRICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-brand-muted">
                Classificação
                <select
                  value={avaliacaoMin}
                  onChange={(event) => atualizarParametros({ avaliacaoMin: event.target.value, page: undefined })}
                  className="h-10 rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink"
                >
                  {RATING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-brand-muted">
                Ordenar
                <select
                  value={sort}
                  onChange={(event) => atualizarParametros({ sort: event.target.value, page: undefined })}
                  className="h-10 rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {(q || zona || categoria || precoMax || avaliacaoMin) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFormQ("");
                    setFormZona("");
                    setSearchParams(new URLSearchParams());
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>

            {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

            {!loading && !error && resultado.items.length === 0 && (
              <div className="mt-8 rounded-2xl border border-dashed border-brand-line bg-white p-10 text-center text-brand-muted">
                Não encontrámos serviços com estes filtros. Experimenta outra pesquisa.
              </div>
            )}

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {resultado.items.map((servico) => (
                <Card key={servico._id} className="flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lift">
                  <img
                    src={servico.imagens?.[0] || foto(FOTOS_CATEGORIA[servico.categoria?.slug] || "limpeza-casa")}
                    alt=""
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />
                  <CardContent className="flex flex-1 flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      {servico.categoria?.nome || "Serviço"}
                    </span>
                    <h3 className="font-display text-base font-bold text-brand-navy">{servico.titulo}</h3>
                    <p className="text-sm text-brand-muted">
                      {servico.prestador?.nome} · <MapPin className="inline h-3 w-3" /> {servico.zona || servico.prestador?.zona}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <strong className="font-display text-brand-navy">{formatPrice(servico.preco)}</strong>
                      <Button asChild size="sm">
                        <Link to={`/servico/${servico._id}`}>Ver serviço</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {resultado.pages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Paginação">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => atualizarParametros({ page: page - 1 })}
                >
                  Anterior
                </Button>
                <span className="text-sm text-brand-muted">Página {page} de {resultado.pages}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= resultado.pages}
                  onClick={() => atualizarParametros({ page: page + 1 })}
                >
                  Seguinte
                </Button>
              </nav>
            )}
          </div>
        </section>

        <section className="bg-brand-navy py-14 text-white">
          <div className="container flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-3xl font-extrabold">És profissional?</h2>
              <p className="mt-2 max-w-xl text-white/70">
                Publica os teus serviços, recebe pedidos e gerencia a tua agenda num só lugar.
              </p>
            </div>
            <Button asChild variant="outline" size="lg" className="border-white/30 bg-white text-brand-navy hover:bg-white/90">
              <Link to="/servicos">Juntar como profissional <CheckCircle2 className="h-4 w-4" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-line bg-white">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-brand-muted">
          <span className="font-display font-extrabold text-brand-navy">serviperto</span>
          <span>Serviços locais, pessoas de confiança.</span>
          <span>© {new Date().getFullYear()} ServiPerto</span>
        </div>
      </footer>
    </div>
  );
}
