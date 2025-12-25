/**
 * PNG Character Card Parser
 * Extracts character data from PNG metadata (tEXt/iTXt chunks)
 * Compatible with SillyTavern, Chub.ai, and other character card formats
 */

export interface CharacterCardData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  tags?: string[];
  creator?: string;
  character_version?: string;
}

/**
 * Parse PNG file and extract character card data from metadata
 */
export async function parsePngCharacterCard(
  arrayBuffer: ArrayBuffer
): Promise<CharacterCardData | null> {
  const dataView = new DataView(arrayBuffer);

  // Verify PNG signature
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (dataView.getUint8(i) !== pngSignature[i]) {
      console.error('Not a valid PNG file');
      return null;
    }
  }

  let offset = 8; // Skip PNG signature

  while (offset < arrayBuffer.byteLength) {
    // Read chunk length (4 bytes, big-endian)
    const length = dataView.getUint32(offset, false);
    offset += 4;

    // Read chunk type (4 bytes)
    const typeBytes = new Uint8Array(arrayBuffer, offset, 4);
    const type = String.fromCharCode(...typeBytes);
    offset += 4;

    // Check for text chunks that may contain character data
    if (type === 'tEXt' || type === 'iTXt') {
      const chunkData = new Uint8Array(arrayBuffer, offset, length);
      const result = parseTextChunk(chunkData, type);

      if (result) {
        return result;
      }
    }

    // Skip chunk data and CRC
    offset += length + 4;

    // Stop at IEND chunk
    if (type === 'IEND') break;
  }

  return null;
}

/**
 * Parse tEXt or iTXt chunk data
 */
function parseTextChunk(
  data: Uint8Array,
  type: string
): CharacterCardData | null {
  // Find null separator between keyword and text
  let nullIndex = data.indexOf(0);
  if (nullIndex === -1) return null;

  const keyword = new TextDecoder().decode(data.slice(0, nullIndex));

  // Only process 'chara' keyword (standard for character cards)
  if (keyword !== 'chara') return null;

  let textStart = nullIndex + 1;

  // iTXt has additional fields before the text
  if (type === 'iTXt') {
    // Skip compression flag (1 byte) + compression method (1 byte)
    textStart += 2;
    // Skip language tag (null-terminated)
    while (textStart < data.length && data[textStart] !== 0) textStart++;
    textStart++; // Skip null
    // Skip translated keyword (null-terminated)
    while (textStart < data.length && data[textStart] !== 0) textStart++;
    textStart++; // Skip null
  }

  const textData = data.slice(textStart);
  const base64Text = new TextDecoder().decode(textData);

  try {
    // Decode base64 to JSON
    const jsonStr = atob(base64Text);
    const parsed = JSON.parse(jsonStr);

    // Handle different formats (V1, V2, tavern)
    return normalizeCharacterData(parsed);
  } catch (e) {
    console.error('Failed to parse character data:', e);
    return null;
  }
}

/**
 * Normalize different character card formats to our standard format
 */
function normalizeCharacterData(data: Record<string, unknown>): CharacterCardData {
  // V2 format (has 'data' wrapper)
  if (data.spec === 'chara_card_v2' && data.data) {
    const d = data.data as Record<string, unknown>;
    return {
      name: (d.name as string) || 'Unknown',
      description: (d.description as string) || '',
      personality: (d.personality as string) || '',
      scenario: (d.scenario as string) || '',
      first_mes: (d.first_mes as string) || '',
      mes_example: d.mes_example as string,
      creator_notes: d.creator_notes as string,
      system_prompt: d.system_prompt as string,
      post_history_instructions: d.post_history_instructions as string,
      tags: d.tags as string[],
      creator: d.creator as string,
      character_version: d.character_version as string,
    };
  }

  // V1 format or direct format
  return {
    name: (data.name as string) || (data.char_name as string) || 'Unknown',
    description: (data.description as string) || (data.char_persona as string) || '',
    personality: (data.personality as string) || '',
    scenario: (data.scenario as string) || (data.world_scenario as string) || '',
    first_mes: (data.first_mes as string) || (data.char_greeting as string) || '',
    mes_example: (data.mes_example as string) || (data.example_dialogue as string),
    creator_notes: data.creator_notes as string,
    system_prompt: data.system_prompt as string,
    post_history_instructions: data.post_history_instructions as string,
    tags: data.tags as string[],
    creator: data.creator as string,
    character_version: data.character_version as string,
  };
}

/**
 * Read file as ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
