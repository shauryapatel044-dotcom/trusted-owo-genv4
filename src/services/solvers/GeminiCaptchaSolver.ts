import { CaptchaSolver } from "@/typings/index.js";
import { logger } from "@/utils/logger.js";
import axios from "axios";

export class GeminiCaptchaSolver implements CaptchaSolver {
    private apiKey: string;
    // Default to gemini-3.5-flash-lite: lowest latency, cheapest Google multimodal vision model
    private model: string;

    constructor(apiKey: string, model: string = "gemini-3.5-flash-lite") {
        this.apiKey = apiKey.trim();
        this.model = model;
    }

    public solveImage = async (imageData: Buffer): Promise<string> => {
        const base64Data = imageData.toString("base64");

        // Flash-tier models in order of priority: 3.5-flash-lite -> flash-lite-latest -> 2.5-flash
        const candidateModels = [
            this.model,
            "gemini-flash-lite-latest",
            "gemini-2.5-flash"
        ];

        let lastError: any = null;

        for (const model of candidateModels) {
            try {
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

                const response = await axios.post(
                    endpoint,
                    {
                        contents: [
                            {
                                role: "user",
                                parts: [
                                    {
                                        text: "You are an OCR engine specialized in solving distorted captchas. Read the characters (letters and/or numbers) in this captcha image. Output ONLY the exact characters without spaces, without punctuation, without markdown, without any quotes, and without explanation. Maintain original letter casing."
                                    },
                                    {
                                        inlineData: {
                                            mimeType: "image/png",
                                            data: base64Data
                                        }
                                    }
                                ]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 25
                        }
                    },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": this.apiKey
                        },
                        timeout: 25000
                    }
                );

                const candidate = response.data?.candidates?.[0];
                const textPart = candidate?.content?.parts?.find((p: any) => p.text)?.text;

                if (textPart && typeof textPart === "string") {
                    const cleaned = textPart.trim().replace(/[\r\n\t]/g, "").replace(/[^a-zA-Z0-9]/g, "");
                    if (cleaned.length >= 2) {
                        logger.info(`🤖 [Gemini Vision AI] Captcha solved via ${model}: "${cleaned}"`);
                        return cleaned;
                    }
                    return textPart.trim();
                }
            } catch (err: any) {
                lastError = err;
                const errMsg = err?.response?.data?.error?.message || err?.message || String(err);
                logger.warn(`[Gemini Vision AI] Model ${model} failed: ${errMsg}. Trying fallback if available...`);
            }
        }

        throw new Error(`Gemini Captcha Solver failed: ${lastError?.response?.data?.error?.message || lastError?.message || lastError}`);
    };

    public solveHcaptcha = async (_sitekey: string, _siteurl: string): Promise<string> => {
        throw new Error("Gemini AI is a Vision OCR engine for Discord image captchas. For website hCaptcha link redirects, please use 2Captcha or YesCaptcha, or complete the link in your browser.");
    };
}
