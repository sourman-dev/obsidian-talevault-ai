import { useRoleplayStore } from '../store';
import { Layout, Sidebar, MainContent } from './Layout';

export function App() {
  const { isLoading, error, setError } = useRoleplayStore();

  return (
    <div className="mianix-roleplay-container">
      {error && (
        <div className="mianix-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <Layout sidebar={<Sidebar />} main={<MainContent />} />

      {isLoading && <div className="mianix-loading">Loading...</div>}
    </div>
  );
}
