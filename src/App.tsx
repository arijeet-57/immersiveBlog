import World from './scene/World';
import SmoothScrollProvider from './providers/SmoothScrollProvider';

export default function App() {
  return (
    <SmoothScrollProvider>
      <World />
      <div aria-hidden="true" style={{ height: '500vh' }} />
    </SmoothScrollProvider>
  );
}
