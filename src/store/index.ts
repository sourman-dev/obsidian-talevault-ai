import { create } from 'zustand';
import type { CharacterCardWithPath, DialogueMessageWithContent } from '../types';

interface RoleplayState {
  // Character list
  characters: CharacterCardWithPath[];

  // Current state
  currentCharacter: CharacterCardWithPath | null;
  currentDialogueId: string | null;
  messages: DialogueMessageWithContent[];

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setCharacters: (characters: CharacterCardWithPath[]) => void;
  setCurrentCharacter: (char: CharacterCardWithPath | null) => void;
  setMessages: (messages: DialogueMessageWithContent[]) => void;
  addMessage: (message: DialogueMessageWithContent) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  characters: [],
  currentCharacter: null,
  currentDialogueId: null,
  messages: [],
  isLoading: false,
  error: null,
};

export const useRoleplayStore = create<RoleplayState>((set) => ({
  ...initialState,

  setCharacters: (characters) => set({ characters }),

  setCurrentCharacter: (char) =>
    set({ currentCharacter: char, messages: [], currentDialogueId: null }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
