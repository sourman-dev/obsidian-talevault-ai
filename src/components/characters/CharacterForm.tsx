import { useState, useEffect } from 'react';
import type { CharacterFormData, CharacterCardWithPath } from '../../types';

interface CharacterFormProps {
  initialData?: CharacterCardWithPath;
  onSubmit: (data: CharacterFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function CharacterForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: CharacterFormProps) {
  const [formData, setFormData] = useState<CharacterFormData>({
    name: '',
    description: '',
    personality: '',
    scenario: '',
    firstMessage: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        description: initialData.description,
        personality: initialData.personality,
        scenario: initialData.scenario,
        firstMessage: initialData.firstMessage,
      });
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    await onSubmit(formData);
  };

  return (
    <form className="mianix-character-form" onSubmit={handleSubmit}>
      <div className="mianix-form-field">
        <label htmlFor="name">Name *</label>
        <input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder="Character name"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="mianix-form-field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Character description..."
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      <div className="mianix-form-field">
        <label htmlFor="personality">Personality</label>
        <textarea
          id="personality"
          name="personality"
          value={formData.personality}
          onChange={handleChange}
          placeholder="Personality traits..."
          rows={2}
          disabled={isSubmitting}
        />
      </div>

      <div className="mianix-form-field">
        <label htmlFor="scenario">Scenario</label>
        <textarea
          id="scenario"
          name="scenario"
          value={formData.scenario}
          onChange={handleChange}
          placeholder="Setting/context..."
          rows={2}
          disabled={isSubmitting}
        />
      </div>

      <div className="mianix-form-field">
        <label htmlFor="firstMessage">First Message</label>
        <textarea
          id="firstMessage"
          name="firstMessage"
          value={formData.firstMessage}
          onChange={handleChange}
          placeholder="Character's opening message..."
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      <div className="mianix-form-actions">
        <button type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button
          type="submit"
          className="mianix-btn-primary"
          disabled={isSubmitting || !formData.name.trim()}
        >
          {isSubmitting ? 'Saving...' : initialData ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}
