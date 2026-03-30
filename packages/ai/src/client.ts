/**
 * GeminiClient — Lazy-instantiated wrapper around @google/generative-ai.
 *
 * The API key is read from localStorage at call time, so it is never
 * stored in the module scope or in .gi-project files.
 */

// We use a dynamic import style declaration so the package compiles even
// when @google/generative-ai is not installed in the consuming app at
// type-check time. At runtime the package must be available.
// eslint-disable-next-line @typescript-eslint/no-require-imports
type GoogleGenerativeAIType = import('@google/generative-ai').GoogleGenerativeAI;

const STORAGE_KEY = 'gi_engine_gemini_api_key';

export class GeminiClient {
  private _genAI: GoogleGenerativeAIType | null = null;
  /** The key used to create the current `_genAI` instance. */
  private _activeKey: string | null = null;

  private getApiKey(): string {
    const key =
      typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!key) {
      throw new Error(
        'Gemini API 키가 설정되지 않았습니다. AI 설정에서 키를 입력하세요.',
      );
    }
    return key;
  }

  private async getGenAI(): Promise<GoogleGenerativeAIType> {
    const key = this.getApiKey();
    // Re-initialize whenever the stored key differs from the one we used.
    if (!this._genAI || this._activeKey !== key) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this._genAI = new GoogleGenerativeAI(key);
      this._activeKey = key;
    }
    return this._genAI;
  }

  /**
   * Reset the cached instance (e.g. after the user updates their API key).
   */
  reset(): void {
    this._genAI = null;
    this._activeKey = null;
  }

  /**
   * Generate text using a Gemini language model.
   */
  async generateText(prompt: string, model = 'gemini-2.0-flash'): Promise<string> {
    const genAI = await this.getGenAI();
    const generativeModel = genAI.getGenerativeModel({ model });
    const result = await generativeModel.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Generate an image using Imagen 3.
   * Returns the first image as a base64-encoded string.
   */
  async generateImage(
    prompt: string,
    aspectRatio: '16:9' | '4:3' | '1:1' = '16:9',
  ): Promise<string> {
    const genAI = await this.getGenAI();
    // Imagen 3 model — uses generateImages API
    // @ts-expect-error — generateImages is available on the Imagen model
    const imagenModel = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-002' });
    // @ts-expect-error — generateImages is available on the Imagen model
    const result = await imagenModel.generateImages({
      prompt,
      number_of_images: 1,
      aspect_ratio: aspectRatio,
    });
    // result.images[0].imageBytes is a base64 string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageBytes = (result as any).images?.[0]?.imageBytes as string | undefined;
    if (!imageBytes) {
      throw new Error('이미지 생성에 실패했습니다. 응답에 이미지 데이터가 없습니다.');
    }
    return imageBytes;
  }
}

/** Singleton instance — shared across generators */
export const geminiClient = new GeminiClient();
