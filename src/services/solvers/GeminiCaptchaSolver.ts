import { CaptchaSolver, SolveImageOptions } from "@/typings/index.js";
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

    public solveImage = async (imageData: Buffer, options?: SolveImageOptions): Promise<string> => {
        const base64Data = imageData.toString("base64");

        // Flash-tier models in order of priority: 3.5-flash-lite -> flash-lite-latest -> 2.5-flash
        const candidateModels = [
            this.model,
            "gemini-flash-lite-latest",
            "gemini-2.5-flash"
        ];

        const expectedLen = options?.expectedLength;

        const mainPrompt = expectedLen
            ? `You are an expert OCR engine solving a distorted captcha.\nCRITICAL: This captcha contains EXACTLY ${expectedLen} alphanumeric characters (letters and/or digits).\nCarefully examine the characters from left to right. Do NOT mistake background noise, specks, or border lines for characters.\nOutput ONLY the exact ${expectedLen} characters without spaces, punctuation, quotes, or markdown. Maintain original letter casing.`
            : `You are an expert OCR engine solving a distorted captcha. Read the characters (letters and/or digits) in this image.\nOutput ONLY the exact characters without spaces, punctuation, quotes, or markdown. Maintain original letter casing.`;

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
                                    { text: mainPrompt },
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
                            temperature: 0.0,
                            maxOutputTokens: 20
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
                    let cleaned = textPart.trim().replace(/[\r\n\t]/g, "").replace(/[^a-zA-Z0-9]/g, "");

                    // If expected length was specified but Gemini returned extra characters due to noise
                    if (expectedLen && cleaned.length > expectedLen) {
                        try {
                            const correctionResponse = await axios.post(
                                endpoint,
                                {
                                    contents: [
                                        {
                                            role: "user",
                                            parts: [
                                                {
                                                    text: `You previously output "${cleaned}" (${cleaned.length} chars). However, this captcha has EXACTLY ${expectedLen} characters. One of the characters was an artifact or background noise line. Inspect the image again and return ONLY the true ${expectedLen} characters.`
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
                                        temperature: 0.0,
                                        maxOutputTokens: 15
                                    }
                                },
                                {
                                    headers: {
                                        "Content-Type": "application/json",
                                        "x-goog-api-key": this.apiKey
                                    },
                                    timeout: 10000
                                }
                            );

                            const fixText = correctionResponse.data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
                            if (fixText) {
                                const fixCleaned = fixText.trim().replace(/[^a-zA-Z0-9]/g, "");
                                if (fixCleaned.length === expectedLen) {
                                    logger.info(`🤖 [Gemini Vision AI] Corrected captcha length from ${cleaned.length} to ${fixCleaned.length}: "${fixCleaned}"`);
                                    return fixCleaned;
                                }
                            }
                        } catch {
                            // Fallback to slicing if correction pass times out
                        }

                        // Slice to expectedLen if still longer
                        const sliced = cleaned.slice(0, expectedLen);
                        logger.warn(`🤖 [Gemini Vision AI] Adjusted ${cleaned} to expected ${expectedLen} characters: "${sliced}"`);
                        return sliced;
                    }

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
