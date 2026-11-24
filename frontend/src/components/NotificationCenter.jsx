import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { apiBase, readJson, formatDateTime } from "../lib/api.js";

const ContextoNotificacoes = createContext(null);

export function useNotificacoes() {
  return useContext(ContextoNotificacoes);
}

export function NotificationProvider({ children }) {
  const [user, setUser] = useState(null);
  const [itens, setItens] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [toast, setToast] = useState(null);
  const ultimoIdRef = useRef(null);
  const primeiroCarregamentoRef = useRef(true);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  async function carregar() {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const data = await fetch(`${apiBase}/notificacoes`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(readJson);
      if (!Array.isArray(data)) return;

      setItens(data);
      const maisRecente = data[0]?._id || null;
      if (primeiroCarregamentoRef.current) {
        primeiroCarregamentoRef.current = false;
        ultimoIdRef.current = maisRecente;
      } else if (maisRecente && String(maisRecente) !== String(ultimoIdRef.current)) {
        setToast(data.find((n) => String(n._id) === String(maisRecente)) || null);
        ultimoIdRef.current = maisRecente;
      } else if (maisRecente) {
        ultimoIdRef.current = maisRecente;
      }
    } catch (erro) {
      // Falhas em segundo plano não devem interromper a navegação.
      console.error("Erro ao carregar notificações:", erro);
    }
  }

  useEffect(() => {
    if (!user) {
      setItens([]);
      primeiroCarregamentoRef.current = true;
      ultimoIdRef.current = null;
      return;
    }
    carregar();
    const intervalo = setInterval(carregar, 8000);
    return () => clearInterval(intervalo);
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const temporizador = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(temporizador);
  }, [toast]);

  async function marcarLida(id) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const resposta = await fetch(`${apiBase}/notificacoes/${id}/lida`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resposta.ok) {
        const atualizada = await readJson(resposta);
        setItens((prev) => prev.map((n) => (String(n._id) === String(id) ? atualizada : n)));
      }
    } catch (erro) {
      console.error("Erro ao marcar notificação:", erro);
    }
  }

  async function lerTodas() {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const resposta = await fetch(`${apiBase}/notificacoes/ler-todas`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resposta.ok) setItens((prev) => prev.map((n) => ({ ...n, lida: true })));
    } catch (erro) {
      console.error("Erro ao marcar notificações:", erro);
    }
  }

  const naoLidas = itens.filter((n) => !n.lida).length;
  const valor = { itens, naoLidas, aberto, setAberto, marcarLida, lerTodas, recarregar: carregar };

  return (
    <ContextoNotificacoes.Provider value={valor}>
      {children}
      {toast && (
        <div className="notificacoes-toast" role="status">
          <strong>{toast.titulo}</strong>
          <span>{toast.texto}</span>
          <Link to={`/pedidos/${toast.pedidoId}`} onClick={() => { marcarLida(toast._id); setToast(null); }}>
            Ver pedido →
          </Link>
          <button type="button" aria-label="Fechar" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </ContextoNotificacoes.Provider>
  );
}

export function NotificationBell() {
  const contexto = useNotificacoes();
  if (!contexto) return null;

  const { itens, naoLidas, aberto, setAberto, marcarLida, lerTodas } = contexto;

  return (
    <div className="notificacoes">
      <button
        type="button"
        className="notificacoes-botao"
        aria-label={`Notificações${naoLidas ? `, ${naoLidas} por ler` : ""}`}
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
      >
        <span aria-hidden="true">🔔</span>
        {naoLidas > 0 && <span className="notificacoes-contador">{naoLidas}</span>}
      </button>

      {aberto && (
        <div className="notificacoes-painel">
          <div className="notificacoes-cabecalho">
            <strong>Notificações</strong>
            {naoLidas > 0 && (
              <button type="button" onClick={lerTodas}>Marcar todas como lidas</button>
            )}
          </div>
          {itens.length === 0 ? (
            <p className="notificacoes-vazio">Ainda não tens notificações.</p>
          ) : (
            <ul>
              {itens.map((item) => (
                <li key={item._id} className={item.lida ? "" : "por-ler"}>
                  <Link
                    to={`/pedidos/${item.pedidoId}`}
                    onClick={() => {
                      marcarLida(item._id);
                      setAberto(false);
                    }}
                  >
                    <strong>{item.titulo}</strong>
                    <span>{item.texto}</span>
                    <small>{formatDateTime(item.createdAt)}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
