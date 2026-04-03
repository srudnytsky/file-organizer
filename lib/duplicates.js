import { EventEmitter } from 'events';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

class DuplicateFinder extends EventEmitter {
  constructor() {
    super();
    this.filesByHash = new Map(); // Map<hash, Array<filePath>>
    this.fileStats = new Map();   // Map<hash, size> to calculate wasted space
  }

  /**
   * Calculate hash using a Readable Stream
   */
  async calculateHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  async find(directory) {
    try {
      this.emit('search-start', { directory });

      // get all files recursively
      const entries = await fsPromises.readdir(directory, { recursive: true, withFileTypes: true });
      const files = entries.filter(e => e.isFile());
      const total = files.length;
      let processed = 0;

      // operate every file
      for (const entry of files) {
        const fullPath = path.join(entry.parentPath || directory, entry.name);
        
        try {
          const stats = await fsPromises.stat(fullPath);
          const hash = await this.calculateHash(fullPath);

          // group paths by hash
          if (!this.filesByHash.has(hash)) {
            this.filesByHash.set(hash, []);
            this.fileStats.set(hash, stats.size);
          }
          this.filesByHash.get(hash).push(fullPath);

          processed++;
          this.emit('file-processed', { 
            current: processed, 
            total, 
            file: entry.name 
          });

        } catch (err) {
          // If the file is locked by another process or access is denied
          this.emit('error', new Error(`Skip file ${entry.name}: ${err.message}`));
        }
      }

      // finalize results
      const results = this._getDuplicateGroups();
      this.emit('duplicates-found', results);
      
      return results;
    } catch (error) {
      this.emit('error', error);
    }
  }

  _getDuplicateGroups() {
    const groups = [];
    let totalWastedSpace = 0;

    for (const [hash, paths] of this.filesByHash.entries()) {
      if (paths.length > 1) {
        const size = this.fileStats.get(hash);
        const wasted = (paths.length - 1) * size;
        totalWastedSpace += wasted;

        groups.push({
          hash,
          paths,
          size,
          wasted
        });
      }
    }

    return {
      groups,
      totalWastedSpace
    };
  }
}

export default DuplicateFinder;