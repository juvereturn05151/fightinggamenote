
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MiB

const VIDEO_EXTENSIONS = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

const backendRoot = path.resolve(import.meta.dirname, '../..');

const uploadDir = path.resolve(
  backendRoot,
  process.env.UPLOAD_DIR || 'uploads'
);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,

  filename(req, file, callback) {
    const extension = VIDEO_EXTENSIONS[file.mimetype];

    if (!extension) {
      return callback(new Error('Unsupported video type'));
    }

    const filename = `${randomUUID()}${extension}`;
    callback(null, filename);
  },
});

export const upload = multer({
  storage,

  limits: {
    fileSize: MAX_VIDEO_SIZE,
    files: 1,
  },

  fileFilter(req, file, callback) {
    if (!Object.hasOwn(VIDEO_EXTENSIONS, file.mimetype)) {
      return callback(new Error('Unsupported video type'));
    }

    callback(null, true);
  },
});

export { uploadDir };