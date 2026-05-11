import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import World from './scene/World';
import SmoothScrollProvider from './providers/SmoothScrollProvider';
import AppRoutes from './routes/AppRoutes';
import RouteSync from './routes/RouteSync';

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <RouteSync />
        <SmoothScrollProvider>
          <World />
          <AppRoutes />
          <div aria-hidden="true" style={{ height: '500vh' }} />
        </SmoothScrollProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
