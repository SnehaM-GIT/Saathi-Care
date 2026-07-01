const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const imgDir = path.join(__dirname, 'public', 'images');

const filesToUpdate = [
  path.join(__dirname, 'public', 'index.html'),
  path.join(__dirname, 'public', 'js', 'app.js'),
  path.join(__dirname, 'public', 'css', 'style.css')
];

async function processImages() {
  const files = fs.readdirSync(imgDir);
  const renames = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      const oldPath = path.join(imgDir, file);
      const newName = file.substring(0, file.lastIndexOf('.')) + '.webp';
      const newPath = path.join(imgDir, newName);

      try {
        console.log(`Compressing ${file} to ${newName}...`);
        await sharp(oldPath)
          .webp({ quality: 80, effort: 6 })
          .toFile(newPath);
        
        fs.unlinkSync(oldPath);
        renames.push({ old: file, new: newName });
        console.log(`Successfully compressed and removed original: ${file}`);
      } catch (err) {
        console.error(`Failed to process ${file}:`, err);
      }
    }
  }

  console.log('Finished image compression. Updating code references...');

  // Update references in code
  for (const filePath of filesToUpdate) {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let changed = false;
      for (const rename of renames) {
        // Simple string replace. We use split/join for replaceAll
        if (content.includes(rename.old)) {
          content = content.split(rename.old).join(rename.new);
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated references in ${path.basename(filePath)}`);
      }
    }
  }

  console.log('All done! Images are compressed and code is updated.');
}

processImages().catch(console.error);
