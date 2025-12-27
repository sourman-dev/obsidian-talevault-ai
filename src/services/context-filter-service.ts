/**
 * Context Filter Service - Filters Director output based on POV mode
 * Ensures Narrator only sees what the POV character can observe
 */

import type { POVMode, CharacterCardWithPath } from '../types';

/**
 * ContextFilterService filters Director output for Narrator
 * based on the selected POV mode
 */
export class ContextFilterService {
  /**
   * Filter context based on POV mode
   * @param directorOutput - Raw scene instructions from Director
   * @param povMode - Current POV mode
   * @param povCharacterId - Character ID for POV perspective
   * @param mainCharacter - Main character info
   */
  filterForPOV(
    directorOutput: string,
    povMode: POVMode,
    povCharacterId: string | undefined,
    mainCharacter: CharacterCardWithPath
  ): { filteredContext: string; povRules: string } {
    switch (povMode) {
      case 'fixed':
        return this.filterForFixedPOV(directorOutput, mainCharacter);

      case 'switchable':
        return this.filterForSwitchablePOV(
          directorOutput,
          povCharacterId || mainCharacter.id,
          mainCharacter
        );

      case 'any':
        return this.formatForAnyPOV(directorOutput, mainCharacter);

      default:
        // No filtering if POV mode not set
        return { filteredContext: directorOutput, povRules: '' };
    }
  }

  /**
   * Fixed POV - User is always one character (main character)
   * Filter to only what main character can observe
   */
  private filterForFixedPOV(
    directorOutput: string,
    mainCharacter: CharacterCardWithPath
  ): { filteredContext: string; povRules: string } {
    const povRules = `
## POV Rules (Fixed - ${mainCharacter.name})
- Write from ${mainCharacter.name}'s perspective ONLY
- You CANNOT know what others are thinking
- You can only describe what ${mainCharacter.name} observes
- Other characters' motivations are hidden from you
- React only to observable actions and spoken words`;

    return {
      filteredContext: directorOutput,
      povRules,
    };
  }

  /**
   * Switchable POV - User can switch between characters per turn
   * Filter to selected character's perspective
   */
  private filterForSwitchablePOV(
    directorOutput: string,
    povCharacterId: string,
    mainCharacter: CharacterCardWithPath
  ): { filteredContext: string; povRules: string } {
    // For now, use main character name (future: lookup by ID)
    const charName = mainCharacter.id === povCharacterId
      ? mainCharacter.name
      : `Character ${povCharacterId}`;

    const povRules = `
## POV Rules (Switchable - ${charName})
- Write from ${charName}'s perspective ONLY
- You CANNOT know what others are thinking
- Describe only what ${charName} can observe
- Hidden information stays hidden until revealed through action`;

    return {
      filteredContext: directorOutput,
      povRules,
    };
  }

  /**
   * Any POV - Multi-perspective mode with strict markers
   * User controls multiple characters, each with clear boundaries
   */
  private formatForAnyPOV(
    directorOutput: string,
    mainCharacter: CharacterCardWithPath
  ): { filteredContext: string; povRules: string } {
    const povRules = `
## POV Rules (Any - Multi-Perspective)
You may write from multiple character perspectives with STRICT boundaries:

### Marker Format
Use clear POV markers for each perspective shift:
> [Character's POV] their experience...

### CRITICAL RULES
1. One paragraph = one character's POV only
2. Character A CANNOT react to Character B's internal thoughts
3. Thoughts stay private until expressed through action/dialogue
4. Separate each perspective with the marker format above

### Example Format
> [${mainCharacter.name}'s POV] *She noticed the tension in his shoulders...*

> [Other's POV] *He kept his expression neutral, aware of her scrutiny...*

${mainCharacter.name} asked, "Everything alright?"`;

    return {
      filteredContext: directorOutput,
      povRules,
    };
  }

  /**
   * Extract and handle secret tags in content
   * Format: [secret]hidden content[/secret]
   *
   * @param content - Content potentially containing secret tags
   * @param povCharacterId - Current POV character (secrets visible to owner)
   * @returns Content with secrets handled appropriately
   */
  handleSecrets(
    content: string,
    povCharacterId: string | undefined
  ): { publicContent: string; secretsNote: string } {
    // Simple regex to find [secret]...[/secret] blocks
    const secretPattern = /\[secret\]([\s\S]*?)\[\/secret\]/g;
    const matches = content.matchAll(secretPattern);

    let secretCount = 0;
    for (const _ of matches) {
      secretCount++;
    }

    // Remove secrets from public content (Director doesn't expose them)
    const publicContent = content.replace(secretPattern, '').trim();

    const secretsNote = secretCount > 0
      ? `\n(Note: ${secretCount} secret thought(s) exist but are hidden from other characters)`
      : '';

    return { publicContent, secretsNote };
  }
}
