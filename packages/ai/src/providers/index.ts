export interface AIProvider {
  readonly id: string;
  readonly label: string;
  readonly tier: 'stable' | 'preview';

  analyzeImage(imageBase64: string, prompt: string, model?: string): Promise<string>;
  generateText(prompt: string, model?: string): Promise<string>;
  generateImage(prompt: string, aspectRatio?: '16:9' | '4:3' | '1:1', model?: string): Promise<string>;
}

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  tier: 'stable' | 'preview';
}

export interface TextModelOption extends ModelOption {
  supportsImageInput: boolean;
}

export interface ImageModelOption extends ModelOption {
  maxResolution: '1K' | '2K' | '4K';
}