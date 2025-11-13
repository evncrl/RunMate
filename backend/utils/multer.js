const multer = require("multer");
const path = require("path");

module.exports = multer({
    limits: { fieldSize: 100 * 1024 * 1024 },
    storage: multer.diskStorage({}),
    fileFilter: (req, file, cb) => {
        let ext = path.extname(file.originalname).toLowerCase();
        if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
            // Inform multer the file is not acceptable
            const err = new Error("Unsupported file type!");
            err.status = 400;
            console.log("Unsupported file type!", file.originalname);
            return cb(err, false);
        }
        cb(null, true);
    },
});