import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { apiBase, readJson, formatPrice, formatDate, estadoClasse } from "../lib/api.js";

const ESTADOS = [
  "Submetido",
  "Aceite",
  "Em execução",
  "Aguarda confirmação",
  "Concluído",
  "Recusado",
  "Cancelado",
];

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

  function escolherEstado(valor) {
    const params = new URLSearchParams(searchParams);
    if (valor) params.set("estado", valor);
    else params.delete("estado");
    setSearchParams(params);
  }

  if (!authReady) {
    return <section className="catalog-page"><p className="catalog-count">A carregar…</p></section>;
  }

  if (!user) {
    return (
      <section className="catalog-page">
        <div className="catalog-hero">
          <p className="kicker">Os meus pedidos</p>
          <h1>Entra para veres os teus pedidos</h1>
          <p className="catalog-subtitle">Precisas de sessão iniciada para acompanhar pedidos como cliente ou prestador.</p>
          <Link className="submit-button" to="/conta">Iniciar sessão</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page">
      <div className="catalog-hero orders-hero">
        <p className="kicker">Os meus pedidos</p>
        <h1>Pedidos de serviços</h1>
        <p className="catalog-subtitle">Acompanha o estado de cada pedido e o histórico de alterações.</p>
      </div>

      <div className="mode-switch orders-switch" role="tablist" aria-label="Tipo de pedidos">
        <button
          type="button"
          role="tab"
          aria-selected={papel === "cliente"}
          className={papel === "cliente" ? "selected" : ""}
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.set("papel", "cliente");
            setSearchParams(params);
          }}
        >
          Como cliente
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={papel === "prestador"}
          className={papel === "prestador" ? "selected" : ""}
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            params.set("papel", "prestador");
            setSearchParams(params);
          }}
        >
          Como prestador
        </button>
      </div>

      <div className="orders-filters">
        <label>
          Estado
          <select value={estadoFiltro} onChange={(event) => escolherEstado(event.target.value)}>
            <option value="">Todos os estados</option>
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>
        </label>
        {estadoFiltro && (
          <button type="button" className="link-button" onClick={() => escolherEstado("")}>
            Limpar filtro
          </button>
        )}
      </div>

      <p className="catalog-count">
        {loading
          ? "A carregar pedidos…"
          : estadoFiltro
            ? `${pedidosFiltrados.length} de ${pedidos.length} pedido(s)`
            : `${pedidos.length} pedido(s)`}
      </p>

      {error && <p className="form-message error">{error}</p>}

      {!loading && !error && pedidosFiltrados.length === 0 && (
        <p className="catalog-empty">
          {estadoFiltro
            ? `Não tens pedidos com o estado “${estadoFiltro}".`
            : papel === "cliente"
              ? "Ainda não fizeste pedidos. Explora o catálogo para encontrares um serviço."
              : "Ainda não recebeste pedidos nos teus serviços."}
        </p>
      )}

      <ul className="orders-list">
        {pedidosFiltrados.map((pedido) => (
          <li key={pedido._id} className="order-row">
            <div className="order-row-main">
              <p className="catalog-card-category">
                {pedido.servico?.categoria?.nome || "Serviço"}
              </p>
              <h3>{pedido.servico?.titulo || "Serviço"}</h3>
              <p className="order-row-meta">
                {papel === "cliente"
                  ? <>Prestador: <strong>{pedido.prestador?.nome}</strong></>
                  : <>Cliente: <strong>{pedido.cliente?.nome}</strong></>}
                {" · "}📍 {pedido.servico?.zona}
                {" · "}Data desejada: {formatDate(pedido.dataDesejada)}
              </p>
            </div>
            <div className="order-row-side">
              <span className={`order-badge ${estadoClasse(pedido.estado)}`}>{pedido.estado}</span>
              <strong>{formatPrice(pedido.preco)}</strong>
              <Link className="card-link" to={`/pedidos/${pedido._id}`}>Ver pedido</Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
