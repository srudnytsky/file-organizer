import { EventEmitter } from 'events';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { CATEGORIES } from './utils.js';

class Organizer extends EventEmitter {
  constructor() {
    super();
    this.stats = {
      moved: new Map(), // Category -> count
      totalCopied: 0,
      totalSize: 0
    };
  }

  async organize(sourceDir, targetDir) {
    try {
      this.emit('organize-start', { sourceDir, targetDir });

      // create category folders
      for (const category of Object.keys(CATEGORIES)) {
        await fs.mkdir(path.join(targetDir, category), { recursive: true });
        this.stats.moved.set(category, 0);
      }

      // get all files without directories
      const entries = await fs.readdir(sourceDir, { recursive: true, withFileTypes: true });
      const files = entries.filter(e => e.isFile());
      const total = files.length;
      let processed = 0;

      for (const entry of files) {
        const sourcePath = path.join(entry.parentPath || sourceDir, entry.name);
        const stats = await fs.stat(sourcePath);
        const category = this._getCategory(entry.name);
        
        // generating unique target path to avoid overwriting
        const targetPath = await this._getUniquePath(targetDir, category, entry.name);

        this.emit('copy-start', { file: entry.name, category });

        try {
          if (stats.size < 10 * 1024 * 1024) {
            // small files < 10MB
            await fs.copyFile(sourcePath, targetPath);
          } else {
            // large files >= 10MB through Streams
            await pipeline(
              fsSync.createReadStream(sourcePath),
              fsSync.createWriteStream(targetPath)
            );
          }

          this.stats.totalCopied++;
          this.stats.totalSize += stats.size;
          this.stats.moved.set(category, this.stats.moved.get(category) + 1);
          
          processed++;
          this.emit('copy-complete', { current: processed, total, file: entry.name });

        } catch (err) {
          this.emit('copy-error', { file: entry.name, error: err.message });
        }
      }

      this.emit('organize-complete', this.stats);
    } catch (error) {
      this.emit('error', error);
    }
  }

  _getCategory(filename) {
    const ext = path.extname(filename).toLowerCase();
    for (const [category, extensions] of Object.entries(CATEGORIES)) {
      if (extensions.includes(ext)) return category;
    }
    return 'Other';
  }

  async _getUniquePath(targetDir, category, filename) {
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);
    let targetPath = path.join(targetDir, category, filename);
    let counter = 1;

    // Check if the file exists keep generating unique names until we find available one
    while (true) {
      try {
        await fs.access(targetPath);
        // if no error, the file exists
        targetPath = path.join(targetDir, category, `${name}(${counter})${ext}`);
        counter++;
      } catch {
        // file does not exist, path is available
        break;
      }
    }
    return targetPath;
  }
}

export default Organizer;