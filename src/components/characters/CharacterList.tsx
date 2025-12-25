import { useState, useRef } from 'react';
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
    importFromPng,
  } = useCharacters();

  const { currentCharacter, setCurrentCharacter } = useRoleplayStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] =
    useState<CharacterCardWithPath | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    if (!file.type.includes('png')) {
      setImportError('Please select a PNG file');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const imported = await importFromPng(arrayBuffer);
      if (imported) {
        setCurrentCharacter(imported);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import character');
    } finally {
      setIsImporting(false);
    }
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
        <div className="mianix-header-actions">
          <button onClick={handleImportClick} disabled={isImporting} title="Import PNG">
            {isImporting ? '...' : '📥'}
          </button>
          <button onClick={handleCreate} title="Create new">+</button>
        </div>
      </div>

      {/* Hidden file input for PNG import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Import error message */}
      {importError && (
        <div className="mianix-import-error">
          {importError}
          <button onClick={() => setImportError(null)}>✕</button>
        </div>
      )}

      {characters.length === 0 ? (
        <div className="mianix-empty-state">
          <p>No characters yet.</p>
          <button onClick={handleImportClick}>Import PNG Card</button>
          <button onClick={handleCreate}>Create Manually</button>
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
