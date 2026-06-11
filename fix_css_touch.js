const fs = require('fs');
let css = fs.readFileSync('c:/Users/pc/dev/al-quran/warsh-muthamma-assets/viewer/index.css', 'utf8');
css += `\n\n/* Add touch-action none for tablet dragging */\n#overlay-container, .highlight-box, .marker-box, .box-resize-handle, .box-toolbar button {\n    touch-action: none;\n}\n`;
fs.writeFileSync('c:/Users/pc/dev/al-quran/warsh-muthamma-assets/viewer/index.css', css, 'utf8');
console.log('Added touch-action: none');
