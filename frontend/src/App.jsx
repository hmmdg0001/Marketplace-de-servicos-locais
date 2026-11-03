import React, { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase.js";

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
  const isRegister = mode === "register";

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setAuthReady(true);
  }), []);

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
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setMessage("Sessão iniciada com sucesso.");
      }
    } catch (error) {
      setMessage(friendlyErrors[error.code] ?? "Não foi possível concluir. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setMessage("");
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut(auth);
    } catch {
      setMessage("Não foi possível terminar a sessão. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

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
            {message && <p className="form-message error" role="status">{message}</p>}
            <button className="submit-button" type="button" onClick={handleSignOut} disabled={busy}>{busy ? "A terminar sessão…" : "Terminar sessão"}<span aria-hidden="true">→</span></button>
          </div>
        ) : (
        <div className="form-panel">
          <div className="form-heading">
            <div className="form-icon" aria-hidden="true">✳</div>
            <p className="kicker">A tua próxima ligação começa aqui</p>
            <h2>{isRegister ? "Junta-te à vizinhança." : "Que bom ver-te."}</h2>
            <p className="form-subtitle">{isRegister ? "Cria a tua conta gratuitamente." : "Entra na tua conta para continuar."}</p>
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
            <button className="submit-button" type="submit" disabled={busy}>{busy ? "A processar…" : isRegister ? "Criar a minha conta" : "Entrar na minha conta"}<span aria-hidden="true">→</span></button>
          </form>
          <p className="terms">Ao continuar, aceitas os nossos <a href="#termos">Termos de utilização</a> e a <a href="#privacidade">Política de privacidade</a>.</p>
        </div>
        )}
      </section>

      <footer className="footer"><span>© 2026 ServiPerto</span><span>Feito para aproximar pessoas.</span></footer>
    </main>
  );
}
