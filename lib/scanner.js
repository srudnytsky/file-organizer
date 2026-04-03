import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

class Scanner extends EventEmitter {
  constructor() {
    super();
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      byType: new Map(), // Map<ext, {count, size}>
      ageGroups: {
        last7: 0,
        last30: 0,
        older90: 0
      },
      allFiles: [], // 3 most oldest and largest files
    };
  }

  async scan(directory) {
    try {
      this.emit('scan-start', { directory });
      
      // recursion
      const entries = await fs.readdir(directory, { recursive: true, withFileTypes: true });
      const totalToProcess = entries.filter(e => e.isFile()).length;
      let processed = 0;

      for (const entry of entries) {
        if (entry.isDirectory()) continue;

        const fullPath = path.join(entry.parentPath || directory, entry.name);
        
        try {
          const stats = await fs.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase() || '(no ext)';
          const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

          // entire stats update
          this.stats.totalFiles++;
          this.stats.totalSize += stats.size;

          // grouping by type
          const typeData = this.stats.byType.get(ext) || { count: 0, size: 0 };
          typeData.count++;
          typeData.size += stats.size;
          this.stats.byType.set(ext, typeData);

          // grouping by age
          if (ageInDays <= 7) this.stats.ageGroups.last7++;
          if (ageInDays <= 30) this.stats.ageGroups.last30++;
          if (ageInDays > 90) this.stats.ageGroups.older90++;

          // save for sorting
          this.stats.allFiles.push({
            name: entry.name,
            size: stats.size,
            mtime: stats.mtime,
            ageInDays: Math.floor(ageInDays)
          });

          processed++;
          this.emit('file-found', { 
            current: processed, 
            total: totalToProcess, 
            file: entry.name 
          });

        } catch (err) {
          this.emit('error', new Error(`Could not stat ${entry.name}: ${err.message}`));
        }
      }

      this.emit('scan-complete', this._finalizeStats());
    } catch (error) {
      this.emit('error', error);
    }
  }

  _finalizeStats() {
    // 3 most largest files
    const largest = [...this.stats.allFiles]
      .sort((a, b) => b.size - a.size)
      .slice(0, 3);

    // oldest
    const oldest = this.stats.allFiles.reduce((prev, curr) => 
      prev.mtime < curr.mtime ? prev : curr
    , this.stats.allFiles[0]);

    return {
      totalFiles: this.stats.totalFiles,
      totalSize: this.stats.totalSize,
      byType: this.stats.byType,
      ageGroups: this.stats.ageGroups,
      largest,
      oldest
    };
  }
}

export default Scanner;