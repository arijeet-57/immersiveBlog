import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import World from './scene/World';
import SmoothScrollProvider from './providers/SmoothScrollProvider';
import AppRoutes from './routes/AppRoutes';
import RouteSync from './routes/RouteSync';
import RevealLayer from './ui/RevealLayer';
import Hud from './ui/Hud';
import ScrollProgress from './ui/ScrollProgress';

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <RouteSync />
        <SmoothScrollProvider>
          <World />
          <AppRoutes />
          <RevealLayer />
          <Hud />
          <ScrollProgress />
          {/* Scrollable spacer — gives the page enough vertical length to
              cover all four acts. Longer = each panel range corresponds to
              more pixels, so the reader has more dwell time. RevealLayer
              is position:fixed so it renders over this spacer without
              taking layout space. */}
          <div aria-hidden="true" style={{ height: '1400vh' }} />
        </SmoothScrollProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
