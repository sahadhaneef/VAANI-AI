import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import History from './pages/History';
import Profile from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-dvh w-full bg-[#f8faff] text-slate-900">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

