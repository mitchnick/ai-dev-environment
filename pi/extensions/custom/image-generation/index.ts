import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const REPLICATE_MODEL = "ideogram-ai/ideogram-v4-quality";
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled"]);

type Provider = "openai" | "replicate";
type OpenAISize = "auto" | "1024x1024" | "1024x1536" | "1536x1024";
type OpenAIQuality = "auto" | "low" | "medium" | "high";
type OutputFormat = "png" | "webp" | "jpeg";

interface GeneratedImage {
	bytes: Buffer;
	mimeType: string;
	provider: Provider;
	model: string;
	revisedPrompt?: string;
	predictionId?: string;
}

function abortError(): Error {
	return new DOMException("Image generation aborted", "AbortError");
}

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
	if (signal.aborted) throw abortError();
	await new Promise<void>((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timer);
			reject(abortError());
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

async function direnvValue(cwd: string, name: string): Promise<string | undefined> {
	try {
		const script = "process.stdout.write(process.env[process.argv[1]] || '')";
		const { stdout } = await execFileAsync("direnv", ["exec", ".", "node", "-e", script, name], {
			cwd,
			maxBuffer: 1024 * 1024,
		});
		const value = stdout.trim();
		return value.length > 0 ? value : undefined;
	} catch {
		return undefined;
	}
}

async function credential(
	ctx: ExtensionContext,
	name: "OPENAI_API_KEY" | "REPLICATE_API_TOKEN",
): Promise<string> {
	const inherited = process.env[name];
	if (inherited) return inherited;

	const fromDirenv = await direnvValue(ctx.cwd, name);
	if (fromDirenv) return fromDirenv;

	if (name === "OPENAI_API_KEY") {
		const fromPi = await ctx.modelRegistry.getApiKeyForProvider("openai");
		if (fromPi) return fromPi;
	}

	throw new Error(
		`${name} is not configured. Set it in the environment or the current directory's allowed .envrc${
			name === "OPENAI_API_KEY" ? ", or add the OpenAI API key with Pi's /login command" : ""
		}.`,
	);
}

async function apiError(response: Response): Promise<Error> {
	let detail = `${response.status} ${response.statusText}`;
	try {
		const body = (await response.json()) as {
			detail?: string;
			error?: string | { message?: string };
		};
		if (typeof body.error === "string") detail = body.error;
		else if (body.error?.message) detail = body.error.message;
		else if (body.detail) detail = body.detail;
	} catch {
		// Keep the HTTP status when the service did not return JSON.
	}
	return new Error(detail);
}

async function generateOpenAI(
	ctx: ExtensionContext,
	prompt: string,
	size: OpenAISize,
	quality: OpenAIQuality,
	outputFormat: OutputFormat,
	signal: AbortSignal,
): Promise<GeneratedImage> {
	const apiKey = await credential(ctx, "OPENAI_API_KEY");
	const response = await fetch("https://api.openai.com/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "gpt-image-2",
			prompt,
			size,
			quality,
			output_format: outputFormat,
		}),
		signal,
	});
	if (!response.ok) throw await apiError(response);

	const body = (await response.json()) as {
		data?: Array<{ b64_json?: string; revised_prompt?: string }>;
	};
	const image = body.data?.[0];
	if (!image?.b64_json) throw new Error("OpenAI returned no image data.");

	return {
		bytes: Buffer.from(image.b64_json, "base64"),
		mimeType: `image/${outputFormat}`,
		provider: "openai",
		model: "gpt-image-2",
		revisedPrompt: image.revised_prompt,
	};
}

interface ReplicatePrediction {
	id: string;
	status: string;
	error?: string;
	output?: string | string[] | Record<string, unknown>;
	urls?: { get?: string };
}

function outputUrls(output: ReplicatePrediction["output"]): string[] {
	if (typeof output === "string") return [output];
	if (Array.isArray(output)) return output.filter((value): value is string => typeof value === "string");
	if (!output || typeof output !== "object") return [];
	return Object.values(output)
		.flat()
		.filter((value): value is string => typeof value === "string" && value.startsWith("http"));
}

async function generateReplicate(
	ctx: ExtensionContext,
	prompt: string,
	signal: AbortSignal,
	onStatus: (status: string) => void,
): Promise<GeneratedImage> {
	const apiKey = await credential(ctx, "REPLICATE_API_TOKEN");
	const headers = {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
		"User-Agent": "pi-image-generation/1.0",
	};
	let response = await fetch(
		`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`,
		{
			method: "POST",
			headers,
			body: JSON.stringify({ input: { prompt, enable_copyright_detection: true } }),
			signal,
		},
	);
	if (!response.ok) throw await apiError(response);
	let prediction = (await response.json()) as ReplicatePrediction;
	onStatus(prediction.status);

	for (let attempt = 0; attempt < 90 && !TERMINAL_STATUSES.has(prediction.status); attempt += 1) {
		await sleep(2_000, signal);
		if (!prediction.urls?.get) throw new Error("Replicate returned no prediction status URL.");
		response = await fetch(prediction.urls.get, { headers, signal });
		if (!response.ok) throw await apiError(response);
		prediction = (await response.json()) as ReplicatePrediction;
		onStatus(prediction.status);
	}

	if (prediction.status !== "succeeded") {
		throw new Error(prediction.error || `Replicate prediction ${prediction.status}.`);
	}
	const [url] = outputUrls(prediction.output);
	if (!url) throw new Error("Replicate returned no image URL.");

	response = await fetch(url, { signal });
	if (!response.ok) throw await apiError(response);
	const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
	return {
		bytes: Buffer.from(await response.arrayBuffer()),
		mimeType,
		provider: "replicate",
		model: REPLICATE_MODEL,
		predictionId: prediction.id,
	};
}

function extensionFor(mimeType: string): string {
	if (mimeType === "image/jpeg") return "jpg";
	if (mimeType === "image/webp") return "webp";
	return "png";
}

function safeStem(value: string | undefined, provider: Provider): string {
	const supplied = value
		?.replace(/\.[a-zA-Z0-9]+$/, "")
		.replace(/[^a-zA-Z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	if (supplied) return supplied;
	return `${provider}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

const generateImage = defineTool({
	name: "generate_image",
	label: "Generate Image",
	description:
		"Generate one image with OpenAI GPT Image 2 or Replicate Ideogram 4 Quality. Saves the original under tmp/imagegen and returns the image for visual review.",
	parameters: Type.Object({
		provider: Type.Union([Type.Literal("openai"), Type.Literal("replicate")], {
			description: "Image service to use.",
		}),
		prompt: Type.String({ minLength: 1, description: "Complete image-generation prompt." }),
		filename: Type.Optional(
			Type.String({ description: "Optional safe filename stem. The extension and directory are assigned automatically." }),
		),
		size: Type.Optional(
			Type.Union(
				[
					Type.Literal("auto"),
					Type.Literal("1024x1024"),
					Type.Literal("1024x1536"),
					Type.Literal("1536x1024"),
				],
				{ description: "OpenAI output size. Ignored by Replicate. Defaults to auto." },
			),
		),
		quality: Type.Optional(
			Type.Union(
				[Type.Literal("auto"), Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")],
				{ description: "OpenAI quality. Ignored by Replicate. Defaults to high." },
			),
		),
		outputFormat: Type.Optional(
			Type.Union([Type.Literal("png"), Type.Literal("webp"), Type.Literal("jpeg")], {
				description: "OpenAI output format. Ignored by Replicate. Defaults to png.",
			}),
		),
	}),

	async execute(_toolCallId, params, signal, onUpdate, ctx) {
		const provider = params.provider as Provider;
		const size = (params.size ?? "auto") as OpenAISize;
		const quality = (params.quality ?? "high") as OpenAIQuality;
		const outputFormat = (params.outputFormat ?? "png") as OutputFormat;

		onUpdate?.({
			content: [{ type: "text", text: `Generating with ${provider}…` }],
			details: { provider, status: "starting" },
		});

		const generated =
			provider === "openai"
				? await generateOpenAI(ctx, params.prompt, size, quality, outputFormat, signal)
				: await generateReplicate(ctx, params.prompt, signal, (status) => {
						onUpdate?.({
							content: [{ type: "text", text: `Replicate: ${status}…` }],
							details: { provider, status },
						});
					});

		const directory = path.join(ctx.cwd, "tmp", "imagegen");
		await mkdir(directory, { recursive: true });
		const filePath = path.join(
			directory,
			`${safeStem(params.filename, provider)}.${extensionFor(generated.mimeType)}`,
		);
		await writeFile(filePath, generated.bytes);

		const relativePath = path.relative(ctx.cwd, filePath) || filePath;
		const text = [
			`Generated ${generated.model} image.`,
			`Saved: ${relativePath}`,
			generated.revisedPrompt ? `Revised prompt: ${generated.revisedPrompt}` : undefined,
		]
			.filter(Boolean)
			.join("\n");

		return {
			content: [
				{ type: "text", text },
				{ type: "image", data: generated.bytes.toString("base64"), mimeType: generated.mimeType },
			],
			details: {
				provider: generated.provider,
				model: generated.model,
				path: relativePath,
				mimeType: generated.mimeType,
				bytes: generated.bytes.length,
				predictionId: generated.predictionId,
			},
		};
	},
});

export default function imageGenerationExtension(pi: ExtensionAPI): void {
	pi.registerTool(generateImage);
}
