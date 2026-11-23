import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { apiBase, readJson, apiErrorMessage, formatPrice } from "../lib/api.js";
import ServiceForm from "../components/ServiceForm.jsx";

export default function MyServicesPage() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ text: "", kind: "success" });
  const [formulario, setFormulario] = useState(null); // null | { servico: null | object }
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    fetch(`${apiBase}/categories`)
      .then(readJson)
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setServices([]);
      setLoading(false);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError("");

    user.getIdToken()
      .then((token) =>
        fetch(`${apiBase}/services?userId=${user.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(readJson)
      .then((data) => {
        if (cancelado) return;
        if (data.error) setError(data.error);
        else setServices(Array.isArray(data) ? data : []);
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
  }, [user]);

  async function handleDelete(service) {
    if (!window.confirm(`Queres apagar o serviço "${service.titulo || service.title}"?`)) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/services/${service._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao apagar serviço"));
      setServices((prev) => prev.filter((s) => s._id !== service._id));
      setNotice({ text: "Serviço apagado.", kind: "success" });
    } catch (err) {
      setNotice({ text: err.message || "Erro ao apagar serviço.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAtivo(service) {
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${apiBase}/services/${service._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ativo: !service.ativo }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao alterar o serviço"));
      setServices((prev) =>
        prev.map((s) => (s._id === service._id ? { ...s, ativo: data.ativo } : s))
      );
      setNotice({ text: service.ativo ? "Serviço desativado." : "Serviço ativado.", kind: "success" });
    } catch (err) {
      setNotice({ text: err.message || "Erro ao alterar o serviço.", kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  function handleSaved(servico) {
    const editado = Boolean(formulario?.servico);
    const completo = {
      ...servico,
      categoria: servico.categoria || categories.find((c) => c._id === servico.categoriaId),
    };
    setServices((prev) =>
      editado ? prev.map((s) => (s._id === servico._id ? completo : s)) : [completo, ...prev]
    );
    setFormulario(null);
    setNotice({ text: editado ? "Serviço atualizado." : "Serviço criado com sucesso!", kind: "success" });
  }

  if (!authReady) {
    return <section className="catalog-page"><p className="catalog-count">A carregar…</p></section>;
  }

  if (!user) {
    return (
      <section className="catalog-page">
        <div className="catalog-hero">
          <p className="kicker">Os meus serviços</p>
          <h1>Entra para veres os teus serviços</h1>
          <p className="catalog-subtitle">Precisas de sessão iniciada para gerir os teus serviços.</p>
          <Link className="submit-button" to="/conta">Iniciar sessão</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page">
      <div className="catalog-hero">
        <p className="kicker">Os meus serviços</p>
        <h1>Os meus serviços</h1>
        <p className="catalog-subtitle">Gere os serviços que publicaste na plataforma.</p>
        <button
          className="submit-button"
          type="button"
          onClick={() => {
            setFormulario(formulario ? null : { servico: null });
            setNotice({ text: "", kind: "success" });
          }}
          disabled={busy}
        >
          {formulario && !formulario.servico ? "Cancelar" : "Criar novo serviço"}
        </button>
      </div>

      {notice.text && <p className={`form-message ${notice.kind}`} role="status">{notice.text}</p>}

      {formulario && (
        <div style={{ maxWidth: 600, margin: "0 auto 24px" }}>
          <ServiceForm
            user={user}
            categories={categories}
            servico={formulario.servico}
            onSaved={handleSaved}
            onCancel={() => setFormulario(null)}
          />
        </div>
      )}

      <p className="catalog-count">
        {loading ? "A carregar serviços…" : `${services.length} serviço(s)`}
      </p>

      {error && <p className="form-message error">{error}</p>}

      {!loading && !error && services.length === 0 && (
        <p className="catalog-empty">Ainda não publicaste serviços. Cria o teu primeiro serviço.</p>
      )}

      <ul className="service-list" style={{ maxWidth: 780, margin: "0 auto" }}>
        {services.map((svc) => (
          <li key={svc._id} className="service-item">
            <div className="service-item-info">
              {svc.imagens?.[0] && (
                <img className="service-item-thumb" src={svc.imagens[0]} alt="" loading="lazy" />
              )}
              <div>
                <strong>{svc.titulo || svc.title}</strong>
                {svc.ativo === false && <span>Serviço desativado</span>}
                {(svc.categoria?.nome) && <span>{svc.categoria.nome}</span>}
                {(svc.descricao || svc.description) && <span>{svc.descricao || svc.description}</span>}
                {(svc.zona || svc.location) && <span>📍 {svc.zona || svc.location}</span>}
                {(svc.preco > 0 || svc.price > 0) && <span>{formatPrice(svc.preco || svc.price)}</span>}
              </div>
            </div>
            <div className="service-item-actions">
              <button
                className="submit-button compact-button"
                type="button"
                onClick={() => handleToggleAtivo(svc)}
                disabled={busy}
              >
                {svc.ativo === false ? "Ativar" : "Desativar"}
              </button>
              <button
                className="submit-button compact-button"
                type="button"
                onClick={() => {
                  setFormulario({ servico: svc });
                  setNotice({ text: "", kind: "success" });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={busy}
              >
                Editar
              </button>
              <button className="danger-button" type="button" onClick={() => handleDelete(svc)} disabled={busy}>
                Apagar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
