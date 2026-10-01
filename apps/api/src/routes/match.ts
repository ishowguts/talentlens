import { Router } from 'express';
import multer from 'multer';
import { extractText, getDocumentProxy } from 'unpdf';
import { matchTextRequestSchema, RESUME_PDF_MAX_BYTES, RESUME_TEXT_MIN } from 'shared';
import { ApiError } from '../lib/ApiError.js';
import { collapseWhitespace } from '../lib/text.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { matchResume, type MatchDeps } from '../services/match.js';

const PDF_MAGIC = '%PDF';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: RESUME_PDF_MAX_BYTES, files: 1 },
});

/** Plain text from a resume PDF. Rejects anything that is not really a PDF, or that yields too little text. */
export async function pdfToText(buffer: Buffer): Promise<string> {
  if (buffer.subarray(0, PDF_MAGIC.length).toString('latin1') !== PDF_MAGIC) {
    throw ApiError.validation('That file is not a PDF');
  }
  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: true });
    text = collapseWhitespace(Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text);
  } catch {
    throw ApiError.validation('That PDF could not be read');
  }
  if (text.length < RESUME_TEXT_MIN) {
    throw ApiError.validation(
      `Only ${text.length} characters of text could be extracted; at least ${RESUME_TEXT_MIN} are needed. A scanned PDF will not work.`,
    );
  }
  return text;
}

/** POST /api/match — a resume PDF or JSON text, ranked against the corpus (ARCHITECTURE section 6). */
export function matchRouter(deps: MatchDeps, limitPerMinute: number): Router {
  const router = Router();

  router.post('/match', createRateLimiter(limitPerMinute), upload.single('file'), async (req, res, next) => {
    try {
      const text = req.file
        ? await pdfToText(req.file.buffer)
        : matchTextRequestSchema.parse(req.body ?? {}).text;
      res.json(await matchResume(deps, text));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
