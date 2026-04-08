/**
 * GeminiClient — Lazy-instantiated wrapper around @google/generative-ai.
 *
 * The API key is read from localStorage at call time, so it is never
 * stored in the module scope or in .gi-project files.
 */

 
type GoogleGenerativeAIType = import('@google/generative-ai').GoogleGenerativeAI;

const STORAGE_KEY = 'gi_engine_gemini_api_key';
const TEXT_MODEL_KEY = 'gi_engine_text_model';
const IMAGE_MODEL_KEY = 'gi_engine_image_model';

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';
const DEFAULT_IMAGE_MODEL = 'imagen-4.0-generate-001';

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  tier: 'stable' | 'preview';
}

/** Available text generation models (latest first) */
export const TEXT_MODELS: ModelOption[] = [
  // Gemini 3 series (Preview)
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', description: '최신 최고 성능, 고급 추론', tier: 'preview' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', description: '빠른 프론티어급 모델', tier: 'preview' },
  { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', description: '최저 비용, 고속', tier: 'preview' },
  // Gemini 2.5 series (Stable)
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: '안정적, 최고 품질 추론', tier: 'stable' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: '안정적, 균형잡힌 성능 (기본)', tier: 'stable' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: '안정적, 최고속/최저비용', tier: 'stable' },
];

/** Available image generation models (latest first) */
export const IMAGE_MODELS: ModelOption[] = [
  // Imagen 4 (Stable)
  { id: 'imagen-4.0-generate-001', label: 'Imagen 4', description: '표준 이미지 생성, 2K (기본)', tier: 'stable' },
  { id: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4 Ultra', description: '최고 해상도/품질', tier: 'stable' },
  { id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast', description: '빠른 이미지 생성', tier: 'stable' },
  // Gemini native image (Preview) — uses generateContent with IMAGE modality
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', description: '네이티브 이미지 생성+편집 (Preview)', tier: 'preview' },
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', description: '고품질 네이티브 이미지 (Preview)', tier: 'preview' },
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', description: '안정적 네이티브 이미지', tier: 'stable' },
];

export class GeminiClient {
  private _genAI: GoogleGenerativeAIType | null = null;
  private _activeKey: string | null = null;

  private getApiKey(): string {
    const key =
      typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!key) {
      throw new Error(
        'Gemini API 키가 설정되지 않았습니다. 툴바의 AI 설정에서 키를 입력하세요.',
      );
    }
    return key;
  }

  getTextModel(): string {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(TEXT_MODEL_KEY) || DEFAULT_TEXT_MODEL;
    }
    return DEFAULT_TEXT_MODEL;
  }

  getImageModel(): string {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(IMAGE_MODEL_KEY) || DEFAULT_IMAGE_MODEL;
    }
    return DEFAULT_IMAGE_MODEL;
  }

  private async getGenAI(): Promise<GoogleGenerativeAIType> {
    const key = this.getApiKey();
    if (!this._genAI || this._activeKey !== key) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this._genAI = new GoogleGenerativeAI(key);
      this._activeKey = key;
    }
    return this._genAI;
  }

  reset(): void {
    this._genAI = null;
    this._activeKey = null;
  }

  async analyzeImage(
    imageBase64: string,
    prompt: string,
    model?: string,
  ): Promise<string> {
    const genAI = await this.getGenAI();
    const effectiveModel = model || this.getTextModel();
    const generativeModel = genAI.getGenerativeModel({ model: effectiveModel });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (generativeModel as any).generateContent({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          ],
        },
      ],
    });
    return result.response.text();
  }

  async generateText(prompt: string, model?: string): Promise<string> {
    const genAI = await this.getGenAI();
    const effectiveModel = model || this.getTextModel();
    const generativeModel = genAI.getGenerativeModel({ model: effectiveModel });
    const result = await generativeModel.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Generate an image using Imagen API (generateImages).
   * For Imagen 4 and legacy Imagen models.
   */
  async generateImage(
    prompt: string,
    aspectRatio: '16:9' | '4:3' | '1:1' = '16:9',
    model?: string,
  ): Promise<string> {
    const genAI = await this.getGenAI();
    const effectiveModel = model || this.getImageModel();

    // Gemini native image models use generateContent with IMAGE modality
    if (effectiveModel.includes('image') || effectiveModel.includes('flash-image')) {
      return this.generateImageNative(prompt, effectiveModel);
    }

    // Imagen models use generateImages API
    const imagenModel = genAI.getGenerativeModel({ model: effectiveModel });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (imagenModel as any).generateImages({
      prompt,
      number_of_images: 1,
      aspect_ratio: aspectRatio,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageBytes = (result as any).images?.[0]?.imageBytes as string | undefined;
    if (!imageBytes) {
      throw new Error('이미지 생성에 실패했습니다. 응답에 이미지 데이터가 없습니다.');
    }
    return imageBytes;
  }

  /**
   * Generate an image using Gemini native image generation (generateContent with IMAGE modality).
   * For gemini-*-image models (Nano Banana series).
   */
  private async generateImageNative(prompt: string, model: string): Promise<string> {
    const genAI = await this.getGenAI();
    const generativeModel = genAI.getGenerativeModel({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } as any,
    });
    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inlineData = (part as any).inlineData;
        if (inlineData?.data) {
          return inlineData.data as string;
        }
      }
    }
    throw new Error('이미지 생성에 실패했습니다. 응답에 이미지 데이터가 없습니다.');
  }
}

/** Singleton instance — shared across generators */
export const geminiClient = new GeminiClient();
