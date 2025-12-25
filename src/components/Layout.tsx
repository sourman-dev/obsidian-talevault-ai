import type { ReactNode } from 'react';
import { CharacterList } from './characters/CharacterList';
import { useRoleplayStore } from '../store';

interface LayoutProps {
  main: ReactNode;
}

export function Layout({ main }: LayoutProps) {
  return (
    <div className="mianix-layout">
      <aside className="mianix-sidebar">
        <CharacterList />
      </aside>
      <main className="mianix-main">{main}</main>
    </div>
  );
}

// Main content area
export function MainContent() {
  const { currentCharacter } = useRoleplayStore();

  if (!currentCharacter) {
    return (
      <div className="mianix-main-content mianix-main-empty">
        <p className="mianix-placeholder">Select a character to start</p>
      </div>
    );
  }

  return (
    <div className="mianix-main-content">
      <div className="mianix-chat-header">
        <div className="mianix-chat-avatar">
          {currentCharacter.avatarUrl ? (
            <img src={currentCharacter.avatarUrl} alt={currentCharacter.name} />
          ) : (
            <div className="mianix-avatar-placeholder">
              {currentCharacter.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="mianix-chat-info">
          <h3>{currentCharacter.name}</h3>
          <p>{currentCharacter.description}</p>
        </div>
      </div>

      <div className="mianix-chat-messages">
        <p className="mianix-placeholder">Chat interface (Phase 4)</p>
      </div>

      <div className="mianix-chat-input">
        <p className="mianix-placeholder">Input area (Phase 4)</p>
      </div>
    </div>
  );
}
