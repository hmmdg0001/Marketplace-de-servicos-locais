import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowRight, CalendarDays, ClipboardList, MapPin } from "lucide-react";
import { auth } from "../firebase.js";
import { apiBase, readJson, formatPrice, formatDate } from "../lib/api.js";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

const ESTADOS = [
  "Submetido",
  "Aceite",
  "Em execução",
  "Aguarda confirmação",
  "Concluído",
  "Recusado",
  "Cancelado",
];

const COR_ESTADO = {
  Submetido: "bg-sky-50 text-sky-700",
  Aceite: "bg-indigo-50 text-indigo-700",
  "Em execução": "bg-amber-50 text-amber-700",
  "Aguarda confirmação": "bg-violet-50 text-violet-700",
  "Concluído": "bg-emerald-50 text-emerald-700",
  Recusado: "bg-red-50 text-red-700",
  Cancelado: "bg-slate-100 text-slate-600",
};

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const papel = searchParams.get("papel") === "prestador" ? "prestador" : "cliente";
  const estadoFiltro = searchParams.get("estado") || "";

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setPedidos([]);
      setLoading(false);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError("");

    user.getIdToken()
      .then((token) =>
        fetch(`${apiBase}/orders?papel=${papel}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(readJson)
      .then((data) => {
        if (cancelado) return;
        if (data.error) setError(data.error);
        else setPedidos(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelado) setError("Não foi possível carregar os pedidos.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [user, papel]);

  const pedidosFiltrados = estadoFiltro
    ? pedidos.filter((pedido) => pedido.estado === estadoFiltro)
    : pedidos;

  function mudarPapel(novoPapel) {
    const params = new URLSearchParams(searchParams);
    params.set("papel", novoPapel);
    setSearchParams(params);
  }

  function escolherEstado(valor) {
    const params = new URLSearchParams(searchParams);
    if (valor) params.set("estado", valor);
    else params.delete("estado");
    setSearchParams(params);
  }

  if (!authReady) {
    return <div className="min-h-screen bg-brand-mist py-20 text-center text-brand-muted">A carregar…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-mist px-5 py-20 text-center">
        <h1 className="font-display text-4xl font-extrabold text-brand-navy">Entra para veres os teus pedidos</h1>
        <p className="mt-3 text-brand-muted">Precisas de sessão iniciada para acompanhar pedidos como cliente ou prestador.</p>
        <Button asChild className="mt-7">
          <Link to="/conta">Iniciar sessão <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-mist font-sans text-brand-ink [&_a]:no-underline">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <Badge variant="outline" className="uppercase tracking-widest text-brand-muted">Os meus pedidos</Badge>
        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-brand-navy md:text-5xl">
          Pedidos de serviços
        </h1>
        <p className="mt-3 text-brand-muted">Acompanha o estado de cada pedido e o histórico de alterações.</p>

        <div className="mt-8 inline-flex rounded-full bg-white p-1 shadow-soft" role="tablist" aria-label="Tipo de pedidos">
          {[
            ["cliente", "Como cliente"],
            ["prestador", "Como prestador"],
          ].map(([chave, titulo]) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={papel === chave}
              onClick={() => mudarPapel(chave)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                papel === chave ? "bg-primary text-brand-navy" : "text-brand-muted hover:text-brand-navy"
              }`}
            >
              {titulo}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-4 rounded-2xl border border-brand-line bg-white p-4 shadow-soft">
          <label className="flex flex-col gap-1 text-xs font-semibold text-brand-muted">
            Estado
            <select
              value={estadoFiltro}
              onChange={(event) => escolherEstado(event.target.value)}
              className="h-10 rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink"
            >
              <option value="">Todos os estados</option>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </label>
          {estadoFiltro && (
            <Button type="button" variant="ghost" size="sm" onClick={() => escolherEstado("")}>
              Limpar filtro
            </Button>
          )}
          <span className="ml-auto text-sm text-brand-muted">
            {loading
              ? "A carregar pedidos…"
              : estadoFiltro
                ? `${pedidosFiltrados.length} de ${pedidos.length} pedido(s)`
                : `${pedidos.length} pedido(s)`}
          </span>
        </div>

        {error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!loading && !error && pedidosFiltrados.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-line bg-white p-10 text-center text-sm text-brand-muted">
            {estadoFiltro
              ? `Não tens pedidos com o estado “${estadoFiltro}".`
              : papel === "cliente"
                ? "Ainda não fizeste pedidos. Explora o catálogo para encontrares um serviço."
                : "Ainda não recebeste pedidos nos teus serviços."}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {pedidosFiltrados.map((pedido) => (
            <Card key={pedido._id} className="transition-all hover:shadow-lift">
              <CardContent className="flex flex-wrap items-center justify-between gap-5 p-5 md:p-6">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {pedido.servico?.categoria?.nome || "Serviço"}
                  </span>
                  <h2 className="mt-1 font-display text-lg font-bold text-brand-navy">
                    {pedido.servico?.titulo || "Serviço"}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-muted">
                    <span>
                      {papel === "cliente" ? "Prestador" : "Cliente"}:{" "}
                      <strong className="text-brand-ink">
                        {papel === "cliente" ? pedido.prestador?.nome : pedido.cliente?.nome}
                      </strong>
                    </span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {pedido.servico?.zona}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(pedido.dataDesejada)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Badge className={`border-transparent ${COR_ESTADO[pedido.estado] || "bg-brand-mist text-brand-muted"}`}>
                    {pedido.estado}
                  </Badge>
                  <strong className="font-display text-brand-navy">{formatPrice(pedido.preco)}</strong>
                  <Button asChild size="sm">
                    <Link to={`/pedidos/${pedido._id}`}>Ver pedido <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!loading && pedidosFiltrados.length > 0 && (
          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-brand-muted">
            <ClipboardList className="h-4 w-4 text-primary" /> Cada pedido guarda o histórico completo de estados.
          </p>
        )}
      </div>
    </div>
  );
}
