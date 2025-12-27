import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/app-context';
import { CharacterService, type ImportOptions } from '../services/character-service';
import { useRoleplayStore } from '../store';
import type { CharacterCardWithPath, CharacterFormData } from '../types';

export function useCharacters() {
  const { app } = useApp();
  const { setCharacters, characters } = useRoleplayStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(() => new CharacterService(app), [app]);

  const loadCharacters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await service.list();
      setCharacters(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load characters');
    } finally {
      setIsLoading(false);
    }
  }, [service, setCharacters]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const createCharacter = async (data: CharacterFormData) => {
    const created = await service.create(data);
    setCharacters([created, ...characters]);
    return created;
  };

  const updateCharacter = async (
    folderPath: string,
    data: Partial<CharacterFormData>
  ) => {
    const updated = await service.update(folderPath, data);
    if (updated) {
      setCharacters(
        characters.map((c) => (c.folderPath === folderPath ? updated : c))
      );
    }
    return updated;
  };

  const deleteCharacter = async (folderPath: string) => {
    const success = await service.delete(folderPath);
    if (success) {
      setCharacters(characters.filter((c) => c.folderPath !== folderPath));
    }
    return success;
  };

  const importFromPng = async (pngArrayBuffer: ArrayBuffer, options?: ImportOptions) => {
    const imported = await service.importFromPng(pngArrayBuffer, options);
    if (imported) {
      setCharacters([imported, ...characters]);
    }
    return imported;
  };

  return {
    characters,
    isLoading,
    error,
    reload: loadCharacters,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    importFromPng,
  };
}
