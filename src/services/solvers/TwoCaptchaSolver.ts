import { Solver } from "2captcha";
import { CaptchaSolver } from "@/typings/index.js";

export class TwoCaptchaSolver implements CaptchaSolver {
    private solver: Solver;

    constructor(apiKey: string) {
        this.solver = new Solver(apiKey);
    }

    public solveImage = async (imageData: Buffer): Promise<string> => {
        const result = await this.solver.imageCaptcha(imageData.toString("base64"), {
            numeric: 2,
            min_len: 3,
            max_len: 6,
        });

        return result.data;
    }

    public solveHcaptcha = async (sitekey: string, siteurl: string): Promise<string> => {
        const result = await this.solver.hcaptcha(sitekey, siteurl);
        return result.data;
    }
}