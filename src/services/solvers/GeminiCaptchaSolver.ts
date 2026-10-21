import { CaptchaSolver, SolveImageOptions } from "@/typings/index.js";
import { logger } from "@/utils/logger.js";
import axios from "axios";

export class GeminiCaptchaSolver implements CaptchaSolver {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = "gemini-2.5-flash") {
        this.apiKey = apiKey.trim();
        this.model = model;
    }

    public solveImage = async (imageData: Buffer, options?: SolveImageOptions): Promise<string> => {
        const base64Data = imageData.toString("base64");

        const candidateModels = [
            this.model,
            "gemini-flash-lite-latest",
            "gemini-2.5-flash",
            "gemini-3.5-flash-lite"
        ];
        const uniqueModels = [...new Set(candidateModels)];

        const expectedLen = options?.expectedLength;
        const hasQuestion = Boolean(options?.question && options.question.trim().length > 0);

        const mainPrompt = hasQuestion
            ? `You are an expert AI vision assistant solving a Discord puzzle or verification challenge.
Challenge Question / Instructions: "${options!.question}"
Carefully examine the image to answer the question accurately (for example: identifying an animal, object, position, direction, count, or character).
Output ONLY the direct, concise answer without extra explanations, full sentences, quotes, markdown formatting, or punctuation.`
            : expectedLen
            ? `You are an expert OCR engine solving a distorted captcha.\nCRITICAL: This captcha contains EXACTLY ${expectedLen} alphanumeric characters (letters and/or digits).\nCarefully examine the characters from left to right. Do NOT mistake background noise, specks, or border lines for characters.\nOutput ONLY the exact ${expectedLen} characters without spaces, punctuation, quotes, or markdown. Maintain original letter casing.`
            : `You are an expert AI vision engine solving a captcha or verification challenge.
1. If this image contains or asks a question (such as "Which animal...", "Select...", "Count...", or "Find..."):
   Understand the question and output ONLY the direct, concise answer to that question.
2. If this is a distorted text/letter captcha:
   Read all the characters (letters and/or digits) accurately from left to right. Maintain original casing.
Output ONLY the final answer without pleasantries, explanations, markdown, or punctuation.`;

        let lastError: any = null;

        for (const model of uniqueModels) {
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
                            maxOutputTokens: hasQuestion ? 50 : 20
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
                    if (hasQuestion) {
                        let cleanAnswer = textPart.trim().replace(/[\r\n\t]/g, " ").replace(/^["'`]+|["'`]+$/g, "").trim();
                        logger.info(`🤖 [Gemini Vision AI] Visual question solved via ${model}: "${cleanAnswer}"`);
                        return cleanAnswer;
                    }

                    let cleaned = textPart.trim().replace(/[\r\n\t]/g, "").replace(/[^a-zA-Z0-9]/g, "");

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
        throw new Error("hCaptcha on owobot.com requires web interactive token solving. If using Gemini AI, complete the verification link once in your browser or configure a 2Captcha/YesCaptcha solver key.");
    };
}
