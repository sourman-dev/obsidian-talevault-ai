import { useState, useRef } from 'react';
import { useCharacters } from '../../hooks/use-characters';
import { useRoleplayStore } from '../../store';
import { useApp } from '../../context/app-context';
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

  const { settings } = useApp();
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

  // Import options modal state
  const [pendingImport, setPendingImport] = useState<ArrayBuffer | null>(null);

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

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Show import options modal
      setPendingImport(arrayBuffer);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to read file');
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;

    setIsImporting(true);
    setImportError(null);
    setPendingImport(null);

    try {
      // Stats and NPC extraction disabled - controlled by feature toggles
      const imported = await importFromPng(pendingImport, {
        initializeStats: settings.enableStats,
        extractNPCs: settings.enableNPCExtraction,
        settings: settings.enableNPCExtraction ? settings : undefined,
      });
      if (imported) {
        // Reload list to get fresh data with correct avatarUrl
        await reload();
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
          <p className="mianix-empty-hint">Use the buttons above to import or create a character.</p>
        </div>
      ) : (
        <div className="mianix-character-selector">
          <select
            className="mianix-character-select"
            value={currentCharacter?.id || ''}
            onChange={(e) => {
              const selected = characters.find((c) => c.id === e.target.value);
              setCurrentCharacter(selected || null);
            }}
          >
            <option value="">-- Select character --</option>
            {characters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.name}
              </option>
            ))}
          </select>
          {currentCharacter && (
            <div className="mianix-selected-actions">
              <button
                onClick={() => handleEdit(currentCharacter)}
                title="Edit"
              >
                ✎
              </button>
              <button
                onClick={() => setDeleteConfirm(currentCharacter.folderPath)}
                title="Delete"
              >
                ✕
              </button>
            </div>
          )}
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

      {/* Import Options Modal */}
      <Modal
        isOpen={!!pendingImport}
        onClose={() => setPendingImport(null)}
        title="Import Character"
      >
        <div className="mianix-import-options">
          <p>Import character from PNG file?</p>
        </div>
        <div className="mianix-form-actions">
          <button onClick={() => setPendingImport(null)}>Cancel</button>
          <button
            className="mianix-btn-primary"
            onClick={handleConfirmImport}
            disabled={isImporting}
          >
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </Modal>

      {/* Version badge */}
      <div className="mianix-version-badge">v0.2.6</div>
    </div>
  );
}
