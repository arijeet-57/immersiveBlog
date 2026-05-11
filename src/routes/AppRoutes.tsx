import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import ChroniclesIndex from './ChroniclesIndex';
import ChroniclePost from './ChroniclePost';
import Sanctuary from './Sanctuary';
import Whispers from './Whispers';
import NotFound from './NotFound';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/chronicles" element={<ChroniclesIndex />} />
      <Route path="/chronicles/:slug" element={<ChroniclePost />} />
      <Route path="/sanctuary" element={<Sanctuary />} />
      <Route path="/whispers" element={<Whispers />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
