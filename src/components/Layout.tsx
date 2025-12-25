import type { ReactNode } from 'react';
import { useRoleplayStore } from '../store';
import type { CharacterCardWithPath } from '../types';

interface LayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
}

export function Layout({ sidebar, main }: LayoutProps) {
  return (
    <div className="mianix-layout">
      <aside className="mianix-sidebar">{sidebar}</aside>
      <main className="mianix-main">{main}</main>
    </div>
  );
}

// Sidebar with character list placeholder
export function Sidebar() {
  const { characters, currentCharacter, setCurrentCharacter } = useRoleplayStore();

  return (
    <div className="mianix-sidebar-content">
      <div className="mianix-sidebar-header">
        <h3>Characters</h3>
      </div>

      {characters.length === 0 ? (
        <p className="mianix-placeholder">No characters yet</p>
      ) : (
        <div className="mianix-character-list">
          {characters.map((char) => (
            <CharacterItem
              key={char.id}
              character={char}
              isActive={currentCharacter?.id === char.id}
              onClick={() => setCurrentCharacter(char)}
            />
          ))}
        </div>
      )}

      <button className="mianix-btn mianix-btn-primary mianix-add-character">
        + New Character
      </button>
    </div>
  );
}

interface CharacterItemProps {
  character: CharacterCardWithPath;
  isActive: boolean;
  onClick: () => void;
}

function CharacterItem({ character, isActive, onClick }: CharacterItemProps) {
  return (
    <div
      className={`mianix-character-item ${isActive ? 'is-active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="mianix-character-avatar">
        {character.avatarUrl ? (
          <img src={character.avatarUrl} alt={character.name} />
        ) : (
          <div className="mianix-avatar-placeholder">
            {character.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="mianix-character-info">
        <span className="mianix-character-name">{character.name}</span>
        <span className="mianix-character-desc">
          {character.description.slice(0, 50)}
          {character.description.length > 50 ? '...' : ''}
        </span>
      </div>
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
