"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Suppress all Node.js warnings (including deprecation)
process.emitWarning = () => { };
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const openai_1 = require("openai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
// Function to load environment variables from a file
const loadEnvFile = (filePath) => {
    try {
        const envConfig = fs_1.default.readFileSync(filePath, "utf8");
        envConfig.split("\n").forEach((line) => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith("#")) {
                const [key, ...valueParts] = trimmedLine.split("=");
                const value = valueParts.join("=").trim();
                if (key) {
                    // Remove surrounding quotes if present
                    process.env[key.trim()] = value.startsWith("'") && value.endsWith("'") || value.startsWith("\"") && value.endsWith("\"")
                        ? value.slice(1, -1)
                        : value;
                }
            }
        });
        console.error(`Loaded environment variables from ${filePath}`);
    }
    catch (error) {
        console.error(`Warning: Could not read environment file at ${filePath}:`, error);
    }
};
// Function to get platform-specific default image directory
const getDefaultImageDirectory = () => {
    const homeDir = os_1.default.homedir();
    let defaultDir;
    switch (process.platform) {
        case 'win32':
            // Windows: %USERPROFILE%\Desktop\Generated_Images
            defaultDir = path_1.default.join(homeDir, 'Desktop', 'Generated_Images');
            break;
        case 'darwin':
        case 'linux':
        default:
            // macOS and Linux: ~/Desktop/Generated_Images
            defaultDir = path_1.default.join(homeDir, 'Desktop', 'Generated_Images');
            break;
    }
    // Ensure the directory exists
    try {
        fs_1.default.mkdirSync(defaultDir, { recursive: true });
    }
    catch (error) {
        console.error(`Warning: Could not create default image directory at ${defaultDir}:`, error);
        // Cross-platform fallback to the system temp directory
        return os_1.default.tmpdir();
    }
    return defaultDir;
};
// Parse command line arguments for --env-file
const cmdArgs = process.argv.slice(2);
const envFileArgIndex = cmdArgs.findIndex(arg => arg === "--env-file");
if (envFileArgIndex !== -1 && cmdArgs[envFileArgIndex + 1]) {
    console.error("Loading environment variables from file:", cmdArgs[envFileArgIndex + 1]);
    const envFilePath = cmdArgs[envFileArgIndex + 1];
    loadEnvFile(envFilePath);
}
else {
    console.error("No environment file provided");
}
(async () => {
    const server = new mcp_js_1.McpServer({
        name: "openai-gpt-image-mcp",
        version: "1.0.0"
    }, {
        capabilities: {
            tools: { listChanged: false }
        }
    });
    // Helper functions for validation
    const absolutePathCheck = (val) => {
        if (!val)
            return true;
        // Check for Unix/Linux/macOS absolute paths
        if (val.startsWith("/"))
            return true;
        // Check for Windows absolute paths (C:/, D:\, etc.)
        if (/^[a-zA-Z]:[/\\]/.test(val))
            return true;
        return false;
    };
    const base64Check = (val) => !!val && (/^([A-Za-z0-9+/=\r\n]+)$/.test(val) || val.startsWith("data:image/"));
    // Zod schema for create-image tool input
    const createImageSchema = zod_1.z.object({
        prompt: zod_1.z.string().max(32000),
        background: zod_1.z.enum(["transparent", "opaque", "auto"]).optional().describe("Background transparency (gpt-image-1 only). Use 'transparent' for transparent background, 'opaque' for solid, 'auto' for automatic."),
        model: zod_1.z.enum(["dall-e-2", "dall-e-3", "gpt-image-1"]).default("gpt-image-1").describe("Model to use for image generation."),
        moderation: zod_1.z.enum(["auto", "low"]).optional().describe("Content moderation level (gpt-image-1 only)."),
        n: zod_1.z.number().int().min(1).max(10).optional().describe("Number of images to generate (1-10). For dall-e-3, only n=1 is supported."),
        output_compression: zod_1.z.number().int().min(0).max(100).optional().describe("Compression level 0-100% (gpt-image-1 with webp/jpeg only)."),
        output_format: zod_1.z.enum(["png", "jpeg", "webp"]).optional().describe("Output format (gpt-image-1 only)."),
        quality: zod_1.z.enum(["auto", "high", "medium", "low", "standard", "hd"]).optional().describe("Image quality. gpt-image-1: auto/high/medium/low. dall-e-3: standard/hd. dall-e-2: standard only."),
        response_format: zod_1.z.enum(["url", "b64_json"]).optional().describe("Response format (dall-e-2/dall-e-3 only). gpt-image-1 always returns b64_json."),
        size: zod_1.z.enum(["auto", "1024x1024", "1536x1024", "1024x1536", "256x256", "512x512", "1792x1024", "1024x1792"]).optional().describe("Image size. gpt-image-1: auto/1024x1024/1536x1024/1024x1536. dall-e-2: 256x256/512x512/1024x1024. dall-e-3: 1024x1024/1792x1024/1024x1792."),
        style: zod_1.z.enum(["vivid", "natural"]).optional().describe("Image style (dall-e-3 only). 'vivid' for dramatic, 'natural' for natural."),
        user: zod_1.z.string().optional().describe("End-user identifier for monitoring."),
        output: zod_1.z.enum(["base64", "file_output"]).default("base64").describe("Output method: return base64 data or save to file."),
        file_output: zod_1.z.string().optional().refine((val) => {
            if (!val)
                return true;
            // Check for Unix/Linux/macOS absolute paths
            if (val.startsWith("/"))
                return true;
            // Check for Windows absolute paths (C:/, D:\, etc.)
            if (/^[a-zA-Z]:[/\\]/.test(val))
                return true;
            return false;
        }, { message: "file_output must be an absolute path" }).describe("Absolute path to save the image file, including the desired file extension (e.g., /path/to/image.png). If multiple images are generated (n > 1), an index will be appended (e.g., /path/to/image_1.png)."),
    }).refine((data) => {
        if (data.output !== "file_output")
            return true;
        if (typeof data.file_output !== "string")
            return false;
        // Check for Unix/Linux/macOS absolute paths
        if (data.file_output.startsWith("/"))
            return true;
        // Check for Windows absolute paths (C:/, D:\, etc.)
        if (/^[a-zA-Z]:[/\\]/.test(data.file_output))
            return true;
        return false;
    }, { message: "file_output must be an absolute path when output is 'file_output'", path: ["file_output"] }).refine((data) => {
        // Model-specific parameter validation
        const { model = "gpt-image-1" } = data;
        // dall-e-3 specific validations
        if (model === "dall-e-3") {
            if (data.n && data.n > 1)
                return false; // dall-e-3 only supports n=1
            if (data.background)
                return false; // background not supported
            if (data.moderation)
                return false; // moderation not supported
            if (data.output_compression)
                return false; // output_compression not supported
            if (data.output_format)
                return false; // output_format not supported
            if (data.quality && !["standard", "hd"].includes(data.quality))
                return false;
            if (data.size && !["1024x1024", "1792x1024", "1024x1792"].includes(data.size))
                return false;
        }
        // dall-e-2 specific validations
        if (model === "dall-e-2") {
            if (data.background)
                return false; // background not supported
            if (data.moderation)
                return false; // moderation not supported
            if (data.output_compression)
                return false; // output_compression not supported
            if (data.output_format)
                return false; // output_format not supported
            if (data.quality && data.quality !== "standard")
                return false;
            if (data.size && !["256x256", "512x512", "1024x1024"].includes(data.size))
                return false;
            if (data.style)
                return false; // style not supported
        }
        // gpt-image-1 specific validations
        if (model === "gpt-image-1") {
            if (data.response_format)
                return false; // response_format not supported (always b64_json)
            if (data.style)
                return false; // style not supported
            if (data.quality && !["auto", "high", "medium", "low"].includes(data.quality))
                return false;
            if (data.size && !["auto", "1024x1024", "1536x1024", "1024x1536"].includes(data.size))
                return false;
        }
        return true;
    }, {
        message: "Invalid parameter combination for the selected model. Check model-specific parameter restrictions.",
        path: ["model"]
    });
    // Use ._def.schema.shape to get the raw shape for server.tool due to Zod refinements
    server.tool("create-image", createImageSchema._def.schema.shape, async (args, _extra) => {
        // If AZURE_OPENAI_API_KEY is defined, use the AzureOpenAI class
        const openai = process.env.AZURE_OPENAI_API_KEY ? new openai_1.AzureOpenAI() : new openai_1.OpenAI();
        const { prompt, background, model = "gpt-image-1", moderation, n, output_compression, output_format, quality, response_format, size, style, user, output = "base64", file_output: file_outputRaw, } = args;
        const file_output = file_outputRaw;
        // Enforce: if background is 'transparent', output_format must be 'png' or 'webp'
        if (background === "transparent" && output_format && !["png", "webp"].includes(output_format)) {
            throw new Error("If background is 'transparent', output_format must be 'png' or 'webp'");
        }
        // Build image parameters based on model
        const imageParams = {
            prompt,
            model,
        };
        // Add model-specific parameters
        if (model === "gpt-image-1") {
            if (background)
                imageParams.background = background;
            if (moderation)
                imageParams.moderation = moderation;
            if (output_format)
                imageParams.output_format = output_format;
            if (typeof output_compression !== "undefined" && output_format && ["webp", "jpeg"].includes(output_format)) {
                imageParams.output_compression = output_compression;
            }
            if (quality)
                imageParams.quality = quality;
            if (size)
                imageParams.size = size;
        }
        else if (model === "dall-e-3") {
            if (quality)
                imageParams.quality = quality;
            if (response_format)
                imageParams.response_format = response_format;
            if (size)
                imageParams.size = size;
            if (style)
                imageParams.style = style;
        }
        else if (model === "dall-e-2") {
            if (quality)
                imageParams.quality = quality;
            if (response_format)
                imageParams.response_format = response_format;
            if (size)
                imageParams.size = size;
        }
        // Common parameters
        if (n)
            imageParams.n = n;
        if (user)
            imageParams.user = user;
        const result = await openai.images.generate(imageParams);
        // Handle different response formats based on model
        let images = [];
        if (model === "gpt-image-1") {
            // gpt-image-1 always returns base64 images in data[].b64_json
            images = (result.data ?? []).map((img) => ({
                b64: img.b64_json,
                mimeType: output_format === "jpeg" ? "image/jpeg" : output_format === "webp" ? "image/webp" : "image/png",
                ext: output_format === "jpeg" ? "jpg" : output_format === "webp" ? "webp" : "png",
            }));
        }
        else {
            // dall-e-2 and dall-e-3 can return either URLs or base64 depending on response_format
            images = (result.data ?? []).map((img) => ({
                b64: img.b64_json,
                url: img.url,
                mimeType: "image/png", // Default for dall-e models
                ext: "png",
            }));
        }
        // If using URLs (dall-e-2/dall-e-3 with response_format="url"), handle differently
        if (response_format === "url" && model !== "gpt-image-1") {
            return {
                content: images.map((img) => ({
                    type: "text",
                    text: `Generated image URL: ${img.url}`,
                })),
            };
        }
        // For base64 responses, check size and handle file output
        const base64Images = images.filter(img => img.b64);
        if (base64Images.length === 0) {
            throw new Error("No base64 image data received from the API");
        }
        // Auto-switch to file_output if total base64 size exceeds 1MB
        const MAX_RESPONSE_SIZE = 1048576; // 1MB
        const totalBase64Size = base64Images.reduce((sum, img) => sum + Buffer.byteLength(img.b64, "base64"), 0);
        let effectiveOutput = output;
        let effectiveFileOutput = file_output;
        if (output === "base64" && totalBase64Size > MAX_RESPONSE_SIZE) {
            effectiveOutput = "file_output";
            if (!file_output) {
                // Use MCP_HF_WORK_DIR if set (ensure it exists); otherwise use the default images directory
                const tmpDir = process.env.MCP_HF_WORK_DIR || getDefaultImageDirectory();
                try {
                    fs_1.default.mkdirSync(tmpDir, { recursive: true });
                }
                catch (e) {
                    console.error(`Warning: Could not create image output directory at ${tmpDir}:`, e);
                }
                const unique = Date.now();
                effectiveFileOutput = path_1.default.join(tmpDir, `openai_image_${unique}.${base64Images[0]?.ext ?? "png"}`);
            }
        }
        if (effectiveOutput === "file_output") {
            const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
            const path = await Promise.resolve().then(() => __importStar(require("path")));
            // If multiple images, append index to filename
            const basePath = effectiveFileOutput;
            const responses = [];
            for (let i = 0; i < base64Images.length; i++) {
                const img = base64Images[i];
                let filePath = basePath;
                if (base64Images.length > 1) {
                    const parsed = path.parse(basePath);
                    filePath = path.join(parsed.dir, `${parsed.name}_${i + 1}.${img.ext ?? "png"}`);
                }
                else {
                    // Ensure correct extension
                    const parsed = path.parse(basePath);
                    filePath = path.join(parsed.dir, `${parsed.name}.${img.ext ?? "png"}`);
                }
                await fs.writeFile(filePath, Buffer.from(img.b64, "base64"));
                responses.push({ type: "text", text: `Image saved to: file://${filePath}` });
            }
            return { content: responses };
        }
        else {
            // Default: base64
            return {
                content: base64Images.map((img) => ({
                    type: "image",
                    data: img.b64,
                    mimeType: img.mimeType,
                })),
            };
        }
    });
    // Image input schema for reuse
    const imageInputSchema = zod_1.z.string().refine((val) => absolutePathCheck(val) || base64Check(val), { message: "Must be an absolute path or a base64-encoded string (optionally as a data URL)" }).describe("Absolute path to an image file (png, jpg, webp < 25MB) or a base64-encoded image string.");
    // Edit Image Tool (gpt-image-1 and dall-e-2)
    const editImageBaseSchema = zod_1.z.object({
        image: zod_1.z.union([
            zod_1.z.string().describe("Single image: absolute path or base64 string."),
            zod_1.z.array(zod_1.z.string()).describe("Multiple images: array of absolute paths or base64 strings (gpt-image-1 only).")
        ]).describe("Image(s) to edit. Single image for dall-e-2, or single/multiple images for gpt-image-1."),
        prompt: zod_1.z.string().max(32000).describe("A text description of the desired edit. Max 32000 chars for gpt-image-1, 1000 for dall-e-2."),
        mask: zod_1.z.string().optional().describe("Optional absolute path or base64 string for a mask image (png < 4MB, same dimensions as the first image). Fully transparent areas indicate where to edit."),
        model: zod_1.z.enum(["dall-e-2", "gpt-image-1"]).default("gpt-image-1").describe("Model to use for editing."),
        n: zod_1.z.number().int().min(1).max(10).optional().describe("Number of images to generate (1-10)."),
        quality: zod_1.z.enum(["auto", "high", "medium", "low", "standard"]).optional().describe("Quality. gpt-image-1: auto/high/medium/low. dall-e-2: standard only."),
        response_format: zod_1.z.enum(["url", "b64_json"]).optional().describe("Response format (dall-e-2 only). gpt-image-1 always returns b64_json."),
        size: zod_1.z.enum(["1024x1024", "1536x1024", "1024x1536", "auto", "256x256", "512x512"]).optional().describe("Size. gpt-image-1: auto/1024x1024/1536x1024/1024x1536. dall-e-2: 256x256/512x512/1024x1024."),
        user: zod_1.z.string().optional().describe("Optional user identifier for OpenAI monitoring."),
        output: zod_1.z.enum(["base64", "file_output"]).default("base64").describe("Output format: base64 or file path."),
        file_output: zod_1.z.string().refine(absolutePathCheck, { message: "Path must be absolute" }).optional()
            .describe("Absolute path to save the output image file, including the desired file extension (e.g., /path/to/image.png). If n > 1, an index is appended."),
    });
    // Full schema with refinement for validation inside the handler
    const editImageSchema = editImageBaseSchema.refine((data) => {
        if (data.output !== "file_output")
            return true;
        if (typeof data.file_output !== "string")
            return false;
        return absolutePathCheck(data.file_output);
    }, { message: "file_output must be an absolute path when output is 'file_output'", path: ["file_output"] }).refine((data) => {
        // Model-specific validation
        const { model = "gpt-image-1", image, prompt } = data;
        if (model === "dall-e-2") {
            // dall-e-2 only supports single images
            if (Array.isArray(image))
                return false;
            // dall-e-2 has a shorter prompt limit
            if (prompt.length > 1000)
                return false;
            // dall-e-2 quality validation
            if (data.quality && data.quality !== "standard")
                return false;
            // dall-e-2 size validation
            if (data.size && !["256x256", "512x512", "1024x1024"].includes(data.size))
                return false;
        }
        if (model === "gpt-image-1") {
            // gpt-image-1 doesn't support response_format
            if (data.response_format)
                return false;
            // gpt-image-1 quality validation
            if (data.quality && !["auto", "high", "medium", "low"].includes(data.quality))
                return false;
            // gpt-image-1 size validation
            if (data.size && !["auto", "1024x1024", "1536x1024", "1024x1536"].includes(data.size))
                return false;
        }
        return true;
    }, {
        message: "Invalid parameter combination for the selected model. Check model-specific parameter restrictions.",
        path: ["model"]
    });
    // Edit Image Tool (gpt-image-1 and dall-e-2)
    server.tool("edit-image", editImageBaseSchema.shape, // <-- Use the base schema shape here
    async (args, _extra) => {
        // Validate arguments using the full schema with refinements
        const validatedArgs = editImageSchema.parse(args);
        // Explicitly validate image and mask inputs here
        const imageInputs = Array.isArray(validatedArgs.image) ? validatedArgs.image : [validatedArgs.image];
        for (const img of imageInputs) {
            if (!absolutePathCheck(img) && !base64Check(img)) {
                throw new Error("Invalid 'image' input: Must be an absolute path or a base64-encoded string.");
            }
        }
        if (validatedArgs.mask && !absolutePathCheck(validatedArgs.mask) && !base64Check(validatedArgs.mask)) {
            throw new Error("Invalid 'mask' input: Must be an absolute path or a base64-encoded string.");
        }
        const openai = process.env.AZURE_OPENAI_API_KEY ? new openai_1.AzureOpenAI() : new openai_1.OpenAI();
        const { image: imageInput, prompt, mask: maskInput, model = "gpt-image-1", n, quality, response_format, size, user, output = "base64", file_output: file_outputRaw, } = validatedArgs; // <-- Use validatedArgs here
        const file_output = file_outputRaw;
        // Helper to convert input (path or base64) to toFile
        async function inputToFile(input, idx = 0) {
            if (absolutePathCheck(input)) {
                // File path: infer mime type from extension
                const ext = input.split('.').pop()?.toLowerCase();
                let mime = "image/png";
                if (ext === "jpg" || ext === "jpeg")
                    mime = "image/jpeg";
                else if (ext === "webp")
                    mime = "image/webp";
                else if (ext === "png")
                    mime = "image/png";
                // else default to png
                return await (0, openai_1.toFile)(fs_1.default.createReadStream(input), undefined, { type: mime });
            }
            else {
                // Base64 or data URL
                let base64 = input;
                let mime = "image/png";
                if (input.startsWith("data:image/")) {
                    // data URL
                    const match = input.match(/^data:(image\/\w+);base64,(.*)$/);
                    if (match) {
                        mime = match[1];
                        base64 = match[2];
                    }
                }
                const buffer = Buffer.from(base64, "base64");
                return await (0, openai_1.toFile)(buffer, `input_${idx}.${mime.split("/")[1] || "png"}`, { type: mime });
            }
        }
        // Prepare image input(s)
        let imageFile;
        if (Array.isArray(imageInput)) {
            // Multiple images (gpt-image-1 only)
            imageFile = await Promise.all(imageInput.map((img, idx) => inputToFile(img, idx)));
        }
        else {
            // Single image
            imageFile = await inputToFile(imageInput, 0);
        }
        // Prepare mask input
        const maskFile = maskInput ? await inputToFile(maskInput, 100) : undefined;
        // Construct parameters for OpenAI API
        const editParams = {
            image: imageFile,
            prompt,
            model,
            ...(maskFile ? { mask: maskFile } : {}),
            ...(n ? { n } : {}),
            ...(user ? { user } : {}),
        };
        // Add model-specific parameters
        if (model === "gpt-image-1") {
            if (quality)
                editParams.quality = quality;
            if (size)
                editParams.size = size;
            // gpt-image-1 always uses b64_json format
        }
        else if (model === "dall-e-2") {
            if (quality)
                editParams.quality = quality;
            if (response_format)
                editParams.response_format = response_format;
            if (size)
                editParams.size = size;
        }
        const result = await openai.images.edit(editParams);
        // Handle different response formats based on model
        let editedImages = [];
        if (model === "gpt-image-1") {
            // gpt-image-1 always returns base64 images in data[].b64_json
            editedImages = (result.data ?? []).map((img) => ({
                b64: img.b64_json,
                mimeType: "image/png",
                ext: "png",
            }));
        }
        else {
            // dall-e-2 can return either URLs or base64 depending on response_format
            editedImages = (result.data ?? []).map((img) => ({
                b64: img.b64_json,
                url: img.url,
                mimeType: "image/png",
                ext: "png",
            }));
        }
        // If using URLs (dall-e-2 with response_format="url"), handle differently
        if (response_format === "url" && model === "dall-e-2") {
            return {
                content: editedImages.map((img) => ({
                    type: "text",
                    text: `Edited image URL: ${img.url}`,
                })),
            };
        }
        // For base64 responses, check size and handle file output
        const base64Images = editedImages.filter(img => img.b64);
        if (base64Images.length === 0) {
            throw new Error("No base64 image data received from the API");
        }
        // Auto-switch to file_output if total base64 size exceeds 1MB
        const MAX_RESPONSE_SIZE = 1048576; // 1MB
        const totalBase64Size = base64Images.reduce((sum, img) => sum + Buffer.byteLength(img.b64, "base64"), 0);
        let effectiveOutput = output;
        let effectiveFileOutput = file_output;
        if (output === "base64" && totalBase64Size > MAX_RESPONSE_SIZE) {
            effectiveOutput = "file_output";
            if (!file_output) {
                // Use MCP_HF_WORK_DIR if set (ensure it exists); otherwise use the default images directory
                const tmpDir = process.env.MCP_HF_WORK_DIR || getDefaultImageDirectory();
                try {
                    fs_1.default.mkdirSync(tmpDir, { recursive: true });
                }
                catch (e) {
                    console.error(`Warning: Could not create image output directory at ${tmpDir}:`, e);
                }
                const unique = Date.now();
                effectiveFileOutput = path_1.default.join(tmpDir, `openai_image_edit_${unique}.png`);
            }
        }
        if (effectiveOutput === "file_output") {
            if (!effectiveFileOutput) {
                throw new Error("file_output path is required when output is 'file_output'");
            }
            // Use fs/promises and path (already imported)
            const basePath = effectiveFileOutput;
            const responses = [];
            for (let i = 0; i < base64Images.length; i++) {
                const img = base64Images[i];
                let filePath = basePath;
                if (base64Images.length > 1) {
                    const parsed = path_1.default.parse(basePath);
                    // Append index before the original extension if it exists, otherwise just append index and .png
                    const ext = parsed.ext || `.${img.ext}`;
                    filePath = path_1.default.join(parsed.dir, `${parsed.name}_${i + 1}${ext}`);
                }
                else {
                    // Ensure the extension from the path is used, or default to .png
                    const parsed = path_1.default.parse(basePath);
                    const ext = parsed.ext || `.${img.ext}`;
                    filePath = path_1.default.join(parsed.dir, `${parsed.name}${ext}`);
                }
                await fs_1.default.promises.writeFile(filePath, Buffer.from(img.b64, "base64"));
                // Workaround: Return file path as text
                responses.push({ type: "text", text: `Image saved to: file://${filePath}` });
            }
            return { content: responses };
        }
        else {
            // Default: base64
            return {
                content: base64Images.map((img) => ({
                    type: "image",
                    data: img.b64,
                    mimeType: img.mimeType, // Should be image/png
                })),
            };
        }
    });
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
})();
