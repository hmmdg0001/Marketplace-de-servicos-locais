import { Link, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import ServiceDetailPage from "./pages/ServiceDetailPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";

export default function App() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="ServiPerto, início">
          <span className="brand-mark" aria-hidden="true">s</span>
          <span>servi<span className="brand-accent">perto</span></span>
        </Link>

        <nav className="topbar-nav" aria-label="Navegação principal">
          <Link to="/">Explorar</Link>
          <Link to="/conta">A minha conta</Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/servico/:id" element={<ServiceDetailPage />} />
        <Route path="/conta" element={<AccountPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>

      <footer className="footer"><span>© 2026 ServiPerto</span><span>Feito para aproximar pessoas.</span></footer>
    </main>
  );
}
