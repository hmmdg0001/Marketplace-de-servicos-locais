import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { auth } from "../firebase.js";
import { apiBase, readJson, apiErrorMessage, formatPrice } from "../lib/api.js";
import ServiceForm from "../components/ServiceForm.jsx";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";

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
    return <div className="min-h-screen bg-brand-mist py-20 text-center text-brand-muted">A carregar…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-mist px-5 py-20 text-center">
        <h1 className="font-display text-4xl font-extrabold text-brand-navy">Entra para veres os teus serviços</h1>
        <p className="mt-3 text-brand-muted">Precisas de sessão iniciada para gerir os teus serviços.</p>
        <Button asChild className="mt-7">
          <Link to="/conta">Iniciar sessão <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-mist font-sans text-brand-ink [&_a]:no-underline">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="outline" className="uppercase tracking-widest text-brand-muted">Os meus serviços</Badge>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-brand-navy md:text-5xl">
              Os meus serviços
            </h1>
            <p className="mt-3 text-brand-muted">Gere os serviços que publicaste na plataforma.</p>
          </div>
          <Button
            type="button"
            onClick={() => {
              setFormulario(formulario ? null : { servico: null });
              setNotice({ text: "", kind: "success" });
            }}
            disabled={busy}
          >
            {formulario && !formulario.servico ? <><Trash2 className="h-4 w-4" /> Cancelar</> : <><Plus className="h-4 w-4" /> Criar novo serviço</>}
          </Button>
        </div>

        {notice.text && (
          <p className={`mt-6 rounded-lg p-3 text-sm ${notice.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} role="status">
            {notice.text}
          </p>
        )}

        {formulario && (
          <div className="mt-6">
            <ServiceForm
              user={user}
              categories={categories}
              servico={formulario.servico}
              onSaved={handleSaved}
              onCancel={() => setFormulario(null)}
            />
          </div>
        )}

        {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <p className="mt-8 text-sm text-brand-muted">
          {loading ? "A carregar serviços…" : `${services.length} serviço(s)`}
        </p>

        {!loading && !error && services.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-brand-line bg-white p-10 text-center">
            <BriefcaseBusiness className="mx-auto h-8 w-8 text-brand-purpleDark" />
            <p className="mt-3 text-sm text-brand-muted">Ainda não publicaste serviços. Cria o teu primeiro serviço.</p>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {services.map((svc) => (
            <Card key={svc._id} className="p-5">
              <CardContent className="flex flex-wrap items-center gap-5 p-0">
                {svc.imagens?.[0] ? (
                  <img src={svc.imagens[0]} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-brand-mist text-brand-muted">✳</div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-brand-navy">{svc.titulo || svc.title}</h2>
                    <Badge variant={svc.ativo === false ? "outline" : "success"}>
                      {svc.ativo === false ? "Desativado" : "Ativo"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-brand-purpleDark">
                    {svc.categoria?.nome || "Serviço"}
                  </p>
                  {(svc.descricao || svc.description) && (
                    <p className="mt-1 line-clamp-2 text-sm text-brand-muted">{svc.descricao || svc.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brand-muted">
                    {svc.zona && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-brand-purpleDark" /> {svc.zona}</span>}
                    {(svc.preco > 0 || svc.price > 0) && <strong className="text-brand-navy">{formatPrice(svc.preco || svc.price)}</strong>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" type="button" onClick={() => handleToggleAtivo(svc)} disabled={busy}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> {svc.ativo === false ? "Ativar" : "Desativar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setFormulario({ servico: svc });
                      setNotice({ text: "", kind: "success" });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={busy}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    className="text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(svc)}
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Apagar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
