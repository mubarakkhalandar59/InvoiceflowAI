import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import {
  buildInvoiceFingerprintId,
  evaluateDeterministicRules,
} from './server/decisionEngine.ts';
import {
  DEMO_SCENARIOS,
  renderDemoInvoiceSvgDataUrl,
} from './server/demoScenarios.ts';
import {
  checkDuplicateFingerprint,
  fetchActiveWorkflowRules,
  requireVerifiedAuth,
} from './server/firebaseAuth.ts';
import type { AuthenticatedRequest } from './server/firebaseAuth.ts';
import {
  extractInvoiceWithGemini,
  GeminiExtractionHttpError,
} from './server/geminiExtractor.ts';
import type { ProcessedInvoiceResponse } from './src/types/invoice.ts';

const PORT = Number(process.env.PORT || 3000);
const UPLOADS_DIR = path.resolve(os.tmpdir(), 'invoiceflow_uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max free-tier safe payload
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new Error(
          'Unsupported file type. Upload a PDF, PNG, JPEG, or WebP invoice.'
        )
      );
      return;
    }
    cb(null, true);
  },
});

function hasValidFileSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 8) return false;
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 4).toString('ascii') === '%PDF';
  }
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

function generateSafeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}

function resolveConfinedUploadPath(fileName: string): string {
  const safeBase = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '');
  const resolved = path.resolve(UPLOADS_DIR, safeBase);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error('Invalid upload path.');
  }
  return resolved;
}

function findStoredDocumentFile(invoiceId: string): {
  filePath: string;
  mimeType: string;
} | null {
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(invoiceId)) return null;
  for (const [mimeType, ext] of Object.entries(MIME_TO_EXT)) {
    const candidate = resolveConfinedUploadPath(`${invoiceId}.${ext}`);
    if (fs.existsSync(candidate)) {
      return { filePath: candidate, mimeType };
    }
  }
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'invoiceflow-ai',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  // Returns verified Firebase identity and server-resolved trusted role
  app.get('/api/auth/me', requireVerifiedAuth, (req: AuthenticatedRequest, res) => {
    const caller = req.caller!;
    res.json({
      uid: caller.uid,
      email: caller.email,
      emailVerified: caller.emailVerified,
      role: caller.role,
    });
  });

  // Lists available synthetic demo scenarios (no sensitive data)
  app.get('/api/demo/scenarios', requireVerifiedAuth, (_req, res) => {
    res.json({
      scenarios: DEMO_SCENARIOS.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        expectedOutcome: s.expectedOutcome,
        fileName: s.fileName,
        vendorName: s.vendorName,
        invoiceNumber: s.invoiceNumber,
        totalDisplay: s.totalDisplay,
        note: s.note,
      })),
    });
  });

  // Process a real uploaded PDF or image invoice via Gemini + Deterministic Decision Engine
  app.post(
    '/api/invoices/process',
    requireVerifiedAuth,
    (req: AuthenticatedRequest, res, next) => {
      upload.single('invoice')(req, res, (err) => {
        if (err) {
          res.status(400).json({
            error: err instanceof Error ? err.message : 'File upload failed.',
          });
          return;
        }
        next();
      });
    },
    async (req: AuthenticatedRequest, res) => {
      const startedAt = Date.now();
      const caller = req.caller!;
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No invoice file was uploaded.' });
        return;
      }
      if (!hasValidFileSignature(file.buffer, file.mimetype)) {
        res.status(400).json({
          error:
            'File content signature does not match declared PDF or image format.',
        });
        return;
      }

      try {
        const invoiceId = generateSafeId('inv');
        const ext = MIME_TO_EXT[file.mimetype] || 'bin';
        const diskPath = resolveConfinedUploadPath(`${invoiceId}.${ext}`);
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        fs.writeFileSync(diskPath, file.buffer);

        const rules = await fetchActiveWorkflowRules(caller.idToken);
        const aiResult = await extractInvoiceWithGemini({
          fileBuffer: file.buffer,
          mimeType: file.mimetype,
        });

        const fp = buildInvoiceFingerprintId(
          aiResult.extraction.vendor_name,
          aiResult.extraction.invoice_number,
          false
        );
        const duplicateDetected = fp
          ? await checkDuplicateFingerprint(caller.idToken, fp.fingerprintId)
          : false;

        const decision = evaluateDeterministicRules({
          extraction: aiResult.extraction,
          schemaValid: aiResult.schemaValid,
          schemaErrors: aiResult.schemaErrors,
          duplicateDetected,
          rules,
        });

        const base64DataUrl = `data:${file.mimetype};base64,${file.buffer.toString(
          'base64'
        )}`;
        const fitsFirestorePreview = base64DataUrl.length <= 700000;

        const payload: ProcessedInvoiceResponse = {
          invoiceId,
          extraction: aiResult.extraction,
          schemaValid: aiResult.schemaValid,
          schemaErrors: aiResult.schemaErrors,
          arithmeticValid: decision.arithmeticValid,
          taxValid: decision.taxValid,
          datesValid: decision.datesValid,
          duplicateDetected: decision.duplicateDetected,
          inrEquivalent: decision.inrEquivalent,
          escalationReasons: decision.escalationReasons,
          ruleChecks: decision.ruleChecks,
          status: decision.status,
          assignedTier: decision.assignedTier,
          storageMode: fitsFirestorePreview ? 'FIRESTORE_PREVIEW' : 'SERVER_DISK',
          previewDataUrl: fitsFirestorePreview ? base64DataUrl : undefined,
          fingerprintId: fp?.fingerprintId,
          vendorKey: fp?.vendorKey,
          invoiceNumberKey: fp?.invoiceNumberKey,
          aiModel: aiResult.model,
          processingMs: Date.now() - startedAt,
        };

        res.json(payload);
      } catch (err) {
        const status =
          err instanceof GeminiExtractionHttpError ? err.httpStatus : 500;
        const message =
          err instanceof Error
            ? err.message
            : 'Invoice AI extraction failed unexpectedly.';
        res.status(status).json({ error: message });
      }
    }
  );

  const DemoProcessSchema = z.object({
    scenarioId: z.enum([
      'auto_approve_low',
      'manager_approval_mid',
      'admin_approval_high',
      'duplicate_invoice',
      'missing_information',
      'calculation_mismatch',
      'low_confidence',
    ]),
  });

  // Process one of the 7 synthetic demo invoices through real Gemini extraction + rules
  app.post(
    '/api/invoices/process-demo',
    requireVerifiedAuth,
    async (req: AuthenticatedRequest, res) => {
      const startedAt = Date.now();
      const caller = req.caller!;
      const parsed = DemoProcessSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid demo scenario ID.' });
        return;
      }

      const spec = DEMO_SCENARIOS.find((s) => s.id === parsed.data.scenarioId);
      if (!spec) {
        res.status(404).json({ error: 'Demo scenario not found.' });
        return;
      }

      const invoiceId = generateSafeId('demo');

      try {
        const rules = await fetchActiveWorkflowRules(caller.idToken);
        const aiResult = await extractInvoiceWithGemini({
          syntheticText: spec.invoiceText,
        });

        const fp = buildInvoiceFingerprintId(
          aiResult.extraction.vendor_name,
          aiResult.extraction.invoice_number,
          true
        );

        let duplicateDetected = false;
        if (spec.id === 'duplicate_invoice') {
          duplicateDetected = true;
        } else if (fp) {
          duplicateDetected = await checkDuplicateFingerprint(
            caller.idToken,
            fp.fingerprintId
          );
        }

        const decision = evaluateDeterministicRules({
          extraction: aiResult.extraction,
          schemaValid: aiResult.schemaValid,
          schemaErrors: aiResult.schemaErrors,
          duplicateDetected,
          rules,
        });

        const previewDataUrl = renderDemoInvoiceSvgDataUrl(spec);

        const payload: ProcessedInvoiceResponse = {
          invoiceId,
          extraction: aiResult.extraction,
          schemaValid: aiResult.schemaValid,
          schemaErrors: aiResult.schemaErrors,
          arithmeticValid: decision.arithmeticValid,
          taxValid: decision.taxValid,
          datesValid: decision.datesValid,
          duplicateDetected: decision.duplicateDetected,
          inrEquivalent: decision.inrEquivalent,
          escalationReasons: decision.escalationReasons,
          ruleChecks: decision.ruleChecks,
          status: decision.status,
          assignedTier: decision.assignedTier,
          storageMode: 'SYNTHETIC_DEMO',
          previewDataUrl,
          fingerprintId: fp?.fingerprintId,
          vendorKey: fp?.vendorKey,
          invoiceNumberKey: fp?.invoiceNumberKey,
          aiModel: aiResult.model,
          processingMs: Date.now() - startedAt,
        };

        res.json(payload);
      } catch (err) {
        const status =
          err instanceof GeminiExtractionHttpError ? err.httpStatus : 500;
        const message =
          err instanceof Error
            ? err.message
            : 'Demo invoice processing failed unexpectedly.';
        res.status(status).json({ error: message });
      }
    }
  );

  // Server-side RBAC authorization gate before human approval/rejection
  const DecisionAuthSchema = z.object({
    action: z.enum(['HUMAN_APPROVED', 'REJECTED', 'ESCALATED']),
    invoiceOwnerId: z.string().min(1).max(128),
    assignedTier: z.enum(['NONE', 'MANAGER', 'ADMIN']),
    currentStatus: z.string().min(1).max(40),
    isDemo: z.boolean(),
    comment: z.string().max(1000).optional(),
  });

  app.post(
    '/api/invoices/:invoiceId/authorize-decision',
    requireVerifiedAuth,
    (req: AuthenticatedRequest, res) => {
      const caller = req.caller!;
      const parsed = DecisionAuthSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid decision payload.' });
        return;
      }
      const { action, invoiceOwnerId, assignedTier, currentStatus, isDemo } =
        parsed.data;

      if (caller.role === 'EMPLOYEE') {
        res.status(422).json({
          error:
            'Employees cannot approve, reject, or escalate invoices. Manager or Admin role is required.',
        });
        return;
      }

      if (
        !isDemo &&
        caller.role !== 'ADMIN' &&
        invoiceOwnerId === caller.uid
      ) {
        res.status(422).json({
          error: 'Users cannot approve or reject their own submitted invoices.',
        });
        return;
      }

      if (
        caller.role === 'MANAGER' &&
        (assignedTier === 'ADMIN' || currentStatus === 'PENDING_ADMIN')
      ) {
        res.status(422).json({
          error:
            'This invoice requires Admin authority because it exceeds Manager threshold or is Admin-escalated.',
        });
        return;
      }

      if (
        caller.role !== 'ADMIN' &&
        ['HUMAN_APPROVED', 'REJECTED', 'AUTO_APPROVED'].includes(currentStatus)
      ) {
        res.status(409).json({
          error: 'This invoice has already reached a final status.',
        });
        return;
      }

      res.json({
        authorized: true,
        reviewerId: caller.uid,
        reviewerEmail: caller.email,
        reviewerRole: caller.role,
        action,
        reviewedAt: new Date().toISOString(),
      });
    }
  );

  // Authenticated private document endpoint for server-stored PDF/image files
  app.get(
    '/api/invoices/:invoiceId/document',
    requireVerifiedAuth,
    async (req: AuthenticatedRequest, res) => {
      const caller = req.caller!;
      const { invoiceId } = req.params;
      if (!/^[a-zA-Z0-9_-]{4,128}$/.test(invoiceId)) {
        res.status(400).json({ error: 'Invalid invoice ID.' });
        return;
      }

      // Verify ownership or Manager/Admin authorization via Firestore REST using caller JWT
      try {
        const configPath = path.resolve(
          process.cwd(),
          'firebase-applet-config.json'
        );
        const fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
          projectId: string;
          firestoreDatabaseId?: string;
        };
        const dbId = fbConfig.firestoreDatabaseId || '(default)';
        const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
          fbConfig.projectId
        )}/databases/${encodeURIComponent(
          dbId
        )}/documents/invoices/${encodeURIComponent(invoiceId)}`;
        const fsRes = await fetch(docUrl, {
          headers: { Authorization: `Bearer ${caller.idToken}` },
        });
        if (!fsRes.ok) {
          res.status(401).json({
            error: 'You are not authorized to access this invoice document.',
          });
          return;
        }
      } catch {
        res.status(401).json({ error: 'Authorization check failed.' });
        return;
      }

      const found = findStoredDocumentFile(invoiceId);
      if (!found) {
        res.status(404).json({ error: 'Stored document file not found.' });
        return;
      }

      res.setHeader('Content-Type', found.mimeType);
      res.setHeader('Cache-Control', 'private, no-store');
      fs.createReadStream(found.filePath).pipe(res);
    }
  );

  // Guarantee /api routes never fall through to HTML SPA or default HTML error pages
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (res.headersSent) {
        next(err);
        return;
      }
      if (req.path.startsWith('/api')) {
        const message =
          err instanceof Error ? err.message : 'Unexpected server error.';
        res.status(500).json({ error: message });
        return;
      }
      next(err);
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InvoiceFlow AI server running on http://0.0.0.0:${PORT}`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection in InvoiceFlow AI server:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception in InvoiceFlow AI server:', err);
});

startServer().catch((err) => {
  console.error('Failed to start InvoiceFlow AI server:', err);
  process.exit(1);
});
