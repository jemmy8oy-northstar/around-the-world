import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireSession } from "./components/RequireSession";
import Join from "./pages/Join";
import Feed from "./pages/Feed";
import WorldMap from "./pages/WorldMap";
import Compose from "./pages/Compose";
import Board from "./pages/Board";
import CountryFeed from "./pages/CountryFeed";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/join" element={<Join />} />

        {/* Unlisted and key-gated — deliberately outside the tab shell. */}
        <Route path="/admin" element={<Admin />} />

        <Route
          path="*"
          element={
            <RequireSession>
              <AppShell>
                <Routes>
                  <Route path="/" element={<Feed />} />
                  <Route path="/map" element={<WorldMap />} />
                  <Route path="/post" element={<Compose />} />
                  <Route path="/board" element={<Board />} />
                  <Route
                    path="/country/:countryCode"
                    element={<CountryFeed />}
                  />
                </Routes>
              </AppShell>
            </RequireSession>
          }
        />
      </Routes>
    </Router>
  );
}
