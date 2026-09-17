const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

async function createZip(sourceDir, outputPath) {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

async function copyManifest(sourcePath, targetPath, version) {
    const manifest = await fs.readJson(sourcePath);
    await fs.writeJson(targetPath, { ...manifest, version }, { spaces: 4 });
}

async function build() {
    try {
        const { version } = await fs.readJson(path.join(__dirname, 'package.json'));

        // Clean dist directory
        await fs.emptyDir(path.join(__dirname, 'dist'));

        // Build Chrome version
        const chromeDir = path.join(__dirname, 'dist', 'chrome');
        await fs.ensureDir(chromeDir);

        // Copy Chrome-specific files
        await copyManifest(
            path.join(__dirname, 'src', 'chrome', 'manifest.json'),
            path.join(chromeDir, 'manifest.json'),
            version
        );
        await fs.copy(
            path.join(__dirname, 'src', 'chrome', 'service-worker.js'),
            path.join(chromeDir, 'service-worker.js')
        );

        // Build Firefox version
        const firefoxDir = path.join(__dirname, 'dist', 'firefox');
        await fs.ensureDir(firefoxDir);

        // Copy Firefox-specific files
        await copyManifest(
            path.join(__dirname, 'src', 'firefox', 'manifest.json'),
            path.join(firefoxDir, 'manifest.json'),
            version
        );
        await fs.copy(
            path.join(__dirname, 'src', 'firefox', 'background.js'),
            path.join(firefoxDir, 'background.js')
        );

        // Copy common files to both directories
        const commonFiles = ['index.js', 'index.html', 'hltv-logo.png'];
        for (const file of commonFiles) {
            await fs.copy(
                path.join(__dirname, 'src', 'common', file),
                path.join(chromeDir, file)
            );
            await fs.copy(
                path.join(__dirname, 'src', 'common', file),
                path.join(firefoxDir, file)
            );
        }

        // Create Firefox ZIP file
        await createZip(
            firefoxDir,
            path.join(__dirname, 'dist', 'firefox-extension.zip')
        );

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();
