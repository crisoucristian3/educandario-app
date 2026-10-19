import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Login } from "./pages/Login.jsx";
import { DashboardGestor } from "./pages/DashboardGestor.jsx";
import { DashboardResponsavel } from "./pages/DashboardResponsavel.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* O responsável pode entrar pela raiz, pelo dashboard ou pelo link direto do WhatsApp/E-mail */}
        <Route path="/" element={<DashboardResponsavel />} />
        <Route path="/dashboard-responsavel" element={<DashboardResponsavel />} />
        <Route path="/assinar/:token" element={<DashboardResponsavel />} />

        {/* Rotas exclusivas do Gestor */}
        <Route path="/gestor" element={<Login tipo="gestor" />} />
        <Route path="/dashboard-gestor" element={<DashboardGestor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;