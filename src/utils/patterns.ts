// Generates robust SVG data URIs for different planner templates 
// Uses flattened strings and hex colors for maximum browser compatibility

function encodeSVG(svg: string) {
  return `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;
}

// Simple helper to convert our common rgba to hex for better SVG engine support
function getHexColor(rgba: string): string {
  if (rgba.includes('255,255,255')) return '#ffffff';
  if (rgba === '#ffffff') return '#ffffff';
  return '#000000';
}

export const patterns = {
  getDaily: (date: Date = new Date(), color: string = 'rgba(0,0,0,0.6)') => {
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

    const dateStr = `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    const dayName = dayNames[date.getDay()];

    const hex = getHexColor(color);

    return encodeSVG(`
    <svg width="800" height="1130" viewBox="0 0 800 1130" xmlns="http://www.w3.org/2000/svg">
      <style>
        .text { font-family: -apple-system, sans-serif; fill: ${hex}; fill-opacity: 0.8; }
        .line { stroke: ${hex}; stroke-opacity: 0.4; stroke-width: 2; }
        .box { fill: none; stroke: ${hex}; stroke-opacity: 0.4; stroke-width: 2; rx: 8; }
        .title { font-size: 32px; font-weight: bold; fill: ${hex}; }
        .subtitle { font-size: 18px; font-weight: 600; fill: ${hex}; }
        .date-text { font-size: 22px; font-weight: bold; fill: #007aff; }
        .time { font-size: 14px; fill: ${hex}; fill-opacity: 0.6; }
      </style>
      <text x="50" y="80" class="title">GÜNLÜK PLAN</text>
      <text x="400" y="80" class="date-text">${dateStr}, ${dayName}</text>
      <text x="50" y="140" class="subtitle">Program</text>
      <rect x="50" y="160" width="300" height="900" class="box" />
      ${Array.from({ length: 15 }).map((_, i) => `
        <text x="70" y="${195 + i * 60}" class="text time">${(i + 7).toString().padStart(2, '0')}:00</text>
        <line x1="120" y1="${190 + i * 60}" x2="330" y2="${190 + i * 60}" class="line" stroke-dasharray="4" />
      `).join('')}
      <text x="400" y="140" class="subtitle">Yapılacaklar (Hedefler)</text>
      <rect x="400" y="160" width="350" height="400" class="box" />
      ${Array.from({ length: 10 }).map((_, i) => `
        <circle cx="430" cy="${195 + i * 38}" r="8" class="box" />
        <line x1="450" y1="${200 + i * 38}" x2="730" y2="${200 + i * 38}" class="line" />
      `).join('')}
      <text x="400" y="600" class="subtitle">Notlar & Fikirler</text>
      <rect x="400" y="620" width="350" height="440" class="box" />
      ${Array.from({ length: 10 }).map((_, i) => `
        <line x1="420" y1="${660 + i * 40}" x2="730" y2="${660 + i * 40}" class="line" />
      `).join('')}
    </svg>
    `);
  },

  getWeekly: (color: string) => {
    const hex = getHexColor(color);

    return encodeSVG(`
    <svg width="1200" height="900" viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg">
      <style>
        .text { font-family: -apple-system, sans-serif; fill: ${hex}; fill-opacity: 0.7; }
        .line { stroke: ${hex}; stroke-opacity: 0.2; stroke-width: 2; }
        .box { fill: none; stroke: ${hex}; stroke-opacity: 0.2; stroke-width: 2; rx: 10; }
        .title { font-size: 36px; font-weight: bold; fill: ${hex}; fill-opacity: 0.9; }
        .day-title { font-size: 20px; font-weight: 600; fill: ${hex}; fill-opacity: 0.7; }
        .notes-title { font-size: 18px; font-weight: 600; fill: ${hex}; fill-opacity: 0.7; }
      </style>
      <text x="50" y="70" class="title">HAFTALIK PLAN</text>
      <text x="950" y="70" class="day-title">Hafta: ___ / 52</text>
      ${['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((day, i) => {
      const x = 50 + (i % 4) * 280;
      const y = 110 + Math.floor(i / 4) * 380;
      return `
          <rect x="${x}" y="${y}" width="260" height="350" class="box" />
          <text x="${x + 20}" y="${y + 35}" class="day-title">${day}</text>
          <line x1="${x + 20}" y1="${y + 50}" x2="${x + 240}" y2="${y + 50}" class="line" />
          ${Array.from({ length: 7 }).map((_, l) => `<line x1="${x + 20}" y1="${y + 90 + l * 35}" x2="${x + 240}" y2="${y + 90 + l * 35}" class="line" stroke-dasharray="4" />`).join('')}
        `;
    }).join('')}
      <rect x="890" y="490" width="260" height="350" class="box" />
      <text x="910" y="525" class="notes-title">Önemli Notlar</text>
      <line x1="910" y1="540" x2="1130" y2="540" class="line" />
      ${Array.from({ length: 6 }).map((_, l) => `<line x1="910" y1="${580 + l * 40}" x2="1130" y2="${580 + l * 40}" class="line" stroke-dasharray="2" />`).join('')}
    </svg>
    `);
  },

  getMonthly: (color: string) => {
    const hex = getHexColor(color);
    const alpha = hex === '#ffffff' ? 0.3 : 0.2;
    const textAlpha = hex === '#ffffff' ? 0.7 : 0.6;

    return encodeSVG(`
    <svg width="1200" height="900" viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg">
      <style>
        .text { font-family: -apple-system, sans-serif; fill: ${hex}; fill-opacity: ${textAlpha}; }
        .line { stroke: ${hex}; stroke-opacity: ${alpha}; stroke-width: 2; }
        .box { fill: none; stroke: ${hex}; stroke-opacity: ${alpha}; stroke-width: 2; rx: 8; }
        .title { font-size: 36px; font-weight: bold; fill: ${hex}; fill-opacity: ${textAlpha + 0.2}; }
        .day { font-size: 16px; font-weight: 600; text-anchor: middle; fill: ${hex}; fill-opacity: ${textAlpha}; }
      </style>
      <text x="50" y="80" class="title">AYLIK PLAN</text>
      <text x="1000" y="80" class="title" style="font-size: 24px;">Ay: _________</text>
      <rect x="50" y="130" width="1100" height="720" class="box" />
      ${['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((day, i) => `
        <text x="${128 + i * 157}" y="160" class="day">${day}</text>
        ${i > 0 ? `<line x1="${50 + i * 157}" y1="130" x2="${50 + i * 157}" y2="850" class="line" />` : ''}
      `).join('')}
      ${[1, 2, 3, 4, 5].map(i => `
        <line x1="50" y1="${130 + i * 120}" x2="1150" y2="${130 + i * 120}" class="line" />
      `).join('')}
    </svg>
    `);
  },

  getYearly: (color: string) => {
    const hex = getHexColor(color);
    const alpha = hex === '#ffffff' ? 0.3 : 0.2;
    const textAlpha = hex === '#ffffff' ? 0.7 : 0.6;

    return encodeSVG(`
    <svg width="1200" height="900" viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg">
      <style>
        .text { font-family: -apple-system, sans-serif; fill: ${hex}; fill-opacity: ${textAlpha}; }
        .line { stroke: ${hex}; stroke-opacity: ${alpha}; stroke-width: 2; }
        .box { fill: none; stroke: ${hex}; stroke-opacity: ${alpha}; stroke-width: 2; rx: 12; }
        .title { font-size: 36px; font-weight: bold; fill: ${hex}; fill-opacity: ${textAlpha + 0.2}; }
        .month { font-size: 20px; font-weight: 600; text-anchor: middle; fill: ${hex}; fill-opacity: ${textAlpha}; }
      </style>
      <text x="50" y="80" class="title">YILLIK PLAN</text>
      <text x="1050" y="80" class="title" style="font-size: 28px;">20__</text>
      ${['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'].map((month, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 50 + col * 280;
      const y = 130 + row * 250;
      return `
          <rect x="${x}" y="${y}" width="260" height="230" class="box" />
          <text x="${x + 130}" y="${y + 35}" class="month">${month}</text>
          <line x1="${x + 20}" y1="${y + 50}" x2="${x + 240}" y2="${y + 50}" class="line" />
          ${[1, 2, 3, 4].map(l => `<line x1="${x + 20}" y1="${y + 50 + l * 35}" x2="${x + 240}" y2="${y + 50 + l * 35}" class="line" stroke-dasharray="4" />`).join('')}
        `;
    }).join('')}
    </svg>
    `);
  }
};
