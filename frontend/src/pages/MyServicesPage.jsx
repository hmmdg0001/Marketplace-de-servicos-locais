import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { apiBase, readJson, apiErrorMessage, formatPrice } from "../lib/api.js";
import { PORTUGAL_CITIES } from "../data/cities.js";

export default function MyServicesPage() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ text: "", kind: "success" });
  const [showCreate, setShowCreate] = useState(false);
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

    const timer = setTimeout(() => {
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
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timer);
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
        <button className="submit-button" type="button" onClick={() => setShowCreate(!showCreate)} disabled={busy}>
          {showCreate ? "Cancelar" : "Criar novo serviço"}
        </button>
      </div>

      {notice.text && <p className={`form-message ${notice.kind}`} role="status">{notice.text}</p>}

      {showCreate && (
        <div className="settings-section" style={{ maxWidth: 600, margin: "0 auto 24px" }}>
          <h3>Criar novo serviço</h3>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const token = await user.getIdToken();
              const res = await fetch(`${apiBase}/services`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  titulo: e.target.title.value,
                  descricao: e.target.description.value,
                  categoriaId: e.target.categoria.value,
                  preco: Number(e.target.preco.value || 0),
                  zona: e.target.location.value,
                }),
              });
              const data = await readJson(res);
              if (!res.ok) throw new Error(apiErrorMessage(res, data, "Erro ao criar serviço"));
              setServices((prev) => [data, ...prev]);
              setNotice({ text: "Serviço criado com sucesso!", kind: "success" });
              setShowCreate(false);
            } catch (err) {
              setNotice({ text: err.message || "Erro ao criar serviço.", kind: "error" });
            } finally {
              setBusy(false);
            }
          }}>
            <label>Título do serviço<input type="text" name="title" required /></label>
            <label>Descrição<input type="text" name="description" placeholder="Descreve o serviço" /></label>
            <label>
              Categoria
              <select name="categoria" defaultValue="" required>
                <option value="" disabled>Escolhe a categoria</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.icone} {c.nome}</option>
                ))}
              </select>
            </label>
            <label>Preço (€)<input type="number" name="preco" min="0" step="0.01" placeholder="Ex: 29.90" required /></label>
            <label>
              Localização
              <select name="location" defaultValue="" required>
                <option value="" disabled>Escolhe a tua cidade</option>
                {PORTUGAL_CITIES.map((group) => (
                  <optgroup key={group.district} label={group.district}>
                    {group.cities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button className="submit-button" type="submit" disabled={busy}>{busy ? "A guardar…" : "Guardar serviço"}</button>
          </form>
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
            <div>
              <strong>{svc.titulo || svc.title}</strong>
              {(svc.descricao || svc.description) && <span>{svc.descricao || svc.description}</span>}
              {(svc.zona || svc.location) && <span>📍 {svc.zona || svc.location}</span>}
              {(svc.preco > 0 || svc.price > 0) && (
                <span>Desde {Number(svc.preco || svc.price).toFixed(2).replace(".", ",")} €</span>
              )}
            </div>
            <button className="danger-button" type="button" onClick={() => handleDelete(svc)} disabled={busy}>
              Apagar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}