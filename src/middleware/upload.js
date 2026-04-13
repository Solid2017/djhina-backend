const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = path.join(__dirname, '../../public/admin/media');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sub = file.fieldname === 'avatar' ? 'avatars'
              : file.fieldname === 'photo'  ? 'speakers'
              : file.fieldname === 'video'  ? 'videos'
              : 'events';
    const dir = path.join(uploadDir, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'video') {
    VIDEO_EXTS.includes(ext) ? cb(null, true) : cb(new Error('Formats vidéo acceptés : MP4, MOV, AVI, WEBM, MKV.'));
  } else {
    IMAGE_EXTS.includes(ext) ? cb(null, true) : cb(new Error('Seuls JPG, PNG et WEBP sont acceptés.'));
  }
};

// Upload images only (avatar, photo, cover)
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
});

// Upload pour les événements : cover (image) + video optionnel
const uploadEvent = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_VIDEO_SIZE) || 200 * 1024 * 1024 },
}).fields([
  { name: 'cover', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

module.exports = upload;
module.exports.uploadEvent = uploadEvent;
