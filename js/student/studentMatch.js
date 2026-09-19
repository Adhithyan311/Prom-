import { costumeSets } from '../config/constants.js';
import { Storage } from '../storage/storage.js';
import { norm } from '../matching/matchUtils.js';

export function renderCostumeArea(candidateObj, setConfig, tagText, roleType) {
  const setId = setConfig.id;
  const setName = setConfig.name;

  let isBoy = true;
  if (roleType === 'girl' || roleType === 'female' || (candidateObj && candidateObj.gender && candidateObj.gender.toLowerCase() === 'female')) {
    isBoy = false;
  }

  const imgSrc = isBoy ? setConfig.boyImage : setConfig.girlImage;
  const imgAlt = `${setName} - ${isBoy ? 'Boy' : 'Girl'} Look`;

  return `
    <img src="${imgSrc}" alt="${imgAlt}" class="costume-img-single" onerror="this.parentElement.outerHTML='<div class=\\'costume-fallback\\'><b>PROM NIGHT LOOK</b><br>SET 0${setId} - ${setName}<br><span style=\\'font-size:11px;opacity:0.7;\\'>Reference unavailable</span></div>'">
  `;
}

export function getCostumeLook(cand) {
  const genre = norm(cand.favoriteGenre);
  const movie = norm(cand.favoriteMovie);

  if (genre.includes("romance") || movie.includes("thattathin") || movie.includes("titanic")) {
    return {
      him: "Classic black tuxedo &bull; White dress shirt &bull; Satin bow tie &bull; Polished oxford shoes &bull; Minimal gold pocket accent",
      her: "Romantic floor-length gown &bull; Warm burgundy / champagne palette &bull; Pearl necklace &bull; Strappy heels &bull; Silk clutch"
    };
  } else if (genre.includes("musical") || genre.includes("comedy") || movie.includes("jawaani")) {
    return {
      him: "Velvet dinner jacket &bull; Crisp white shirt &bull; Dark tailored trousers &bull; Leather loafers &bull; Statement pocket square",
      her: "Vibrant cocktail dress &bull; Shimmering metallic accessories &bull; Bold lipstick &bull; Elegant dancing heels &bull; Fine bracelet"
    };
  } else if (genre.includes("sci-fi") || genre.includes("thriller") || genre.includes("action") || movie.includes("name")) {
    return {
      him: "Sleek midnight navy suit &bull; Dark fitted shirt &bull; Narrow black tie &bull; Matte black dress shoes &bull; Classic timepiece",
      her: "Sleek monochrome evening gown &bull; Silver geometric jewelry &bull; Dark evening wrap &bull; Stiletto heels &bull; Satin clutch"
    };
  } else {
    return {
      him: "Classic formal suit &bull; White shirt &bull; Black or burgundy tie &bull; Polished black shoes &bull; Minimal gold cuff accent",
      her: "Elegant evening dress &bull; Soft neutral / burgundy / champagne palette &bull; Minimal jewelry &bull; Elegant heels or flats"
    };
  }
}

export function downloadTicketPass(userObj, partnerObj, match) {
  const session = Storage.getSession();
  const candidates = Storage.getCandidates();
  const matches = Storage.getMatches();

  if (!userObj && session && session.role === "candidate") {
    userObj = candidates.find(c => c.id === session.id);
  }

  if (userObj && (!match || !partnerObj)) {
    match = matches.find(m => m.candidateAId === userObj.id || m.candidateBId === userObj.id);
    if (match) {
      const isUserCandA = match.candidateAId === userObj.id;
      userObj = userObj || (isUserCandA ? match.candidateA : match.candidateB);
      partnerObj = partnerObj || (isUserCandA ? match.candidateB : match.candidateA);
    }
  }

  const safeUser = userObj || {
    id: (session && session.id) ? session.id : "PL-001",
    name: "Cineaste",
    department: "CSE S7",
    favoriteMovie: "Thattathin Marayathu",
    favoriteGenre: "Romance",
    favoriteMusic: "Malare — Vijay Yesudas",
    instagram: "username"
  };

  const safePartner = partnerObj || {
    id: "PL-002",
    name: "Prom Partner",
    department: "ECE S5",
    favoriteMovie: "Titanic",
    favoriteGenre: "Romance",
    favoriteMusic: "Soundtrack",
    instagram: "username"
  };

  const safeMatch = match || {
    id: "MATCH-100200",
    serial: `MATCH-315911-${safeUser.id}`,
    affinityScore: 88
  };

  const btn = document.getElementById("btnDownloadTicket");
  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = "GENERATING TICKET...";
  }

  const serialCode = safeMatch.serial || `MATCH-315911-${safeUser.id}`;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 650;
    const ctx = canvas.getContext("2d");

    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";
    logoImg.src = "assets/pelicula-logo.jpg";

    let executed = false;
    const triggerRender = () => {
      if (executed) return;
      executed = true;
      try {
        renderCanvasTicket(ctx, canvas, safeUser, safePartner, safeMatch, serialCode, logoImg, btn);
      } catch (err) {
        console.error("Canvas Ticket Render Error, falling back:", err);
        renderFallbackCanvasTicket(ctx, canvas, safeUser, safePartner, safeMatch, serialCode, btn);
      }
    };

    logoImg.onload = triggerRender;
    logoImg.onerror = triggerRender;

    setTimeout(triggerRender, 1500);
  } catch (err) {
    console.error("Ticket Download System Error:", err);
    if (btn) {
      btn.textContent = "TICKET DOWNLOAD FAILED";
      setTimeout(() => {
        btn.textContent = btn.dataset.originalText || "🎟 Download Ticket Pass";
        btn.disabled = false;
      }, 3000);
    }
  }
}

export function renderCanvasTicket(ctx, canvas, userObj, partnerObj, match, serialCode, logoImg, btn) {
  // 1. Dark Void Outer Frame (#1B1210)
  ctx.fillStyle = "#1B1210";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#D9A94C";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // 2. Main Ticket Paper Body (#F2E8D3)
  const tx = 40, ty = 40, tw = 1520, th = 570;
  ctx.fillStyle = "#F2E8D3";
  ctx.fillRect(tx, ty, tw, th);

  // Vertical Perforation Line at X = 1160
  const perfX = 1160;
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = "#9C8B72";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(perfX, ty);
  ctx.lineTo(perfX, ty + th);
  ctx.stroke();
  ctx.setLineDash([]);

  // Top & Bottom Notch Cutouts
  ctx.fillStyle = "#1B1210";
  ctx.beginPath();
  ctx.arc(perfX, ty, 18, 0, Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(perfX, ty + th, 18, Math.PI, 0);
  ctx.fill();

  // 3. MAIN TICKET HEADER (Left)
  const logoBoxX = 80, logoBoxY = 70, logoBoxSize = 64;
  ctx.fillStyle = "#241713";
  ctx.fillRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize);
  ctx.strokeStyle = "#D9A94C";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize);

  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const pad = 6;
    ctx.drawImage(logoImg, logoBoxX + pad, logoBoxY + pad, logoBoxSize - pad * 2, logoBoxSize - pad * 2);
  }

  ctx.fillStyle = "#2B1F16";
  ctx.font = 'bold 34px "Playfair Display", Georgia, serif';
  ctx.fillText("Película", 160, 108);

  ctx.fillStyle = "#7A6A54";
  ctx.font = 'bold 12px "Inter", sans-serif';
  ctx.fillText("PELÍCULA  ·  PROM NIGHT DOUBLE PASS", 160, 128);

  // Top Right Header Badge
  ctx.fillStyle = "#6E2A3B";
  ctx.fillRect(760, 78, 360, 36);
  ctx.fillStyle = "#FBF6EA";
  ctx.font = 'bold 12px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("ADMIT TWO  ·  PROM NIGHT SELECTION", 940, 101);
  ctx.textAlign = "left";

  // Hairline Divider 1
  ctx.strokeStyle = "rgba(217, 169, 76, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 160);
  ctx.lineTo(1120, 160);
  ctx.stroke();

  // 4. CINEASTES & PAIRING SECTION
  ctx.fillStyle = "#7A6A54";
  ctx.font = 'bold 11px "Inter", sans-serif';
  ctx.fillText(`CANISTER A  ·  FIRST SEAT (${userObj.id})`, 80, 195);

  ctx.fillStyle = "#6E2A3B";
  ctx.font = 'italic bold 30px "Playfair Display", Georgia, serif';
  ctx.fillText(userObj.name, 80, 230);

  ctx.fillStyle = "#2B1F16";
  ctx.font = 'bold 14px "Inter", sans-serif';
  ctx.fillText(`Dept: ${userObj.department}`, 80, 255);

  ctx.fillStyle = "#4A3A2C";
  ctx.font = '13px "Inter", sans-serif';
  ctx.fillText(`Movie: "${userObj.favoriteMovie || userObj.cinematicAffinity}"`, 80, 278);
  ctx.fillText(`Music: ${userObj.favoriteMusic || 'Malare'}  |  Instagram: @${userObj.instagram || userObj.handle}`, 80, 298);

  // Harmony Pill
  ctx.fillStyle = "#D9A94C";
  ctx.fillRect(520, 238, 140, 30);
  ctx.fillStyle = "#2B1F16";
  ctx.font = 'bold 12px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(`✦ ${match.affinityScore}% HARMONY`, 590, 258);
  ctx.textAlign = "left";

  // Candidate B (Matched Partner)
  ctx.fillStyle = "#7A6A54";
  ctx.font = 'bold 11px "Inter", sans-serif';
  ctx.fillText(`CANISTER B  ·  MATCHED CINEASTE (${partnerObj.id})`, 700, 195);

  ctx.fillStyle = "#6E2A3B";
  ctx.font = 'italic bold 30px "Playfair Display", Georgia, serif';
  ctx.fillText(partnerObj.name, 700, 230);

  ctx.fillStyle = "#2B1F16";
  ctx.font = 'bold 14px "Inter", sans-serif';
  ctx.fillText(`Dept: ${partnerObj.department}`, 700, 255);

  ctx.fillStyle = "#4A3A2C";
  ctx.font = '13px "Inter", sans-serif';
  ctx.fillText(`Movie: "${partnerObj.favoriteMovie || partnerObj.cinematicAffinity}"`, 700, 278);
  ctx.fillText(`Music: ${partnerObj.favoriteMusic || 'Soundtrack'}  |  Instagram: @${partnerObj.instagram || partnerObj.handle}`, 700, 298);

  // Hairline Divider 2
  ctx.strokeStyle = "rgba(217, 169, 76, 0.4)";
  ctx.beginPath();
  ctx.moveTo(80, 335);
  ctx.lineTo(1120, 335);
  ctx.stroke();

  // 5. EVENT METADATA GRID
  const drawMetaCol = (x, label, val) => {
    ctx.fillStyle = "#7A6A54";
    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.fillText(label, x, 370);
    ctx.fillStyle = "#2B1F16";
    ctx.font = 'bold 16px "Playfair Display", Georgia, serif';
    ctx.fillText(val, x, 395);
  };

  drawMetaCol(80, "MAIN EVENT", "WELCOME TO THE PROM NIGHT");
  drawMetaCol(420, "ASSIGNED SEATING", "Row C  ·  Seats 11 & 12");
  drawMetaCol(700, "DATE & TIME", "25 Sept 2026  ·  7:30–9:30 PM");
  drawMetaCol(930, "VENUE", "Festival Lawn Gala");

  // Hairline Divider 3
  ctx.strokeStyle = "rgba(217, 169, 76, 0.4)";
  ctx.beginPath();
  ctx.moveTo(80, 435);
  ctx.lineTo(1120, 435);
  ctx.stroke();

  // Bottom Notice
  ctx.fillStyle = "#7A6A54";
  ctx.font = '12px "Inter", sans-serif';
  ctx.fillText("🔒 CONFIDENTIAL PROM PASS  ·  Mutual Instagram handles unlock at Lawn Gala upon gala attendance verification.", 80, 480);

  // 6. RIGHT TICKET STUB (X = 1190 to 1520)
  ctx.fillStyle = "#7A6A54";
  ctx.font = 'bold 11px "Inter", sans-serif';
  ctx.fillText("ADMIT TWO PASS", 1200, 85);

  ctx.fillStyle = "#6E2A3B";
  ctx.font = 'italic bold 22px "Playfair Display", Georgia, serif';
  ctx.fillText("Película Prom Night", 1200, 115);

  ctx.fillStyle = "#2B1F16";
  ctx.font = 'bold 13px "Inter", sans-serif';
  ctx.fillText(`SERIAL: #${serialCode}`, 1200, 145);

  // Validated Badge
  ctx.fillStyle = "#2F6B3F";
  ctx.fillRect(1200, 165, 110, 26);
  ctx.fillStyle = "#EAFFF0";
  ctx.font = 'bold 11px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("VALIDATED", 1255, 182);
  ctx.textAlign = "left";

  // QR Code Payload
  const qrPayload = JSON.stringify({
    festival: "Película · Prom Night",
    event: "Prom Night",
    ticket: serialCode,
    candidate: userObj.id,
    status: "validated"
  });

  drawQRCodeOnCanvas(ctx, qrPayload, 1200, 215, 220);

  ctx.fillStyle = "#7A6A54";
  ctx.font = 'bold 10px "Inter", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("SCAN AT PROM ENTRY", 1310, 465);
  ctx.textAlign = "left";

  executeDownloadBlob(canvas, `pelicula-prom-night-ticket-${userObj.id}.png`, btn);
}

export function renderFallbackCanvasTicket(ctx, canvas, userObj, partnerObj, match, serialCode, btn) {
  renderCanvasTicket(ctx, canvas, userObj, partnerObj, match, serialCode, null, btn);
}

export function executeDownloadBlob(canvas, filename, btn) {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (btn) {
      btn.textContent = "TICKET DOWNLOADED ✓";
      setTimeout(() => {
        btn.textContent = btn.dataset.originalText || "🎟 Download Ticket Pass";
        btn.disabled = false;
      }, 2500);
    }
  } catch (err) {
    console.error("Blob Download Error:", err);
    if (btn) {
      btn.textContent = "TICKET DOWNLOAD FAILED";
      setTimeout(() => {
        btn.textContent = btn.dataset.originalText || "🎟 Download Ticket Pass";
        btn.disabled = false;
      }, 3000);
    }
  }
}

export function drawQRCodeOnCanvas(ctx, text, x, y, size) {
  const n = 25;
  const cellSize = size / n;
  const grid = Array(n).fill(0).map(() => Array(n).fill(false));
  
  function drawFinder(r, c) {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          grid[r + i][c + j] = true;
        }
      }
    }
  }
  drawFinder(0, 0);
  drawFinder(0, n - 7);
  drawFinder(n - 7, 0);

  for (let i = 8; i < n - 8; i++) {
    if (i % 2 === 0) {
      grid[6][i] = true;
      grid[i][6] = true;
    }
  }

  const alignR = 18, alignC = 18;
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      if (Math.abs(i) === 2 || Math.abs(j) === 2 || (i === 0 && j === 0)) {
        grid[alignR + i][alignC + j] = true;
      }
    }
  }

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const inTL = r < 9 && c < 9;
      const inTR = r < 9 && c >= n - 8;
      const inBL = r >= n - 8 && c < 9;
      const inTiming = r === 6 || c === 6;
      const inAlign = Math.abs(r - alignR) <= 2 && Math.abs(c - alignC) <= 2;
      
      if (!inTL && !inTR && !inBL && !inTiming && !inAlign) {
        const bit = ((r * 31 + c * 17 + Math.abs(hash)) % 100) > 48;
        grid[r][c] = bit;
      }
    }
  }

  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r][c]) {
        ctx.fillRect(Math.round(x + c * cellSize), Math.round(y + r * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
      }
    }
  }
}
