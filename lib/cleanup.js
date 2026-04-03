import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

class Cleaner extends EventEmitter {
  constructor() {
    super();
    this.stats = {
      found: 0,
      deleted: 0,
      totalSize: 0,
      files: [] // List of objects { path, size, daysOld, mtime }
    };
  }

  async cleanup(directory, daysThreshold, confirm = false) {
    try {
      this.emit('cleanup-start', { directory, daysThreshold, confirm });

      const entries = await fs.readdir(directory, { recursive: true, withFileTypes: true });
      const now = Date.now();

      for (const entry of entries) {
        if (entry.isDirectory()) continue;

        const fullPath = path.join(entry.parentPath || directory, entry.name);
        
        try {
          const stats = await fs.stat(fullPath);
          const ageInMs = now - stats.mtime.getTime();
          const daysOld = ageInMs / (1000 * 60 * 60 * 24);

          if (daysOld > daysThreshold) {
            const fileData = {
              path: fullPath,
              name: entry.name,
              size: stats.size,
              daysOld: Math.floor(daysOld),
              mtime: stats.mtime
            };

            this.stats.found++;
            this.stats.totalSize += stats.size;
            this.stats.files.push(fileData);

            this.emit('file-found', fileData);
          }
        } catch (err) {
          this.emit('error', new Error(`Could not access ${entry.name}: ${err.message}`));
        }
      }

      // if confirm is true - delete the files
      if (confirm && this.stats.files.length > 0) {
        for (const file of this.stats.files) {
          try {
            await fs.unlink(file.path);
            this.stats.deleted++;
            this.emit('file-deleted', { name: file.name });
          } catch (err) {
            this.emit('error', new Error(`Failed to delete ${file.name}: ${err.message}`));
          }
        }
      }

      this.emit('cleanup-complete', {
        ...this.stats,
        isDryRun: !confirm
      });

    } catch (error) {
      this.emit('error', error);
    }
  }
}

export default Cleaner;