const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType, ThematicBreak, SectionType } = require('docx');

// Targeted important files and directories
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss'];
const TARGETS = [
    'proxy.js',
    'lib/embeddings.js',
    'lib/pdfProcessor.js',
    'lib/supabase/proxy.js',
    'lib/supabase/server.js',
    'app/api/chat',
    'app/api/getPlaylistVideos',
    'components/Dashboard.jsx',
    'components/SubjectForm.jsx',
    'components/subject/AIChatTab.jsx',
    'components/subject/StudyVideosTab.jsx',
];

async function generateDoc() {
    const children = [];

    function processFile(fullPath) {
        if (!fs.existsSync(fullPath)) {
            console.warn(`File not found: ${fullPath}`);
            return;
        }
        
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            const files = fs.readdirSync(fullPath);
            files.forEach(file => processFile(path.join(fullPath, file)));
            return;
        }

        if (!EXTENSIONS.includes(path.extname(fullPath))) return;

        const content = fs.readFileSync(fullPath, 'utf8');
        const relativePath = "./" + path.relative(process.cwd(), fullPath);
        
        console.log(`Processing: ${relativePath}`);

        // 1. File Location (Right Aligned, Gray, Times New Roman)
        children.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
                new TextRun({
                    text: relativePath,
                    font: "Times New Roman",
                    size: 18, // 9pt
                    color: "666666",
                }),
            ],
            spacing: { before: 240, after: 60 },
        }));

        // 2. Horizontal Line
        children.push(new Paragraph({
            children: [new ThematicBreak()],
            spacing: { after: 120 },
        }));

        // 3. Code Content (Times New Roman, 9pt)
        const codeLines = content.split('\n');
        codeLines.forEach(line => {
            const formattedLine = line.replace(/\t/g, '    ');
            
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: formattedLine,
                        font: "Times New Roman",
                        size: 18, // 9pt
                    }),
                ],
                spacing: { before: 0, after: 0 },
            }));
        });
    }

    TARGETS.forEach(target => processFile(path.join(process.cwd(), target)));

    const doc = new Document({
        sections: [{
            properties: {
                column: {
                    count: 2,
                    separate: true, // Optional: adds a vertical line between columns
                    space: 708,     // Standard 0.5 inch spacing between columns
                },
            },
            children: children,
        }],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync("Project_Columns_9pt.docx", buffer);
    console.log("✔ Two-column Times New Roman document created!");
}

generateDoc().catch(err => console.error(err));