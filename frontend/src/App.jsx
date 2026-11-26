import { Link, Route, Routes, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import ServiceDetailPage from "./pages/ServiceDetailPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";
import MyServicesPage from "./pages/MyServicesPage.jsx";
import ProviderPage from "./pages/ProviderPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import { NotificationProvider, NotificationBell } from "./components/NotificationCenter.jsx";

export default function App() {
  const rota = useLocation().pathname;
  const eInicio = rota === "/";

  return (
    <NotificationProvider>
    <main className={eInicio ? "page-shell page-shell-home" : "page-shell"}>
      {!eInicio && (
      <header className="border-b border-brand-line bg-white [&_a]:no-underline">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight text-brand-navy" aria-label="ServiPerto, início">
            servi<span className="text-brand-purple">perto</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm sm:gap-2" aria-label="Navegação principal">
            {[
              ["/", "Explorar"],
              ["/pedidos", "Os meus pedidos"],
              ["/conta", "A minha conta"],
            ].map(([destino, titulo]) => (
              <Link
                key={destino}
                to={destino}
                className={`rounded-full px-3 py-2 font-semibold transition-colors hover:bg-brand-mist sm:px-4 ${
                  rota === destino ? "text-brand-purpleDark" : "text-brand-navy"
                }`}
              >
                {titulo}
              </Link>
            ))}
            <NotificationBell />
          </nav>
        </div>
      </header>
      )}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/servico/:id" element={<ServiceDetailPage />} />
        <Route path="/prestador/:uid" element={<ProviderPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/pedidos" element={<OrdersPage />} />
        <Route path="/pedidos/:id" element={<OrderDetailPage />} />
        <Route path="/servicos" element={<MyServicesPage />} />
        <Route path="/conta" element={<AccountPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>

      {!eInicio && (
        <footer className="footer"><span>© 2026 ServiPerto</span><span>Feito para aproximar pessoas.</span></footer>
      )}
    </main>
    </NotificationProvider>
  );
}
