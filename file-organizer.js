import path from 'path';
import { formatSize, drawProgressBar, CATEGORIES } from './lib/utils.js';
import Scanner from './lib/scanner.js';
import DuplicateFinder from './lib/duplicates.js';
import Organizer from './lib/organizer.js';
import Cleaner from './lib/cleanup.js';

const [,, command, targetPath, ...flags] = process.argv;

const die = (message) => {
  console.error(`❌ ${message}`);
  process.exit(1);
};

if (!command || !targetPath) {
  die('Usage: node file-organizer.js <command> <path> [flags]\nCommands: scan, duplicates, organize, cleanup');
}

const absolutePath = targetPath;

async function main() {
  try {
    switch (command) {
      case 'scan':
        await handleScan(absolutePath);
        break;
      case 'duplicates':
        await handleDuplicates(absolutePath);
        break;
      case 'organize':
        const outputIdx = flags.indexOf('--output');
        const outputPath = outputIdx !== -1 ? flags[outputIdx + 1] : null;
        if (!outputPath) die('Please specify --output /path/to/target');
        await handleOrganize(absolutePath, path.resolve(outputPath));
        break;
      case 'cleanup':
        const olderIdx = flags.indexOf('--older-than');
        const days = olderIdx !== -1 ? parseInt(flags[olderIdx + 1]) : 90;
        const confirm = flags.includes('--confirm');
        await handleCleanup(absolutePath, days, confirm);
        break;
      default:
        die(`Unknown command: ${command}`);
    }
  } catch (err) {
    die(`Unexpected error: ${err.message}`);
  }
}

async function handleScan(dir) {
  const scanner = new Scanner();
  
  scanner.on('scan-start', (data) => console.log(`\n📂 Scanning: ${data.directory}\nProcessing...`));
  
  scanner.on('file-found', (data) => {
    process.stdout.write(`\r${drawProgressBar(data.current, data.total)}`);
  });

  scanner.on('scan-complete', (s) => {
    console.log(`\n\n📊 Scan Results:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total files: ${s.totalFiles}\nTotal size: ${formatSize(s.totalSize)}\n`);
    
    console.log(`By File Type:`);
    for (const [ext, data] of s.byType) {
      console.log(`  ${ext.padEnd(8)} ${data.count} files   ${formatSize(data.size)}`);
    }

    console.log(`\nFile Age:`);
    console.log(`  Last 7 days:    ${s.ageGroups.last7} files`);
    console.log(`  Last 30 days:   ${s.ageGroups.last30} files`);
    console.log(`  Older than 90:  ${s.ageGroups.older90} files`);

    console.log(`\nLargest files:`);
    s.largest.forEach((f, i) => console.log(`  ${i+1}. ${f.name.padEnd(20)} ${formatSize(f.size)}`));
    
    if (s.oldest) {
      console.log(`\nOldest file: ${s.oldest.name} (modified ${s.oldest.ageInDays} days ago)`);
    }
  });

  await scanner.scan(dir);
}

async function handleDuplicates(dir) {
  const finder = new DuplicateFinder();
  
  finder.on('search-start', (data) => console.log(`\n🔍 Searching for duplicates in: ${data.directory}\nCalculating hashes...`));
  finder.on('file-processed', (data) => {
    process.stdout.write(`\r${drawProgressBar(data.current, data.total)}`);
  });

  finder.on('duplicates-found', (res) => {
    console.log(`\n\nFound ${res.groups.length} duplicate groups (${formatSize(res.totalWastedSpace)} wasted):`);
    res.groups.forEach((g, i) => {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Group ${i+1} (${g.paths.length} copies, ${formatSize(g.size)} each):`);
      console.log(`  SHA-256: ${g.hash.substring(0, 12)}...`);
      g.paths.forEach(p => console.log(`  📄 ${path.relative(dir, p)}`));
      console.log(`  Wasted space: ${formatSize(g.wasted)}`);
    });
    console.log(`\n💾 Total wasted space: ${formatSize(res.totalWastedSpace)}`);
  });

  await finder.find(dir);
}

async function handleOrganize(source, target) {
  const organizer = new Organizer();
  
  console.log(`\n📦 Organizing: ${source}\nTarget: ${target}\n`);
  
  organizer.on('copy-complete', (data) => {
    process.stdout.write(`\rCopying files... ${drawProgressBar(data.current, data.total)}`);
  });

  organizer.on('organize-complete', (s) => {
    console.log(`\n\n✅ Organization complete!\nSummary:`);
    for (const [cat, count] of s.moved) {
      console.log(`  ${cat.padEnd(10)}: ${count} files → Organized/${cat}/`);
    }
    console.log(`\nTotal copied: ${s.totalCopied} files (${formatSize(s.totalSize)})`);
  });

  await organizer.organize(source, target);
}

async function handleCleanup(dir, threshold, confirm) {
  const cleaner = new Cleaner();
  
  console.log(`\n🧹 Cleanup: ${dir}\nLooking for files older than ${threshold} days...`);

  cleaner.on('cleanup-complete', (s) => {
    console.log(`\nFound ${s.found} files to delete:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    s.files.forEach(f => {
      console.log(`${f.name}\n  Size: ${formatSize(f.size)}\n  Modified: ${f.daysOld} days ago\n`);
    });

    if (s.isDryRun) {
      console.log(`⚠️  DRY RUN MODE: No files were deleted.`);
      console.log(`To actually delete these files, run with --confirm flag.`);
    } else {
      console.log(`✅ Cleanup complete! Deleted: ${s.deleted} files (${formatSize(s.totalSize)} freed)`);
    }
  });

  await cleaner.cleanup(dir, threshold, confirm);
}

main();