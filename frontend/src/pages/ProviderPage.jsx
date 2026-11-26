import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, MapPin, ShieldCheck, Star } from "lucide-react";
import { apiBase, readJson, formatPrice, formatDate } from "../lib/api.js";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

function Estrelas({ nota }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${nota} de 5`}>
      {Array.from({ length: nota }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-current" />
      ))}
      {Array.from({ length: 5 - nota }).map((_, i) => (
        <Star key={`vazia-${i}`} className="h-4 w-4 text-brand-line" />
      ))}
    </span>
  );
}

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

    return () => { cancelado = true; };
  }, [uid]);

  if (carregando) {
    return <div className="min-h-screen bg-brand-mist py-20 text-center text-brand-muted">A carregar perfil…</div>;
  }

  if (erro || !perfil) {
    return (
      <div className="min-h-screen bg-brand-mist px-5 py-20 text-center">
        <h1 className="font-display text-3xl font-extrabold text-brand-navy">Prestador não encontrado</h1>
        <p className="mt-2 text-brand-muted">{erro || "Não encontrámos este prestador."}</p>
        <Button asChild className="mt-6">
          <Link to="/">Voltar ao catálogo <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    );
  }

  const { user, provider, avaliacoes } = perfil;
  const nome = user.nome || "Prestador";
  const zona = provider?.zona || user.cidade;
  const nota = Number(provider?.mediaAvaliacoes || 0);
  const totalAvaliacoes = Number(provider?.totalAvaliacoes || 0);

  return (
    <div className="min-h-screen bg-brand-mist font-sans text-brand-ink [&_a]:no-underline">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <nav className="flex items-center gap-2 text-sm text-brand-muted">
          <Link to="/" className="hover:text-primary">Explorar</Link>
          <span>/</span>
          <span>Perfil do prestador</span>
        </nav>

        <Card className="mt-6 overflow-hidden">
          <div className="h-24 bg-brand-navy" />
          <CardContent className="px-6 pb-8 md:px-10">
            <div className="-mt-12 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-primary font-display text-3xl font-extrabold text-white shadow-soft">
              {nome.charAt(0).toUpperCase()}
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <Badge variant="outline" className="uppercase tracking-widest text-brand-muted">Perfil do prestador</Badge>
                <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-brand-navy md:text-5xl">{nome}</h1>
                <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-brand-muted">
                  {zona && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-primary" /> {zona}</span>}
                  {totalAvaliacoes > 0 ? (
                    <span className="inline-flex items-center gap-2">
                      <Estrelas nota={Math.round(nota)} />
                      <strong className="text-brand-navy">{nota.toFixed(1)}/5</strong> ({totalAvaliacoes} avaliações)
                    </span>
                  ) : (
                    <span>Ainda sem avaliações</span>
                  )}
                </p>
                {provider?.bio && <p className="mt-5 leading-relaxed text-brand-muted">{provider.bio}</p>}
                <p className="mt-5 inline-flex items-center gap-2 text-xs text-brand-muted">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Na ServiPerto desde {formatDate(user.criadoEm) || "data desconhecida"}
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-2xl bg-brand-mist p-5 text-center">
                <span className="font-display text-3xl font-extrabold text-brand-navy">{provider?.totalServicos || servicos.length}</span>
                <span className="text-xs text-brand-muted">serviços publicados</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {servicos.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-extrabold text-brand-navy md:text-3xl">Serviços de {nome}</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {servicos.map((servico) => (
                <Card key={servico._id} className="flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lift">
                  <img
                    src={servico.imagens?.[0] || "https://res.cloudinary.com/agd59hox/image/upload/c_fill,w_640,h_420,q_auto/serviperto/catalogo/limpeza-casa.jpg"}
                    alt=""
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                  <CardContent className="flex flex-1 flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">{servico.categoria?.nome || "Serviço"}</span>
                    <h3 className="font-display text-base font-bold text-brand-navy">{servico.titulo}</h3>
                    <p className="text-sm text-brand-muted"><MapPin className="inline h-3.5 w-3.5" /> {servico.zona || zona}</p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <strong className="font-display text-brand-navy">{formatPrice(servico.preco)}</strong>
                      <Button asChild size="sm">
                        <Link to={`/servico/${servico._id}`}>Ver serviço</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-extrabold text-brand-navy md:text-3xl">Avaliações recebidas</h2>
            <span className="text-sm text-brand-muted">{totalAvaliacoes} no total</span>
          </div>

          {avaliacoes.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-dashed border-brand-line bg-white p-8 text-center text-sm text-brand-muted">
              Ainda sem avaliações. As avaliações aparecem quando um pedido é concluído.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {avaliacoes.map((avaliacao) => (
                <Card key={avaliacao._id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <strong className="text-sm text-brand-navy">{avaliacao.cliente?.nome || "Cliente"}</strong>
                    <Estrelas nota={avaliacao.classificacao} />
                  </div>
                  {avaliacao.comentario && <p className="mt-3 text-sm leading-relaxed text-brand-muted">{avaliacao.comentario}</p>}
                  <p className="mt-4 text-xs text-brand-muted">{formatDate(avaliacao.createdAt)}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="mt-10 flex items-center gap-2 text-xs text-brand-muted">
          <ShieldCheck className="h-4 w-4 text-primary" /> <CheckCircle2 className="h-4 w-4 text-primary" /> Avaliações de pedidos concluídos.
        </div>
      </div>
    </div>
  );
}
