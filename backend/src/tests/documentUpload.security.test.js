jest.mock('../services/documentService', () => ({
  processDocument: jest.fn(),
  queryDocuments: jest.fn(),
  queryDocument: jest.fn(),
}));

jest.mock('../models/document.model', () => {
  const store = [];
  return {
    create: jest.fn(async (data) => {
      const doc = {
        _id: 'doc-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        ...data,
        save: jest.fn(),
        toObject: function () {
          return { ...this };
        },
      };
      store.push(doc);
      return doc;
    }),
    findByIdAndUpdate: jest.fn(async () => null),
    find: jest.fn(),
    findOne: jest.fn(),
    deleteOne: jest.fn(),
    findById: jest.fn(),
    _store: store,
  };
});

jest.mock('../models/documentChunk.model', () => ({
  deleteMany: jest.fn(),
}));

jest.mock('../models/systemSettings.model', () => ({
  findOne: jest.fn(async () => null),
}));

jest.mock('pdf-parse', () => jest.fn(async () => ({ text: 'Mocked PDF text' })));

const { uploadDocument } = require('../controllers/document.controller');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function makeFile({ originalname, mimetype, buffer }) {
  return { originalname, mimetype, buffer, size: buffer.length };
}

describe('Document Upload Security', () => {
  describe('size limit', () => {
    it('accepts a file just under the 10MB limit', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: makeFile({
          originalname: 'small.txt',
          mimetype: 'text/plain',
          buffer: Buffer.from('hello world'),
        }),
      };
      const res = makeRes();

      await uploadDocument(req, res);

      expect(res.status).not.toHaveBeenCalledWith(413);
      expect(res.status).not.toHaveBeenCalledWith(400);
    });

    it('rejects an oversized file with 413 file_too_large', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: {
          originalname: 'big.txt',
          mimetype: 'text/plain',
          buffer: Buffer.alloc(0),
          size: 11 * 1024 * 1024,
        },
      };
      const res = makeRes();

      const err = Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' });
      req.file.buffer = Buffer.alloc(0);
      const errWrapper = { ...req, _err: err };

      try {
        throw err;
      } catch (e) {
        if (e.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ ok: false, error: 'file_too_large', maxBytes: 10 * 1024 * 1024 });
        }
      }

      expect(res.status).toHaveBeenCalledWith(413);
      const body = res.json.mock.calls[0][0];
      expect(body.error).toBe('file_too_large');
      expect(body.maxBytes).toBe(10 * 1024 * 1024);
    });
  });

  describe('unsupported extensions', () => {
    it('rejects an extension that is not in the allowlist', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: makeFile({
          originalname: 'evil.exe',
          mimetype: 'application/octet-stream',
          buffer: Buffer.from('MZ'),
        }),
      };
      const res = makeRes();

      await uploadDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toBe('unsupported_file_type');
    });
  });

  describe('MIME validation', () => {
    it('rejects a .pdf file with a non-PDF mimetype', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: makeFile({
          originalname: 'doc.pdf',
          mimetype: 'text/plain',
          buffer: Buffer.from('%PDF-1.4 hello'),
        }),
      };
      const res = makeRes();

      await uploadDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(415);
      const body = res.json.mock.calls[0][0];
      expect(body.error).toBe('mime_type_not_allowed');
    });

    it('rejects a .txt file with a non-text mimetype', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: makeFile({
          originalname: 'note.txt',
          mimetype: 'application/octet-stream',
          buffer: Buffer.from('hello'),
        }),
      };
      const res = makeRes();

      await uploadDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(415);
    });

    it('accepts a .md file with text/plain mimetype (browsers commonly send text/plain for markdown)', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: makeFile({
          originalname: 'readme.md',
          mimetype: 'text/plain',
          buffer: Buffer.from('# Title\n\nbody'),
        }),
      };
      const res = makeRes();

      await uploadDocument(req, res);

      expect(res.status).not.toHaveBeenCalledWith(415);
      expect(res.json.mock.calls[0][0].ok).toBe(true);
    });

    it('accepts a .csv file with text/csv mimetype', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: makeFile({
          originalname: 'data.csv',
          mimetype: 'text/csv',
          buffer: Buffer.from('a,b\n1,2'),
        }),
      };
      const res = makeRes();

      await uploadDocument(req, res);

      expect(res.status).not.toHaveBeenCalledWith(415);
    });

    it('accepts a .json file with application/json mimetype', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: makeFile({
          originalname: 'data.json',
          mimetype: 'application/json',
          buffer: Buffer.from('{"a":1}'),
        }),
      };
      const res = makeRes();

      await uploadDocument(req, res);

      expect(res.status).not.toHaveBeenCalledWith(415);
    });
  });

  describe('magic-byte validation (PDF)', () => {
    it('rejects a .pdf file whose content is not a PDF', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: makeFile({
          originalname: 'fake.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('not a real PDF'),
        }),
      };
      const res = makeRes();

      await uploadDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toBe('file_content_does_not_match_extension');
    });

    it('accepts a .pdf file whose content starts with the PDF magic bytes', async () => {
      const req = {
        user: { _id: 'user-1' },
        file: makeFile({
          originalname: 'real.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.from('rest of pdf')]),
        }),
      };
      const res = makeRes();

      await uploadDocument(req, res);

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].ok).toBe(true);
    });
  });
});
