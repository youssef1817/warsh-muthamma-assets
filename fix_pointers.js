const fs = require('fs');
let content = fs.readFileSync('c:/Users/pc/dev/al-quran/warsh-muthamma-assets/viewer/app.js', 'utf8');
content = content.replace(/mousedown/g, 'pointerdown');
content = content.replace(/mousemove/g, 'pointermove');
content = content.replace(/mouseup/g, 'pointerup');
fs.writeFileSync('c:/Users/pc/dev/al-quran/warsh-muthamma-assets/viewer/app.js', content, 'utf8');
console.log('Replaced all mouse events with pointer events.');
