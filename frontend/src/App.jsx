import React, { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase.js";

const apiBase = "/api";

const friendlyErrors = {
  "auth/email-already-in-use": "Este email já tem uma conta. Tenta iniciar sessão.",
  "auth/invalid-email": "O email não parece estar correto.",
  "auth/invalid-credential": "Email ou palavra-passe incorretos.",
  "auth/weak-password": "Escolhe uma palavra-passe com pelo menos 6 caracteres.",
  "auth/too-many-requests": "Foram feitas demasiadas tentativas. Tenta novamente mais tarde.",
  "auth/network-request-failed": "Não foi possível ligar. Verifica a tua ligação à internet.",
  "auth/operation-not-allowed": "O registo por email ainda não está ativado no Firebase. Ativa o método Email/Palavra-passe em Authentication → Sign-in method.",
  "auth/invalid-api-key": "A chave Firebase parece inválida. Confirma VITE_FIREBASE_API_KEY no frontend/.env.local.",
  "auth/app-not-authorized": "Este domínio ainda não está autorizado nas definições do Firebase Authentication.",
  "auth/configuration-not-found": "A configuração do Authentication não está concluída no projeto Firebase.",
  "auth/quota-exceeded": "O limite de pedidos do Firebase foi atingido. Tenta novamente mais tarde.",
};

export default function App() {
  const [mode, setMode] = useState("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [services, setServices] = useState([]);
  const [ownServices, setOwnServices] = useState[];
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEmailSent, setProfileEmailSent] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const isRegister = mode === "register";

  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser && authReady) {
        fetch("/api/services", {
          credentials: "include",
        })
          .then((res) => res.json())
          .then((data) => setServices(data))
          .then(() =>
            fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                idToken: currentUser.getIdToken(),
              }),
            })
          )
          .then((res) => res.json())
          .then((data) => {
            if (data.user) setUser(Object.assign({}, data.user, { email: currentUser.email }));
            return fetch(`/api/services?userId=${currentUser.uid}`, {
              credentials: "include",
            });
          })
          .then((res) => res.json())
          .then((data) => setOwnServices(data))
          .catch((err) => console.error("Erro ao buscar serviços:", err));
      }
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      if (isRegister) {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(result.user, { displayName: name.trim() });
        setUser(result.user);
        setMessage("Conta criada. Bem-vindo/a ao ServiPerto!");

        await fetch(`${apiBase}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: result.user.email, password: password, name }),
        });
      } else if (showResetForm) {
        // Modo reset de palavra-passe
        if (!resetEmail) {
          setMessage("Por favor, introduz o teu email.");
          setBusy(false);
          return;
        }
        await fetch(`${apiBase}/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: resetEmail }),
        });
        setMessage("Email de reset de palavra-passe enviado! Verifica a tua caixa de entrada.");
        setShowResetForm(false);
        setResetEmail("");
        setBusy(false);
      } else {
        // Login normal
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        setMessage("Sessão iniciada com sucesso.");

        await fetch(`${apiBase}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: result.user.getIdToken() }),
        });
      }
    } catch (error) {
      setMessage(
        friendlyErrors[error.code] ?? "Não foi possível concluir. Tenta novamente."
      );
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    // Quando mudamos de modo, esconder o formulário de reset se estivermos a mudar de/register para login
    if (nextMode !== "reset") {
      setShowResetForm(false);
      setResetEmail("");
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut(auth);
      setMessage("Sessão terminada.");
      setUser(null);
      setServices([]);
      setOwnServices([]);
      setProfileEmailSent(false);
      setShowProfile(false);
      setShowResetForm(false);
      setResetEmail("");
    } catch (e) {
      setMessage("Não foi possível terminar a sessão. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  // Função para atualizar perfil
  async function handleProfileUpdate(event) {
    event.preventDefault();
    setProfileSaving(true);
    try {
      const { name, email } = event.target;
      await fetch(`${apiBase}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.name.value,
          email: email.email.value,
        }),
      });
      setMessage("Perfil atualizado com sucesso!");
      // Atualizar estado local do usuário
      setUser(prev => prev ? { ...prev, name: name.name.value, email: email.email.value } : null);
      setProfileSaving(false);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      setMessage("Erro ao atualizar perfil. Tenta novamente.");
      setProfileSaving(false);
    }
  }

  // Função para enviar email de verificação
  async function handleSendVerification() {
    setProfileEmailSent(false);
    try {
      await fetch(`${apiBase}/auth/send-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setProfileEmailSent(true);
      setMessage("Email de verificação enviado! Verifica a tua caixa de entrada.");
    } catch (error) {
      console.error("Erro ao enviar verificação:", error);
      setMessage("Erro ao enviar email de verificação. Tenta novamente.");
    }
  }

  // Função para enviar reset de palavra-passe
  async function handleResetSubmit(event) {
    event.preventDefault();
    if (!resetEmail) {
      setMessage("Por favor, introduz o teu email.");
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      await fetch(`${apiBase}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      setMessage("Email de reset de palavra-passe enviado! Verifica a tua caixa de entrada.");
      setShowResetForm(false);
      setResetEmail("");
    } catch (error) {
      console.error("Erro ao enviar reset de palavra-passe:", error);
      setMessage("Erro ao enviar reset de palavra-passe. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  // Buscar serviços ao montar
  useEffect(() => {
    if (authReady && user) {
      fetch("/api/services")
        .then((res) => res.json())
        .then((data) => setServices(data))
        .then(() =>
          fetch(`/api/services?userId=${user.uid}`, {
            credentials: "include",
          })
        )
        .then((res) => res.json())
        .then((data) => setOwnServices(data))
        .catch((err) => console.error("Erro:", err));
    }
  }, [authReady, user]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="ServiPerto, início">
          <span className="brand-mark" aria-hidden="true">s</span>
          <span>servi<span className="brand-accent">perto</span></span>
        </a>
        <span className="topbar-note">O talento da tua zona, mais perto.</span>
      </header>

      <section className="auth-layout" id="inicio">
        <div className="intro-panel">
          <div className="eyebrow"><span className="eyebrow-dot" /> A comunidade começa aqui</div>
          <h1>Há sempre alguém <em>por perto</em> que sabe como ajudar.</h1>
          <p className="intro-copy">Encontra profissionais de confiança na tua zona ou dá a conhecer o teu talento à comunidade.</p>
          <div className="neighbourhood-card">
            <div className="avatar-stack" aria-hidden="true"><span>m</span><span>j</span><span>r</span><span>+</span></div>
            <p><strong>Talento local, confiança real.</strong><br />Pequenos serviços. Grandes ligações.</p>
          </div>
          <div className="decor decor-one" /><div className="decor decor-two" />
        </div>

        {authReady && user ? (
          <div className="form-panel account-panel">
            <div className="account-avatar" aria-hidden="true">{(user.displayName || user.email || "S").charAt(0).toUpperCase()}</div>
            <p className="kicker">Sessão iniciada</p>
            <h2>Olá, {user.displayName || "bem-vindo/a"}.</h2>
            <p className="form-subtitle">A tua conta ServiPerto está pronta.</p>
            <p className="account-email">{user.email}</p>

            {/* Status de email verificado */}
            {user.emailVerified !== undefined && (
              <p className="form-message success">
                {user.emailVerified ? 'Email verificado ✓' : 'Email não verificado'}
              </p>
            )}

            {message && <p className="form-message error" role="status">{message}</p>}

            <button className="submit-button" type="button" onClick={handleSignOut} disabled={busy}>
              {busy ? "A terminando sessão…" : "Terminar sessão"}
              <span aria-hidden="true">→</span>
            </button>

            {/* Minhas services section */}
            {ownServices.length > 0 ? (
              <div className="services-section">
                <h3>Os meus serviços</h3>
                <ul>
                  {ownServices.map((svc) => (
                    <li key={svc._id}>
                      <strong>{svc.title}</strong>{' '}
                      {svc.description && <span>{svc.description}</span>}
                      {svc.location && <span>{svc.location}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>Nenhum serviço ainda. <a href="#/" onClick={() => setMode("register")}>Criar um serviço</a></p>
            )}

            {/* Minhas definições section - apenas quando não há serviços e não está em modo perfil */}
            {ownServices.length === 0 && !showProfile ? (
              <button className="submit-button" onClick={() => setShowProfile(true)} disabled={busy}>
                {busy ? "A carregar…" : "Minhas definições"}
              </button>
            ) : null}

            {/* Formulário de criar serviço aparece no modo create-service */}
            {mode === 'create-service' && authReady && user ? (
              <div>
                <h3>Criar novo serviço</h3>
                <p>Preenche o formulário abaixo para adicionar um novo serviço ao marketplace.</p>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const title = e.target.title.value;
                  fetch(`${apiBase}/services`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, description: e.target.description.value, location: e.target.location.value }),
                  }).then(() => {
                    alert("Serviço criado!");
                    setMode('register');
                  });
                }}>
                  <label>Título do serviço<input type="text" name="title" required /></label>
                  <label>Descrição<input type="text" name="description" placeholder="Descreve o serviço" /></label>
                  <label>Localização<input type="text" name="location" placeholder="Ex: Lisboa, Porto" /></label>
                  <button type="submit">Guardar serviço</button>
                  <button onClick={() => setMode('register')} type="button">Cancelar</button>
                </form>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="form-panel">
            <div className="form-heading">
              <div className="form-icon" aria-hidden="true">✳</div>
              <p className="kicker">A tua próxima ligação começa aqui</p>
              <h2>{isRegister ? "Junta-te à vizinhança." : "Que bom ver-te."}</h2>
              <p className="form-subtitle">
                {isRegister ? "Cria a tua conta gratuitamente." : "Entra na tua conta para continuar."}
              </p>
            </div>

            <div className="mode-switch" role="tablist" aria-label="Tipo de acesso">
              <button type="button" role="tab" aria-selected={isRegister} className={isRegister ? "selected" : ""} onClick={() => changeMode("register")}>Criar conta</button>
              <button type="button" role="tab" aria-selected={!isRegister} className={!isRegister ? "selected" : ""} onClick={() => changeMode("login")}>Iniciar sessão</button>
            </div>

            <form onSubmit={handleSubmit}>
              {isRegister && <label>Como te chamas?<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="O teu nome" required /></label>}
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ola@exemplo.pt" required /></label>
              <label>Palavra-passe<input type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Pelo menos 6 caracteres" minLength={6} required /></label>
              {message && <p className={`form-message ${message.startsWith("Não") || message.startsWith("Este") || message.startsWith("O email") || message.startsWith("Escolhe") || message.startsWith("Foram") ? "error" : "success"}`} role="status">{message}</p>}
              <button className="submit-button" type="submit" disabled={busy}>
                {busy ? "A processar…" : isRegister ? "Criar a minha conta" : "Entrar na minha conta"}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            {/* Link "Esqueci a palavra-passe" */}
            {isRegister ? null : (
              <p>
                <a onClick={() => setShowResetForm(true)} style={{cursor: 'pointer', textDecoration: 'underline'}}>
                  Esqueci a minha palavra-passe
                </a>
              </p>
            )}

            {/* Formulário de reset de palavra-passe */}
            {showResetForm && (
              <div className="form-panel">
                <h3>Reset de palavra-passe</h3>
                <p>Introduz o teu endereço de email para receber um link de reset.</p>
                <form onSubmit={handleResetSubmit}>
                  <label>Email<input type="email" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="ola@exemplo.pt" required /></label>
                  <button type="submit" disabled={busy}>{busy ? "A enviar…" : "Enviar link de reset"}</button>
                </form>
                {message && <p className="form-message success" role="status">{message}</p>}
                <button type="button" onClick={() => setShowResetForm(false)}>Cancelar</button>
              </div>
            )}

            <p className="terms">Ao continuar, aceitas os nossos <a href="#termos">Termos de utilização</a> e a <a href="#privacidade">Política de privacidade</a>.</p>
          </div>
        )}

        {/* Section for creating a service */}
        {mode === 'create-service' && authReady && user ? (
          <div className="form-panel">
            <h2>Criar novo serviço</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const title = e.target.title.value;
              fetch(`${apiBase}/services`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description: e.target.description.value, location: e.target.location.value }),
              }).then(() => {
                alert("Serviço criado!");
                setMode('register');
              });
            }}>
              <label>Título do serviço<input type="text" name="title" required /></label>
              <label>Descrição<input type="text" name="description" placeholder="Descreve o serviço" /></label>
              <label>Localização<input type="text" name="location" placeholder="Ex: Lisboa, Porto" /></label>
              <button type="submit">Guardar serviço</button>
            </form>
            <button onClick={() => setMode('register')} type="button">Cancelar</button>
          </div>
        ) : null}
      </section>

      <footer className="footer"><span>© 2026 ServiPerto</span><span>Feito para aproximar pessoas.</span></footer>
    </main>
  );
}