import { useState } from 'react';
import { useCharacters } from '../../hooks/use-characters';
import { useRoleplayStore } from '../../store';
import { CharacterForm } from './CharacterForm';
import { Modal } from '../ui/Modal';
import type { CharacterCardWithPath, CharacterFormData } from '../../types';

export function CharacterList() {
  const {
    characters,
    isLoading,
    error,
    reload,
    createCharacter,
    updateCharacter,
    deleteCharacter,
  } = useCharacters();

  const { currentCharacter, setCurrentCharacter } = useRoleplayStore();

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] =
    useState<CharacterCardWithPath | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingCharacter(null);
    setIsFormOpen(true);
  };

  const handleEdit = (char: CharacterCardWithPath) => {
    setEditingCharacter(char);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: CharacterFormData) => {
    setIsSubmitting(true);
    try {
      if (editingCharacter) {
        await updateCharacter(editingCharacter.folderPath, data);
      } else {
        const created = await createCharacter(data);
        setCurrentCharacter(created);
      }
      setIsFormOpen(false);
      setEditingCharacter(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (folderPath: string) => {
    await deleteCharacter(folderPath);
    if (currentCharacter?.folderPath === folderPath) {
      setCurrentCharacter(null);
    }
    setDeleteConfirm(null);
  };

  if (isLoading) {
    return <div className="mianix-loading-text">Loading characters...</div>;
  }

  if (error) {
    return (
      <div className="mianix-error-text">
        {error}
        <button onClick={reload}>Retry</button>
      </div>
    );
  }

  return (
    <div className="mianix-character-list-container">
      <div className="mianix-list-header">
        <span>Characters ({characters.length})</span>
        <button onClick={handleCreate}>+ New</button>
      </div>

      {characters.length === 0 ? (
        <div className="mianix-empty-state">
          No characters yet.
          <button onClick={handleCreate}>Create your first character</button>
        </div>
      ) : (
        <div className="mianix-character-list">
          {characters.map((char) => (
            <div
              key={char.id}
              className={`mianix-character-item ${currentCharacter?.id === char.id ? 'is-active' : ''}`}
              onClick={() => setCurrentCharacter(char)}
            >
              <div className="mianix-character-avatar">
                {char.avatarUrl ? (
                  <img src={char.avatarUrl} alt={char.name} />
                ) : (
                  <div className="mianix-avatar-placeholder">
                    {char.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="mianix-character-info">
                <span className="mianix-character-name">{char.name}</span>
                <span className="mianix-character-desc">
                  {char.description.slice(0, 40) || 'No description'}
                  {char.description.length > 40 ? '...' : ''}
                </span>
              </div>
              <div className="mianix-character-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(char);
                  }}
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(char.folderPath);
                  }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCharacter ? 'Edit Character' : 'New Character'}
      >
        <CharacterForm
          initialData={editingCharacter || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setIsFormOpen(false)}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Character?"
      >
        <p>This will move the character folder to trash.</p>
        <div className="mianix-form-actions">
          <button onClick={() => setDeleteConfirm(null)}>Cancel</button>
          <button
            className="mianix-btn-danger"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
