# 📂 File Organizer CLI

A high-performance command-line tool built with **Node.js** to rescue your `Downloads` folder from total chaos. It analyzes directory contents, identifies duplicates using SHA-256 hashing, categorizes files into logical folders, and cleans up old data.

This project demonstrates professional Node.js concepts: **Streams** for memory efficiency, **EventEmitter** for real-time progress tracking, and **ES Modules** for modern architecture.

---

## 🚀 Key Features

* **Recursive Scanning**: Deep-dive into any directory to get full stats on file types, total size, and file age.
* **Duplicate Detection**: Finds identical files by their content (SHA-256) even if they have different names.
* **Smart Organization**: Automatically sorts files into `Documents`, `Images`, `Archives`, `Code`, `Videos`, and `Other`.
* **Safe Cleanup**: Identifies files older than X days with a "Dry Run" mode to prevent accidental deletion.
* **Stream Processing**: Uses `fs.createReadStream` and `pipeline` for large files (≥10 MB) to maintain a low memory footprint.

---

## 🛠 Installation

1.  **Clone the repository**:
    ```bash
    git clone [https://github.com/your-username/file-organizer.git](https://github.com/your-username/file-organizer.git)
    cd file-organizer
    ```

2.  **Ensure Node.js is installed** (v18.0.0 or higher recommended).

3.  **Check scripts in package.json**:
    The project uses native Node.js modules, so no external dependencies are strictly required unless you choose to add a CLI parser like `commander`.

---

## 📖 Usage

Commands are executed via `npm run <command> -- <arguments>`.

### 1. Scan Directory
Analyze the state of a directory and see top-3 largest files.
```bash
npm run scan -- "C:\Users\Name\Downloads"
```

### 2. Find Duplicates
Find identical files and calculate wasted disk space.
```bash
npm run duplicates -- "C:\Users\Name\Downloads"
```

### 3. Organize Files
Copy and sort files into categories. Original files are preserved.
```bash
npm run organize -- "C:\Users\Name\Downloads" --output "D:\Organized"
```

### 4. Cleanup Old Files
Preview files older than 90 days (Dry Run):
```bash
npm run cleanup -- "C:\Users\Name\Downloads" --older-than 90
```
To actually delete files, add the `--confirm` flag:
```bash
npm run cleanup -- "C:\Users\Name\Downloads" --older-than 90 --confirm
```

---

## 🏗 Project Structure

```text
file-organizer/
├── lib/
│   ├── scanner.js         # Core logic for recursive scanning
│   ├── duplicates.js      # SHA-256 hashing via Streams
│   ├── organizer.js       # Categorization & safe copying logic
│   ├── cleanup.js         # Age-based filtering & deletion
│   └── utils.js           # Shared helpers (formatting, categories)
├── file-organizer.js      # Main CLI entry point & EventEmitter handling
└── package.json           # Project metadata & NPM scripts
```

---

## ⚙️ Technical Highlights

* **Memory Management**: By using Node.js **Streams**, the app can process multi-gigabyte files without exceeding 50-100MB of RAM.
* **Non-blocking I/O**: Leverages `fs/promises` for asynchronous file operations.
* **Progress Visualization**: Custom progress bars built using the `EventEmitter` pattern to decouple business logic from the UI.
* **Collision Handling**: When organizing, if a filename already exists in the target folder, the tool automatically appends an index: `file(1).pdf`, `file(2).pdf`, etc.

