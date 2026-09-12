// 画像プリロード
const preloadedImages = [];
window.addEventListener('load', () => {
    if(typeof ALL_TILE_TYPES !== 'undefined') {
        ALL_TILE_TYPES.forEach(tile => {
            const img = new Image();
            img.src = `idol_images/${tile}.png`;
            preloadedImages.push(img);
        });
    }
});

// モバイル用サイドバー切り替え
function toggleSidebar() {
    const sidebar = document.getElementById('progress-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

function layoutTable() {
    const board = document.getElementById('game-board');
    const center = document.getElementById('center-status');
    const app = document.getElementById('app-container');
    if (!board || !center || !app || app.style.display === 'none') return;
    if (board.offsetWidth < 40 || center.offsetWidth < 20) return;
    const br = board.getBoundingClientRect();
    const cr = center.getBoundingClientRect();
    const gap = Math.max(12, Math.min(br.width, br.height) * 0.018);
    let yOff = cr.height / 2 + gap;
    let xOff = cr.width / 2 + gap;
    const maxY = br.height * 0.34;
    const maxX = br.width * 0.34;
    const minY = Math.min(br.height * 0.18, 90);
    const minX = Math.min(br.width * 0.20, 100);
    yOff = Math.max(minY, Math.min(yOff, maxY));
    xOff = Math.max(minX, Math.min(xOff, maxX));
    board.style.setProperty('--river-y-offset', Math.round(yOff) + 'px');
    board.style.setProperty('--river-x-offset', Math.round(xOff) + 'px');
}

let useAlmForProgress = true;
function toggleAlmighty() {
    useAlmForProgress = !useAlmForProgress;
    let btn = document.getElementById('btn-toggle-alm');
    if (useAlmForProgress) {
        btn.innerText = 'ALM牌で予測: ON';
        btn.style.background = '#4caf50';
    } else {
        btn.innerText = 'ALM牌で予測: OFF';
        btn.style.background = '#9e9e9e';
    }
    updateProgressUI();
}

function logM(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.style.background = 'rgba(0,0,0,0.8)'; toast.style.color = 'white'; toast.style.padding = '8px 16px';
    toast.style.borderRadius = '20px'; toast.style.fontSize = '14px'; toast.style.transition = 'opacity 0.5s';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

function showCutin(text, color) {
    const cutinOverlay = document.getElementById('cutin-overlay'); 
    const cutinText = document.getElementById('cutin-text');
    cutinText.innerText = text; 
    cutinText.style.color = color; 
    cutinText.style.animation = 'none'; 
    cutinOverlay.style.display = 'flex';
    setTimeout(() => { cutinText.style.animation = 'popIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'; }, 10);
    setTimeout(() => { cutinOverlay.style.display = 'none'; }, 1200);
}

function showActionToast(text, type = 'turn') {
    const toast = document.getElementById('action-toast');
    toast.innerText = text;
    if (type === 'scout') {
        toast.style.background = 'linear-gradient(135deg, #ff9800, #ff5722)';
        toast.style.boxShadow = '0 4px 10px rgba(255, 152, 0, 0.5)';
    } else {
        toast.style.background = 'linear-gradient(135deg, #ff7bac, #e91e63)';
        toast.style.boxShadow = '0 4px 10px rgba(233, 30, 99, 0.5)';
    }
    toast.style.display = 'block';
    toast.classList.remove('show-action-toast');
    void toast.offsetWidth; 
    toast.classList.add('show-action-toast');
    setTimeout(() => { toast.style.display = 'none'; }, 1500);
}

function attrAlmightyFor(req) {
    const attr = (typeof IDOL_ATTR !== 'undefined' && IDOL_ATTR[req]) || (
        IDOLS.Princess.includes(req) ? 'Pr' : IDOLS.Fairy.includes(req) ? 'Fa' : IDOLS.Angel.includes(req) ? 'An' : null
    );
    return attr ? (attr + "ｵｰﾙﾏｲﾃｨ") : null;
}

function canPossiblyExtract(hand, required) {
    const pool = {};
    for (let i = 0; i < hand.length; i++) pool[hand[i]] = (pool[hand[i]] || 0) + 1;
    let needPr = 0, needFa = 0, needAn = 0;
    for (let i = 0; i < required.length; i++) {
        const req = required[i];
        if (pool[req] > 0) { pool[req]--; continue; }
        const attr = (typeof IDOL_ATTR !== 'undefined' && IDOL_ATTR[req]) || null;
        if (attr === 'Pr') needPr++;
        else if (attr === 'Fa') needFa++;
        else if (attr === 'An') needAn++;
        else return false;
    }
    const use = (need, key) => {
        const have = pool[key] || 0;
        const u = Math.min(need, have);
        pool[key] = have - u;
        return need - u;
    };
    needPr = use(needPr, "Prｵｰﾙﾏｲﾃｨ");
    needFa = use(needFa, "Faｵｰﾙﾏｲﾃｨ");
    needAn = use(needAn, "Anｵｰﾙﾏｲﾃｨ");
    return (needPr + needFa + needAn) <= (pool["P（ｼﾞｮｰｶｰ）"] || 0);
}

function scoreHand(units, hand, openTiles, agariTile, isClosed, isRiichi, isTsumo, isDealer) {
    return calculateMahjongScore(units, hand, openTiles || [], agariTile, isClosed, isRiichi, isTsumo, isDealer, OFFICIAL_UNITS);
}

function tileFillsReq(tile, req) {
    if (tile === req) return true;
    if (tile === "P（ｼﾞｮｰｶｰ）") return true;
    const alm = attrAlmightyFor(req);
    return !!(alm && tile === alm);
}

// ワイルドカードの割り当て違いを含む抽出（残り手牌のユニークな形だけ返す）
function extractAllWays(hand, required) {
    const results = [];
    const seen = new Set();
    function rec(reqIdx, used) {
        if (reqIdx >= required.length) {
            const remaining = hand.filter((_, i) => !used.has(i));
            const key = remaining.slice().sort().join(',');
            if (!seen.has(key)) {
                seen.add(key);
                results.push(remaining);
            }
            return;
        }
        const req = required[reqIdx];
        const exact = [];
        const wild = [];
        for (let i = 0; i < hand.length; i++) {
            if (used.has(i)) continue;
            if (hand[i] === req) exact.push(i);
            else if (tileFillsReq(hand[i], req)) wild.push(i);
        }
        const candidates = exact.length ? exact : wild;
        if (!candidates.length) return;
        for (const i of candidates) {
            used.add(i);
            rec(reqIdx + 1, used);
            used.delete(i);
        }
    }
    rec(0, new Set());
    return results;
}

let _unitsBySizeDesc = null;
function unitsBySizeDesc() {
    if (!_unitsBySizeDesc && typeof OFFICIAL_UNITS !== 'undefined') {
        _unitsBySizeDesc = OFFICIAL_UNITS.slice().sort((a, b) => b.members.length - a.members.length);
    }
    return _unitsBySizeDesc || [];
}

// 役構成チェック。人数の大きいユニットを優先（メイン役翻 = 最大人数-2 のため）
function checkAgari(hand, memo = {}) {
    if (hand.length === 0) return { isValid: true, units: [] };
    if (hand.length < 2) return { isValid: false, units: [] };

    let key = [...hand].sort().join(',');
    if (memo[key] !== undefined) return memo[key];

    const units = unitsBySizeDesc();
    for (let i = 0; i < units.length; i++) {
        let unit = units[i];
        if (hand.length < unit.members.length) continue;
        if (!canPossiblyExtract(hand, unit.members)) continue;
        let ways = extractAllWays(hand, unit.members);
        for (let remaining of ways) {
            let res = checkAgari(remaining, memo);
            if (res.isValid) {
                let ret = { isValid: true, units: [unit.name, ...res.units] };
                memo[key] = ret; return ret;
            }
        }
    }
    memo[key] = { isValid: false, units: [] };
    return memo[key];
}

// 外部ファイル化したスコア計算をかませて、役（ハン）が1以上あるか確認する
function getWaits(testHand, memo, isClosed, pIdx, openTilesArr = []) {
    let waits = [];
    let isDealer = (pIdx === currentDealer);
    const waitTiles = (typeof WAIT_TILE_TYPES !== 'undefined') ? WAIT_TILE_TYPES : ALL_TILE_TYPES;
    for (let tile of waitTiles) {
        let tHand = [...testHand, tile];
        let res = checkAgari(tHand, memo);
        if (res.isValid) {
            let score = scoreHand(res.units, tHand, openTilesArr, tile, isClosed, false, false, isDealer);
            if (score.han > 0) {
                waits.push({ tile: tile, units: res.units, han: score.han, fu: score.fu, rank: score.rank, scoreVal: score.score });
            }
        }
    }
    return waits;
}

function getTenpaiInfo(myHand, myOpen, isMyTurn, pIdx) {
    let fullHand = [...myHand, ...myOpen];
    let tenpaiList = [];
    let globalMemo = {}; 
    let isClosed = myOpen.length === 0;
    
    if (checkAgari(fullHand, globalMemo).isValid) return [];
    
    if (isMyTurn) {
        let uniqueHand = [...new Set(myHand)];
        for (let discardTile of uniqueHand) {
            let testHand = [...fullHand];
            testHand.splice(testHand.indexOf(discardTile), 1);
            let waits = getWaits(testHand, globalMemo, isClosed, pIdx, myOpen);
            if (waits.length > 0) tenpaiList.push({ discard: discardTile, waits: waits });
        }
    } else {
        let waits = getWaits(fullHand, globalMemo, isClosed, pIdx, myOpen);
        if (waits.length > 0) tenpaiList.push({ discard: null, waits: waits });
    }
    return tenpaiList;
}

function checkCanNaki(unlockedHand, tile) {
    let nakiUnits = [];
    for (let unit of OFFICIAL_UNITS) {
        if (unit.members.length >= 3) {
            let canNakiThisUnit = false;
            for (let i = 0; i < unit.members.length; i++) {
                let req = unit.members[i];
                let canSubstitute = false;
                if (req === tile) canSubstitute = true;
                else if (tile === "P（ｼﾞｮｰｶｰ）") canSubstitute = true;
                else if (tile === "Prｵｰﾙﾏｲﾃｨ" && IDOLS.Princess.includes(req)) canSubstitute = true;
                else if (tile === "Faｵｰﾙﾏｲﾃｨ" && IDOLS.Fairy.includes(req)) canSubstitute = true;
                else if (tile === "Anｵｰﾙﾏｲﾃｨ" && IDOLS.Angel.includes(req)) canSubstitute = true;
                
                if (canSubstitute) {
                    let remainingReqs = [...unit.members];
                    remainingReqs.splice(i, 1);
                    if (tryExtract(unlockedHand, remainingReqs)) {
                        canNakiThisUnit = true;
                        break;
                    }
                }
            }
            if (canNakiThisUnit) {
                nakiUnits.push(unit.name);
            }
        }
    }
    return nakiUnits.length > 0 ? nakiUnits : null;
}

function tryExtract(hand, required) {
    const ways = extractAllWays(hand, required);
    return ways.length ? ways[0] : null;
}

function consumeUnitFromHand(hand, unitName, discardedTile) {
    let unit = (typeof UNIT_BY_NAME !== "undefined" && UNIT_BY_NAME[unitName]) || OFFICIAL_UNITS.find(u => u.name === unitName);
    let reqs = [...unit.members];
    let usedTiles = [discardedTile];
    
    let dIdx = reqs.indexOf(discardedTile);
    if (dIdx !== -1) {
        reqs.splice(dIdx, 1);
    } else if (discardedTile === "P（ｼﾞｮｰｶｰ）") {
        reqs.shift();
    } else if (discardedTile.includes("ｵｰﾙﾏｲﾃｨ")) {
        let attr = discardedTile.substring(0, 2);
        let targetIdolIdx = reqs.findIndex(r => 
            (attr === "Pr" && IDOLS.Princess.includes(r)) ||
            (attr === "Fa" && IDOLS.Fairy.includes(r)) ||
            (attr === "An" && IDOLS.Angel.includes(r))
        );
        if (targetIdolIdx !== -1) reqs.splice(targetIdolIdx, 1);
        else reqs.shift();
    }

    let missing = [];
    for (let req of reqs) {
        let idx = hand.indexOf(req);
        if (idx !== -1) { usedTiles.push(hand.splice(idx, 1)[0]); }
        else { missing.push(req); }
    }
    
    for (let req of missing) {
        let attrAlm = IDOLS.Princess.includes(req) ? "Prｵｰﾙﾏｲﾃｨ" : (IDOLS.Fairy.includes(req) ? "Faｵｰﾙﾏｲﾃｨ" : "Anｵｰﾙﾏｲﾃｨ");
        let idx = hand.indexOf(attrAlm);
        if (idx !== -1) { usedTiles.push(hand.splice(idx, 1)[0]); continue; }
        idx = hand.indexOf("P（ｼﾞｮｰｶｰ）");
        if (idx !== -1) { usedTiles.push(hand.splice(idx, 1)[0]); continue; }
    }
    return usedTiles;
}

function formatResultHand(hand, units) {
    let tempHand = [...hand];
    let grouped = [];
    
    if (!units || units.length === 0) {
        tempHand.sort((a, b) => (SORT_ORDER[a] ?? 999) - (SORT_ORDER[b] ?? 999));
        return [tempHand];
    }

    for (let unitName of units) {
        let unitData = OFFICIAL_UNITS.find(u => u.name === unitName);
        if (!unitData) continue;
        let reqs = [...unitData.members];
        let group = [];
        
        for (let i = reqs.length - 1; i >= 0; i--) {
            let idx = tempHand.indexOf(reqs[i]);
            if (idx !== -1) {
                group.push(tempHand.splice(idx, 1)[0]);
                reqs.splice(i, 1);
            }
        }
        for (let i = reqs.length - 1; i >= 0; i--) {
            let req = reqs[i];
            let attrAlm = IDOLS.Princess.includes(req) ? "Prｵｰﾙﾏｲﾃｨ" : (IDOLS.Fairy.includes(req) ? "Faｵｰﾙﾏｲﾃｨ" : "Anｵｰﾙﾏｲﾃｨ");
            let idx = tempHand.indexOf(attrAlm);
            if (idx !== -1) {
                group.push(tempHand.splice(idx, 1)[0]);
                reqs.splice(i, 1);
            }
        }
        for (let i = reqs.length - 1; i >= 0; i--) {
            let idx = tempHand.indexOf("P（ｼﾞｮｰｶｰ）");
            if (idx !== -1) {
                group.push(tempHand.splice(idx, 1)[0]);
                reqs.splice(i, 1);
            }
        }
        group.sort((a, b) => (SORT_ORDER[a] ?? 999) - (SORT_ORDER[b] ?? 999));
        grouped.push(group);
    }
    
    if (tempHand.length > 0) {
        tempHand.sort((a, b) => (SORT_ORDER[a] ?? 999) - (SORT_ORDER[b] ?? 999));
        grouped.push(tempHand);
    }
    return grouped;
}

let peer, isHost = false, myId = null;
let hostConn = null, clientConns = []; let playerRoles = [];
let playerConns = [null, null, null, null];
let hostSeat = 0;
let clientNamesMap = {}; let globalPlayerNames = [];
let deck = [], playerHands = [[],[],[],[]], discards = [[],[],[],[]];
let currentTurn = 0, currentDiscard = null, nakiResponses = [], nakiTimer = null;
let isWaitingAction = false; let isMyTurnNow = false; 

let gameRuleMaxRounds = 1; let currentBakaze = 0; let currentKyoku = 1; let currentDealer = 0;
let playerScores = [25000, 25000, 25000, 25000];
let playerRiichi = [false, false, false, false];
let riichiSticks = 0;
let riichiDiscardIndex = [-1, -1, -1, -1];

let globalHandLens = [12,12,12,12]; let getHandLens = () => playerHands.map(h => h.length);
let openTiles = [[], [], [], []]; let getOpenTiles = () => openTiles;
let globalOpenTiles = [[], [], [], []];
let globalPlayerRiichi = [false, false, false, false];
let globalRiichiSticks = 0;
let globalRiichiDiscardIndex = [-1, -1, -1, -1];
let isPendingRiichi = false;
let validRiichiDiscards = [];
let clientCurrentTurn = -1;

let clerkState = { active: false, originalPlayer: null, discardsLeft: 0, firstNakiPlayer: null, secondNakiPlayer: null, interruptedByNaki: false };

let lockedUnits = new Set(); 
let currentLockedIndices = new Set();
let actionTimerInterval = null;

let readyForNextKyokuCount = 0;
let isNextRenchan = false;

let gameEpoch = 0;
let kyokuActive = false;
let skipFuriten = [false, false, false, false];
let localSkipFuriten = false;
const ACTION_LIMIT_SEC = 12;
const DISCARD_LIMIT_SEC = 20;

function setConnStatus(msg) {
    const el = document.getElementById('conn-status');
    if (el) el.innerText = msg || '';
}
function showWaitOverlay(msg) {
    const ov = document.getElementById('wait-overlay');
    const t = document.getElementById('wait-overlay-msg');
    if (t && msg) t.innerText = msg;
    if (ov) ov.style.display = 'flex';
}
function hideWaitOverlay() {
    const ov = document.getElementById('wait-overlay');
    if (ov) ov.style.display = 'none';
}
function showDisconnectOverlay(msg) {
    const ov = document.getElementById('disconnect-overlay');
    const t = document.getElementById('disconnect-overlay-msg');
    if (t && msg) t.innerText = msg;
    if (ov) ov.style.display = 'flex';
}

function bumpGameEpoch() {
    gameEpoch++;
    if (nakiTimer) { clearTimeout(nakiTimer); nakiTimer = null; }
    if (actionTimerInterval) { clearInterval(actionTimerInterval); actionTimerInterval = null; }
}
function kyokuTimeout(fn, ms) {
    const epoch = gameEpoch;
    return setTimeout(() => {
        if (epoch !== gameEpoch || !kyokuActive) return;
        fn();
    }, ms);
}

function liveClientCount() {
    return clientConns.filter(c => c && c.open).length;
}
function sendToClient(idx, data) {
    const conn = playerConns[idx] || clientConns[idx - 1];
    if (conn && conn.open) conn.send(data);
}
function broadcast(data) {
    const sent = new Set();
    playerConns.forEach(c => {
        if (c && c.open && !sent.has(c)) { c.send(data); sent.add(c); }
    });
    clientConns.forEach(c => {
        if (c && c.open && !sent.has(c)) { c.send(data); sent.add(c); }
    });
    handleHostMsg(data);
}

function attachClientConn(conn) {
    if (liveClientCount() >= 3) { conn.close(); return; }
    clientConns.push(conn);
    document.getElementById('player-count').innerText = liveClientCount() + 1;
    setConnStatus('参加者 ' + (liveClientCount() + 1) + ' / 4');
    conn.on('data', data => handleClientMsg(conn, data));
    conn.on('close', () => onClientDisconnected(conn));
    conn.on('error', () => onClientDisconnected(conn));
}
function onClientDisconnected(conn) {
    let seat = playerConns.indexOf(conn);
    if (seat < 0) seat = clientConns.indexOf(conn);
    if (seat < 0) {
        document.getElementById('player-count').innerText = liveClientCount() + 1;
        return;
    }
    const name = (globalPlayerNames[seat] || clientNamesMap[conn.peer] || 'ゲスト');
    if (playerRoles[seat] === 'CLIENT') {
        playerRoles[seat] = 'CPU';
        playerConns[seat] = null;
        logM(name + ' が切断したためCPUが代わります');
        if (kyokuActive && currentTurn === seat && !isWaitingAction) {
            kyokuTimeout(() => cpuTakeTurn(seat), 800);
        }
        if (kyokuActive && isWaitingAction && currentDiscard && seat !== currentDiscard.pIdx) {
            processNakiAction(seat, 'SKIP');
        }
    }
    document.getElementById('player-count').innerText = liveClientCount() + 1;
}

function evaluateAgari(pIdx, fullHand, agariTile, isTsumo) {
    const memo = {};
    const res = checkAgari(fullHand, memo);
    if (!res.isValid) return null;
    const isClosed = openTiles[pIdx].length === 0;
    const isDealer = (pIdx === currentDealer);
    const scoreInfo = scoreHand(res.units, fullHand, openTiles[pIdx], agariTile, isClosed, playerRiichi[pIdx], isTsumo, isDealer);
    if (scoreInfo.han <= 0) return null;
    return { res, scoreInfo };
}

function getWaitTilesForPlayer(pIdx) {
    const closed = playerHands[pIdx];
    const opened = openTiles[pIdx] || [];
    const full = [...closed, ...opened];
    if (checkAgari(full, {}).isValid) return [];
    const waits = getWaits(full, {}, opened.length === 0, pIdx, opened);
    return waits.map(w => w.tile);
}

function isFuriten(pIdx) {
    if (skipFuriten[pIdx]) return true;
    const waits = getWaitTilesForPlayer(pIdx);
    if (!waits.length) return false;
    const river = discards[pIdx] || [];
    return waits.some(t => river.includes(t));
}

function clientIsFuriten() {
    if (localSkipFuriten) return true;
    const closed = myLocalHand;
    const opened = globalOpenTiles[myId] || [];
    const full = [...closed, ...opened];
    if (checkAgari(full, {}).isValid) return false;
    const waits = getWaits(full, {}, opened.length === 0, myId, opened);
    const river = discards[myId] || [];
    return waits.some(w => river.includes(w.tile));
}

function canRiichiAfterDiscard(pIdx, tile) {
    if (openTiles[pIdx].length !== 0) return false;
    if (playerScores[pIdx] < 1000) return false;
    if (playerRiichi[pIdx]) return false;
    const testClosed = [...playerHands[pIdx]];
    const idx = testClosed.indexOf(tile);
    if (idx === -1) return false;
    testClosed.splice(idx, 1);
    const waits = getWaits(testClosed, {}, true, pIdx, []);
    return waits.length > 0;
}

function cpuDangerScore(tile, fromIdx) {
    let danger = 0;
    const units = (typeof OFFICIAL_UNITS !== 'undefined') ? OFFICIAL_UNITS : [];
    for (let i = 0; i < 4; i++) {
        if (i === fromIdx) continue;
        if ((discards[i] || []).includes(tile)) continue;
        if (playerRiichi[i]) danger += 140;
        const opened = openTiles[i] || [];
        if (!opened.length) continue;
        for (let u = 0; u < units.length; u++) {
            const members = units[u].members;
            if (members.length < 3) continue;
            let match = 0;
            const pool = opened.slice();
            for (let m = 0; m < members.length; m++) {
                const ix = pool.indexOf(members[m]);
                if (ix !== -1) { match++; pool.splice(ix, 1); }
            }
            if (match >= 2 && members.includes(tile)) danger += 40 + match * 15;
        }
    }
    return danger;
}

function getCpuDiscard(hand, pIdx = 0) {
    const riverSeen = discards.flat();
    let scores = [];
    for (let i = 0; i < hand.length; i++) {
        let score = 0; let t = hand[i];
        if (t.includes("ｵｰﾙﾏｲﾃｨ") || t === "P（ｼﾞｮｰｶｰ）") score += 1200;
        if (t === "青葉美咲" || t === "音無小鳥") score -= 5000;
        score += (hand.filter(x => x === t).length * 8);
        score -= riverSeen.filter(x => x === t).length * 6;
        score += cpuDangerScore(t, pIdx);
        if (hand.length <= 4 && (t.includes('ｵｰﾙﾏｲﾃｨ') || t === 'P（ｼﾞｮｰｶｰ）')) score += 400;
        scores.push({ tile: t, score: score });
    }
    let minScore = Math.min(...scores.map(s => s.score));
    let candidates = scores.filter(s => s.score === minScore);
    return candidates[Math.floor(Math.random() * candidates.length)].tile;
}

function simulateNaki(pIdx, tile, unitName) {
    const hand = playerHands[pIdx].slice();
    const used = consumeUnitFromHand(hand, unitName, tile);
    return {
        closedLeft: hand.length,
        hand,
        openAfter: (openTiles[pIdx] || []).concat(used)
    };
}

function canNakiWithDiscardLeft(pIdx, tile, unitName) {
    return simulateNaki(pIdx, tile, unitName).closedLeft >= 1;
}

function getCpuNakiChoice(pIdx, tile) {
    if (playerRiichi[pIdx]) return null;
    const nakiUnits = checkCanNaki(playerHands[pIdx], tile);
    if (!nakiUnits) return null;
    const tenpaiNow = getTenpaiInfo(playerHands[pIdx], openTiles[pIdx] || [], false, pIdx);
    if (tenpaiNow.some(t => t.waits && t.waits.length > 0)) return null;

    const closedNow = playerHands[pIdx].length;
    const scored = [];
    for (let n = 0; n < nakiUnits.length; n++) {
        const name = nakiUnits[n];
        const unit = (typeof UNIT_BY_NAME !== 'undefined' && UNIT_BY_NAME[name]) || OFFICIAL_UNITS.find(x => x.name === name);
        const size = unit ? unit.members.length : 0;
        const sim = simulateNaki(pIdx, tile, name);
        if (sim.closedLeft < 1) continue;

        const afterDiscardClosed = sim.closedLeft - 1;
        const tenpaiAfter = getTenpaiInfo(sim.hand, sim.openAfter, true, pIdx).filter(t => t.waits && t.waits.length > 0);
        const becomesTenpai = tenpaiAfter.length > 0;

        if (afterDiscardClosed <= 0 && !becomesTenpai) continue;
        if (closedNow <= 4 && !becomesTenpai) continue;
        if (afterDiscardClosed < 3 && !becomesTenpai && size < 5) continue;

        let value = 0;
        if (becomesTenpai) {
            const waitN = tenpaiAfter.reduce((m, t) => m + t.waits.length, 0);
            value += 250 + waitN * 8;
        }
        value += size * 6;
        value += afterDiscardClosed * 20;
        if (afterDiscardClosed <= 2) value -= 100;
        if (!becomesTenpai && size <= 3) value -= 40;
        scored.push({ name, value, becomesTenpai, afterDiscardClosed, size });
    }
    if (!scored.length) return null;
    scored.sort((a, b) => b.value - a.value);
    const best = scored[0];
    if (!best.becomesTenpai && best.size <= 3 && Math.random() > 0.12) return null;
    if (!best.becomesTenpai && best.afterDiscardClosed < 4) return null;
    return best.name;
}

function cpuTakeTurn(pIdx) {
    if (!kyokuActive || playerRoles[pIdx] !== 'CPU') return;
    if (currentTurn !== pIdx || isWaitingAction) return;
    const h = playerHands[pIdx];
    const fullHand = [...h, ...openTiles[pIdx]];
    const drawn = h.length ? h[h.length - 1] : null;
    const agari = evaluateAgari(pIdx, fullHand, drawn, true);
    if (agari) {
        processAgari(pIdx, true);
        return;
    }
    if (playerRiichi[pIdx]) {
        processDiscard(pIdx, drawn, false);
        return;
    }
    if (openTiles[pIdx].length === 0) {
        const tInfo = getTenpaiInfo(h, [], true, pIdx);
        const validWaits = tInfo.filter(t => t.waits.length > 0);
        if (validWaits.length > 0 && playerScores[pIdx] >= 1000 && deck.length > 4 && Math.random() < 0.7) {
            const discardTile = validWaits[Math.floor(Math.random() * validWaits.length)].discard;
            processDiscard(pIdx, discardTile, true);
            return;
        }
    }
    processDiscard(pIdx, getCpuDiscard(h, pIdx), false);
}

const PEER_OPTIONS = {
    debug: 0,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' }
        ]
    }
};

function isCoarsePointer() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

function copyRoomId() {
    const id = document.getElementById('my-id').innerText;
    if (!id || id === '未作成') { setConnStatus('先にホストになってください'); return; }
    const done = () => setConnStatus('部屋番号 ' + id + ' をコピーしました');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(id).then(done).catch(() => {
            window.prompt('部屋番号をコピーしてください', id);
        });
    } else {
        window.prompt('部屋番号をコピーしてください', id);
    }
}

let selectedHandIdx = -1;

function discardFromHand(tile) {
    const isRiichiAction = isPendingRiichi;
    selectedHandIdx = -1;
    hideActions();
    sendAction('DISCARD', { tile: tile, isRiichi: isRiichiAction });
}

function createRoom() {
    isHost = true;
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();
    setConnStatus('部屋を作成しています...');
    peer = new Peer(roomId, PEER_OPTIONS);
    peer.on('open', id => {
        document.getElementById('my-id').innerText = id;
        document.getElementById('player-count').innerText = "1";
        document.getElementById('start-btn').style.display = 'inline-block';
        setConnStatus('部屋番号 ' + id + ' で待機中');
    });
    peer.on('error', err => {
        setConnStatus('接続エラー: ' + (err && err.type ? err.type : '不明'));
        logM('Peerエラー: ' + (err && err.type ? err.type : err));
    });
    peer.on('disconnected', () => setConnStatus('ブローカーから切断。再接続を試みます'));
    peer.on('connection', conn => attachClientConn(conn));
}
function joinRoom() {
    const roomId = (document.getElementById('join-id').value || '').trim();
    if (!roomId) { setConnStatus('部屋番号を入力してください'); return; }
    setConnStatus('接続しています...');
    peer = new Peer(undefined, PEER_OPTIONS);
    peer.on('error', err => {
        setConnStatus('接続エラー: ' + (err && err.type ? err.type : '不明'));
        hideWaitOverlay();
        showDisconnectOverlay('部屋に接続できませんでした。番号を確認してください。');
    });
    peer.on('open', () => {
        hostConn = peer.connect(roomId, { reliable: true, serialization: 'json' });
        hostConn.on('open', () => {
            document.getElementById('setup-panel').style.display = 'none';
            showWaitOverlay('ホストの試合開始を待っています...');
            logM('ホストに接続しました');
            hostConn.send({ type: 'SET_NAME', name: document.getElementById('player-name-input').value || 'ゲスト' });
        });
        hostConn.on('data', data => handleHostMsg(data));
        hostConn.on('close', () => {
            if (kyokuActive) showDisconnectOverlay('ホストとの接続が切れました。');
            else showDisconnectOverlay('ホストが部屋を閉じました。');
        });
        hostConn.on('error', () => showDisconnectOverlay('ホストとの接続に失敗しました。'));
    });
}

function shuffleSeats(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function initMatch() {
    gameRuleMaxRounds = parseInt(document.getElementById('game-rule').value);
    currentBakaze = 0; currentKyoku = 1; currentDealer = 0; playerScores = [25000, 25000, 25000, 25000];
    riichiSticks = 0;
    const slots = [{ role: 'HOST', conn: null, name: document.getElementById('player-name-input').value || 'ホスト' }];
    clientConns.forEach(c => {
        if (c && c.open) slots.push({ role: 'CLIENT', conn: c, name: clientNamesMap[c.peer] || 'ゲスト' });
    });
    while (slots.length < 4) slots.push({ role: 'CPU', conn: null, name: 'CPU' + slots.length });
    shuffleSeats(slots);
    playerRoles = slots.map(s => s.role);
    playerConns = slots.map(s => s.conn);
    globalPlayerNames = slots.map(s => s.name);
    hostSeat = playerRoles.indexOf('HOST');
    if (hostSeat < 0) hostSeat = 0;
    startKyoku();
}

function startKyoku() {
    bumpGameEpoch();
    kyokuActive = true;
    deck = []; discards = [[],[],[],[]]; openTiles = [[],[],[],[]];
    playerRiichi = [false, false, false, false]; riichiDiscardIndex = [-1, -1, -1, -1];
    skipFuriten = [false, false, false, false];
    for(let attr in IDOLS) IDOLS[attr].forEach(i => deck.push(i, i));
    SPECIAL_TILES.forEach(s => { for(let i=0; i<s.count; i++) deck.push(s.name); });
    for(let i = deck.length-1; i>0; i--) { let j = Math.floor(Math.random()*(i+1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }

    for(let i=0; i<4; i++) { playerHands[i] = deck.splice(-12); playerHands[i].sort((a, b) => (SORT_ORDER[a] ?? 999) - (SORT_ORDER[b] ?? 999)); }
    isWaitingAction = false; currentTurn = currentDealer; 
    clerkState = { active: false, originalPlayer: null, discardsLeft: 0, firstNakiPlayer: null, secondNakiPlayer: null, interruptedByNaki: false };
    
    playerRoles.forEach((role, idx) => {
        let msg = { type: 'START_KYOKU', pId: idx, hand: [...playerHands[idx]], deckLen: deck.length, roles: playerRoles, names: globalPlayerNames, handLens: getHandLens(), openTiles: getOpenTiles(), scores: playerScores, bakaze: currentBakaze, kyoku: currentKyoku, dealer: currentDealer, playerRiichi: playerRiichi, riichiSticks: riichiSticks, riichiDiscardIndex: riichiDiscardIndex };
        if(role === 'HOST') handleHostMsg(msg);
        else if(role === 'CLIENT') sendToClient(idx, msg);
    });
    kyokuTimeout(nextTurn, 1500);
}

function nextTurn() {
    if (!kyokuActive) return;
    isWaitingAction = false;
    skipFuriten[currentTurn] = playerRiichi[currentTurn] ? skipFuriten[currentTurn] : false;
    if(deck.length === 0) { 
        settleRyukyokuAndEnd();
        return; 
    }
    if(playerHands[currentTurn].length + openTiles[currentTurn].length >= 14) return;

    let drawn = deck.pop(); playerHands[currentTurn].push(drawn);
    broadcast({ type: 'TURN_CHANGE', turn: currentTurn, deckLen: deck.length, handLens: getHandLens(), openTiles: getOpenTiles() });
    
    let msg = { type: 'DRAWN_TILE', tile: drawn, hand: [...playerHands[currentTurn]] };
    if (playerRoles[currentTurn] === 'HOST') handleHostMsg(msg);
    else if (playerRoles[currentTurn] === 'CLIENT') sendToClient(currentTurn, msg);

    if (playerRoles[currentTurn] === 'CPU') {
        kyokuTimeout(() => cpuTakeTurn(currentTurn), 1200);
    }
}

function handleClientMsg(conn, data) {
    if(data.type === 'SET_NAME') { clientNamesMap[conn.peer] = data.name; return; }
    if(data.type === 'READY_NEXT') { handleReadyNext(); return; }
    
    let pIdx = playerConns.indexOf(conn);
    if (pIdx < 0) return;
    if(data.type === 'DISCARD' && currentTurn === pIdx && !isWaitingAction) processDiscard(pIdx, data.tile, data.isRiichi);
    if(data.type === 'ACTION') processNakiAction(pIdx, data.action, data.payload);
    if(data.type === 'TSUMO' && currentTurn === pIdx) {
        if (!processAgari(pIdx, true)) sendToClient(pIdx, { type: 'AGARI_REJECTED' });
    }
}
function sendToHost(data) {
    if (hostConn && hostConn.open) hostConn.send(data);
}
function restoreTurnAfterRejectedAgari() {
    isMyTurnNow = true;
    logM('アガリ不成立のため打牌してください');
    renderHand(true);
    startDiscardTimer();
}
function sendAction(action, payload=null) {
    if(action === 'DISCARD') { 
        let t = payload.tile !== undefined ? payload.tile : payload;
        let r = payload.isRiichi || false;
        if(isHost) processDiscard(hostSeat, t, r); else sendToHost({type:'DISCARD', tile: t, isRiichi: r}); 
    }
    else if(action === 'TSUMO') {
        if(isHost) {
            if (!processAgari(hostSeat, true)) restoreTurnAfterRejectedAgari();
        } else sendToHost({type:'TSUMO'});
    }
    else if(action === 'NAKI') { if(isHost) processNakiAction(hostSeat, action, payload); else sendToHost({type:'ACTION', action:action, payload:payload}); }
    else {
        if (action === 'SKIP' && lastAskCouldRon) localSkipFuriten = true;
        if(isHost) processNakiAction(hostSeat, action); else sendToHost({type:'ACTION', action:action});
    }
}

function processDiscard(pIdx, tile, isRiichi = false) {
    if (!kyokuActive || isWaitingAction) return; 
    if (currentTurn !== pIdx) return;
    let h = playerHands[pIdx]; let tIdx = h.indexOf(tile);
    if(tIdx === -1) return; 
    
    if (isRiichi && !playerRiichi[pIdx]) {
        if (!canRiichiAfterDiscard(pIdx, tile)) isRiichi = false;
    }
    if (isRiichi && !playerRiichi[pIdx] && playerScores[pIdx] >= 1000) {
        playerRiichi[pIdx] = true;
        playerScores[pIdx] -= 1000;
        riichiSticks++;
        riichiDiscardIndex[pIdx] = discards[pIdx].length;
    }

    h.splice(tIdx, 1); discards[pIdx].push(tile); currentDiscard = { pIdx, tile };
    
    broadcast({ 
        type: 'DISCARDED', pIdx, tile, discards, handLens: getHandLens(), openTiles: getOpenTiles(),
        playerRiichi: playerRiichi, riichiSticks: riichiSticks, riichiDiscardIndex: riichiDiscardIndex, scores: playerScores
    });
    
    if ((tile === "青葉美咲" || tile === "音無小鳥") && !playerRiichi[pIdx]) {
        if (deck.length < 2) { broadcast({ type: 'MSG', msg: "山札が足りず効果不発。" }); advanceTurnAfterDiscard(); return; }
        clerkState = { active: true, originalPlayer: pIdx, discardsLeft: 2, firstNakiPlayer: null, secondNakiPlayer: null, interruptedByNaki: false };
        let d1 = deck.pop(); let d2 = deck.pop(); h.push(d1, d2);
        
        broadcast({ type: 'CLERK_EFFECT', pIdx: pIdx, deckLen: deck.length, handLens: getHandLens(), openTiles: getOpenTiles() });
        let msg = { type: 'CLERK_DRAW', drawn: [d1, d2] };
        if (playerRoles[pIdx] === 'HOST') handleHostMsg(msg);
        else if (playerRoles[pIdx] === 'CLIENT') sendToClient(pIdx, msg);
        if (playerRoles[pIdx] === 'CPU') { kyokuTimeout(() => { processDiscard(pIdx, getCpuDiscard(h, pIdx), false); }, 1200); }
        return; 
    }
    
    if (clerkState.active && pIdx === clerkState.originalPlayer && !clerkState.interruptedByNaki) {
        clerkState.discardsLeft--;
    }

    isWaitingAction = true; nakiResponses = []; broadcast({ type: 'WAITING_ACTION' });

    playerRoles.forEach((role, idx) => {
        if(idx === pIdx) return;
        if (role === 'CPU') { 
            let evalRon = evaluateAgari(idx, [...playerHands[idx], ...openTiles[idx], tile], tile, false);
            if (evalRon && !isFuriten(idx)) {
                nakiResponses.push({ pIdx: idx, action: 'RON' });
            } else {
                const nakiChoice = getCpuNakiChoice(idx, tile);
                if (nakiChoice) nakiResponses.push({ pIdx: idx, action: 'NAKI', payload: nakiChoice });
                else nakiResponses.push({ pIdx: idx, action: 'SKIP' });
            }
        } else {
            let msg = { type: 'ASK_ACTION', discarder: pIdx, tile }; 
            if(idx === hostSeat) handleHostMsg(msg);
            else sendToClient(idx, msg); 
        }
    });
    if (nakiResponses.length === 3) nakiTimer = kyokuTimeout(resolveActions, 600);
    else nakiTimer = kyokuTimeout(resolveActions, ACTION_LIMIT_SEC * 1000);
}

function processNakiAction(pIdx, action, payload=null) {
    if (!kyokuActive || !isWaitingAction || !currentDiscard) return;
    if(pIdx === currentDiscard.pIdx) return;
    if(nakiResponses.find(r => r.pIdx === pIdx)) return;
    if (action === 'RON') {
        const tile = currentDiscard.tile;
        const evalRon = evaluateAgari(pIdx, [...playerHands[pIdx], ...openTiles[pIdx], tile], tile, false);
        if (!evalRon || isFuriten(pIdx)) action = 'SKIP';
    }
    if (action === 'NAKI') {
        if (playerRiichi[pIdx] || !payload) action = 'SKIP';
        else {
            const can = checkCanNaki(playerHands[pIdx], currentDiscard.tile);
            if (!can || !can.includes(payload)) action = 'SKIP';
            else if (!canNakiWithDiscardLeft(pIdx, currentDiscard.tile, payload)) action = 'SKIP';
        }
    }
    if (action === 'SKIP') {
        const tile = currentDiscard.tile;
        const evalRon = evaluateAgari(pIdx, [...playerHands[pIdx], ...openTiles[pIdx], tile], tile, false);
        if (evalRon) skipFuriten[pIdx] = true;
    }
    nakiResponses.push({ pIdx, action, payload });
    if(nakiResponses.length === 3) { clearTimeout(nakiTimer); resolveActions(); }
}

function advanceTurnAfterDiscard() {
    if (clerkState.active) {
        if (clerkState.discardsLeft > 0) {
            clerkState.interruptedByNaki = false;
            currentTurn = clerkState.originalPlayer;
            broadcast({ type: 'TURN_CONTINUE', pIdx: currentTurn, handLens: getHandLens(), openTiles: getOpenTiles() });
            if (playerRoles[currentTurn] === 'CPU') { kyokuTimeout(() => { processDiscard(currentTurn, getCpuDiscard(playerHands[currentTurn], currentTurn), false); }, 1200); }
            return;
        } else {
            let nextP = null;
            if (clerkState.secondNakiPlayer !== null) nextP = (clerkState.secondNakiPlayer + 1) % 4;
            else if (clerkState.firstNakiPlayer !== null) nextP = (clerkState.firstNakiPlayer + 1) % 4;
            else nextP = (clerkState.originalPlayer + 1) % 4;
            
            clerkState.active = false; currentTurn = nextP; 
            kyokuTimeout(nextTurn, 1000); 
            return;
        }
    }
    currentTurn = (currentDiscard.pIdx + 1) % 4; 
    kyokuTimeout(nextTurn, 1000); 
}

function seatDistanceFromDiscarder(pIdx) {
    return (pIdx - currentDiscard.pIdx + 4) % 4;
}

function resolveActions() {
    if (!currentDiscard) return;
    isWaitingAction = false; clearTimeout(nakiTimer);
    for(let i=0; i<4; i++) {
        if(i !== currentDiscard.pIdx && !nakiResponses.find(r => r.pIdx === i)) {
            const tile = currentDiscard.tile;
            const evalRon = evaluateAgari(i, [...playerHands[i], ...openTiles[i], tile], tile, false);
            if (evalRon) skipFuriten[i] = true;
            nakiResponses.push({ pIdx: i, action: 'SKIP' });
        }
    }
    
    let rons = nakiResponses.filter(r => r.action === 'RON');
    let nakis = nakiResponses.filter(r => r.action === 'NAKI');
    rons.sort((a, b) => seatDistanceFromDiscarder(a.pIdx) - seatDistanceFromDiscarder(b.pIdx));
    nakis.sort((a, b) => seatDistanceFromDiscarder(a.pIdx) - seatDistanceFromDiscarder(b.pIdx));
    
    if(rons.length > 0) {
        for (const ron of rons) {
            if (processAgari(ron.pIdx, false)) return;
        }
    }
    if (nakis.length > 0) {
        let applied = false;
        for (const naki of nakis) {
            let nPlayer = naki.pIdx; let nUnit = naki.payload;
            if (playerRiichi[nPlayer]) continue;
            const can = checkCanNaki(playerHands[nPlayer], currentDiscard.tile);
            if (!can || !can.includes(nUnit)) continue;
            if (!canNakiWithDiscardLeft(nPlayer, currentDiscard.tile, nUnit)) continue;

            if (clerkState.active && !clerkState.interruptedByNaki && currentDiscard.pIdx === clerkState.originalPlayer) {
                if (clerkState.discardsLeft === 1) clerkState.firstNakiPlayer = nPlayer;
                else if (clerkState.discardsLeft === 0) clerkState.secondNakiPlayer = nPlayer;
                clerkState.interruptedByNaki = true;
            }

            let usedTiles = consumeUnitFromHand(playerHands[nPlayer], nUnit, currentDiscard.tile);
            openTiles[nPlayer].push(...usedTiles);
            discards[currentDiscard.pIdx].pop();
            
            broadcast({ type: 'DISCARD_REMOVED', pIdx: currentDiscard.pIdx, discards: discards, handLens: getHandLens(), openTiles: getOpenTiles(), playerRiichi: playerRiichi, riichiSticks: riichiSticks, riichiDiscardIndex: riichiDiscardIndex, scores: playerScores });
            
            broadcast({ type: 'ACTION_TOAST', text: 'スカウト！', actionType: 'scout' });
            broadcast({ type: 'MSG', msg: `${globalPlayerNames[nPlayer]} がスカウトしました` });

            currentTurn = nPlayer;
            broadcast({ type: 'TURN_CHANGE', turn: currentTurn, deckLen: deck.length, handLens: getHandLens(), openTiles: getOpenTiles() });
            
            let msg = { type: 'NAKI_TURN', hand: [...playerHands[currentTurn]], unitName: nUnit };
            if (playerRoles[currentTurn] === 'HOST') handleHostMsg(msg);
            else if (playerRoles[currentTurn] === 'CLIENT') sendToClient(currentTurn, msg);
            
            if (playerRoles[currentTurn] === 'CPU') { kyokuTimeout(() => { processDiscard(currentTurn, getCpuDiscard(playerHands[currentTurn], currentTurn), false); }, 1200); }
            applied = true;
            break;
        }
        if (applied) return;
    }
    advanceTurnAfterDiscard();
}

function processAgari(pIdx, isTsumo) {
    if (!kyokuActive) return false;
    let fullHand = [...playerHands[pIdx], ...openTiles[pIdx]]; 
    let agariTile = isTsumo ? playerHands[pIdx][playerHands[pIdx].length - 1] : (currentDiscard ? currentDiscard.tile : null);
    if(!isTsumo) {
        if (!agariTile) return false;
        if (isFuriten(pIdx)) return false;
        fullHand.push(agariTile);
    }
    
    let evaluated = evaluateAgari(pIdx, fullHand, agariTile, isTsumo);
    if (!evaluated) return false;
    let res = evaluated.res;
    let scoreInfo = evaluated.scoreInfo;
    {

        if (isTsumo) {
            if (isDealer) {
                for(let i=0; i<4; i++) { 
                    if(i === pIdx) playerScores[i] += (scoreInfo.payAll * 3) + (riichiSticks * 1000); 
                    else playerScores[i] -= scoreInfo.payAll; 
                }
            } else {
                for(let i=0; i<4; i++) { 
                    if(i === pIdx) playerScores[i] += scoreInfo.score + (riichiSticks * 1000); 
                    else if(i === currentDealer) playerScores[i] -= scoreInfo.payDealer;
                    else playerScores[i] -= scoreInfo.payChild;
                }
            }
        } else {
            playerScores[pIdx] += scoreInfo.score + (riichiSticks * 1000); 
            playerScores[currentDiscard.pIdx] -= scoreInfo.score;
        }
        riichiSticks = 0;
        
        let legacyScoreObj = {
            details: scoreInfo.details,
            rank: scoreInfo.rank,
            score: scoreInfo.score
        };
        
        kyokuActive = false;
        bumpGameEpoch();
        broadcast({ type: 'KYOKU_OVER', isRyukyoku: false, pIdx, isTsumo, hand: fullHand, score: legacyScoreObj, scores: playerScores, riichiSticks: riichiSticks, units: res.units });
        prepareNextKyoku(pIdx === currentDealer);
        return true;
    }
}

function isPlayerTenpai(pIdx) {
    const info = getTenpaiInfo(playerHands[pIdx], openTiles[pIdx] || [], false, pIdx);
    return info.some(t => t.waits && t.waits.length > 0);
}

function settleRyukyokuAndEnd() {
    const tenpai = [0, 1, 2, 3].map(i => isPlayerTenpai(i));
    const tCount = tenpai.filter(Boolean).length;
    const nCount = 4 - tCount;
    if (tCount > 0 && nCount > 0) {
        const pay = Math.floor(3000 / nCount);
        const get = Math.floor(3000 / tCount);
        for (let i = 0; i < 4; i++) {
            if (tenpai[i]) playerScores[i] += get;
            else playerScores[i] -= pay;
        }
    }
    kyokuActive = false;
    bumpGameEpoch();
    const lines = [0, 1, 2, 3].map(i => {
        const mark = tenpai[i] ? 'テンパイ' : 'ノーテン';
        return `${globalPlayerNames[i]}: ${mark}`;
    });
    const dealerTenpai = tenpai[currentDealer];
    broadcast({
        type: 'KYOKU_OVER',
        isRyukyoku: true,
        msg: '流局です',
        scores: playerScores,
        riichiSticks: riichiSticks,
        tenpai,
        ryukyokuLines: lines,
        dealerRenchan: dealerTenpai
    });
    prepareNextKyoku(dealerTenpai);
}

function hasTobi() {
    return playerScores.some(s => s <= 0);
}

function prepareNextKyoku(renchan) {
    isNextRenchan = renchan;
    readyForNextKyokuCount = 0;
    
    let humanCount = playerRoles.filter(r => r !== 'CPU').length;
    if (humanCount <= 0) { setTimeout(proceedToNextKyoku, 2000); }
}

function handleReadyNext() {
    readyForNextKyokuCount++;
    let humanCount = playerRoles.filter(r => r !== 'CPU').length;
    if (readyForNextKyokuCount >= humanCount) {
        proceedToNextKyoku();
    }
}

function sendReadyNext() {
    document.getElementById('btn-next-kyoku').style.display = 'none';
    document.getElementById('next-kyoku-msg').style.display = 'block';
    if(isHost) {
        handleReadyNext();
    } else {
        sendToHost({ type: 'READY_NEXT' });
    }
}

function proceedToNextKyoku() {
    if (hasTobi()) {
        kyokuActive = false;
        broadcast({ type: 'MATCH_OVER', scores: playerScores, reason: 'tobi' });
        return;
    }
    if (!isNextRenchan) { currentDealer = (currentDealer + 1) % 4; currentKyoku++; if(currentKyoku > 4) { currentKyoku = 1; currentBakaze++; } }
    if (currentBakaze >= gameRuleMaxRounds) {
        kyokuActive = false;
        broadcast({ type: 'MATCH_OVER', scores: playerScores, reason: 'end' });
    } else {
        startKyoku();
    }
}

/** クライアント描画・UIロジック **/
let myLocalHand = []; let roleMap = [];

function toggleRiichi() {
    isPendingRiichi = !isPendingRiichi;
    let btn = document.getElementById('btn-riichi');
    btn.style.background = isPendingRiichi ? '#ff5722' : '#ff9800';
    renderHand(isMyTurnNow);
}

function toggleLockUnit(unitName) {
    if(lockedUnits.has(unitName)) lockedUnits.delete(unitName); else lockedUnits.add(unitName);
    reorderLockedTilesToLeft(); renderHand(isMyTurnNow);
}

function getUnlockedHand() {
    let tempHand = [...myLocalHand]; let consumedIndices = new Set();
    for (let unitName of lockedUnits) {
        let unit = (typeof UNIT_BY_NAME !== "undefined" && UNIT_BY_NAME[unitName]) || OFFICIAL_UNITS.find(u => u.name === unitName); if (!unit) continue;
        let missing = [];
        for (let req of unit.members) {
            let idx = tempHand.findIndex((t, i) => t === req && !consumedIndices.has(i));
            if (idx !== -1) { consumedIndices.add(idx); } else { missing.push(req); }
        }
        let almCandidates = []; let canComplete = true; let tempConsumed = new Set(consumedIndices);
        for (let req of missing) {
            let attrAlm = IDOLS.Princess.includes(req) ? "Prｵｰﾙﾏｲﾃｨ" : (IDOLS.Fairy.includes(req) ? "Faｵｰﾙﾏｲﾃｨ" : "Anｵｰﾙﾏｲﾃｨ");
            let idx = tempHand.findIndex((t, i) => t === attrAlm && !tempConsumed.has(i));
            if (idx !== -1) { tempConsumed.add(idx); almCandidates.push(idx); continue; }
            idx = tempHand.findIndex((t, i) => t === "P（ｼﾞｮｰｶｰ）" && !tempConsumed.has(i));
            if (idx !== -1) { tempConsumed.add(idx); almCandidates.push(idx); continue; }
            canComplete = false; break;
        }
        if (canComplete) { for(let idx of almCandidates) consumedIndices.add(idx); }
    }
    let unlocked = [];
    for (let i = 0; i < tempHand.length; i++) { if (!consumedIndices.has(i)) unlocked.push(tempHand[i]); }
    return unlocked;
}

function highlightUnit(unitName) {
    const tiles = document.querySelectorAll('#my-hand-area .mahjong-tile');
    if (!unitName) { tiles.forEach(el => el.classList.remove('hover-highlight')); return; }
    
    let unit = (typeof UNIT_BY_NAME !== "undefined" && UNIT_BY_NAME[unitName]) || OFFICIAL_UNITS.find(u => u.name === unitName); if (!unit) return;
    let tempHand = [...myLocalHand]; let consumedByOthers = new Set();
    
    for (let lUnitName of lockedUnits) {
        if (lUnitName === unitName) continue;
        let lUnit = OFFICIAL_UNITS.find(u => u.name === lUnitName); if (!lUnit) continue;
        let missing = [];
        for (let req of lUnit.members) {
            let idx = tempHand.findIndex((t, i) => t === req && !consumedByOthers.has(i));
            if (idx !== -1) consumedByOthers.add(idx); else missing.push(req);
        }
        let canComplete = true; let tempConsumed = new Set(consumedByOthers); let almCandidates = [];
        for (let req of missing) {
            let attrAlm = IDOLS.Princess.includes(req) ? "Prｵｰﾙﾏｲﾃｨ" : (IDOLS.Fairy.includes(req) ? "Faｵｰﾙﾏｲﾃｨ" : "Anｵｰﾙﾏｲﾃｨ");
            let idx = tempHand.findIndex((t, i) => t === attrAlm && !tempConsumed.has(i));
            if (idx !== -1) { tempConsumed.add(idx); almCandidates.push(idx); continue; }
            idx = tempHand.findIndex((t, i) => t === "P（ｼﾞｮｰｶｰ）" && !tempConsumed.has(i));
            if (idx !== -1) { tempConsumed.add(idx); almCandidates.push(idx); continue; }
            canComplete = false; break;
        }
        if (canComplete) { for(let idx of almCandidates) consumedByOthers.add(idx); }
    }

    let highlightIndices = new Set(); let missingForThis = [];
    for (let req of unit.members) {
        let idx = tempHand.findIndex((t, i) => t === req && !consumedByOthers.has(i) && !highlightIndices.has(i));
        if (idx !== -1) highlightIndices.add(idx); else missingForThis.push(req);
    }
    for (let req of missingForThis) {
        let attrAlm = IDOLS.Princess.includes(req) ? "Prｵｰﾙﾏｲﾃｨ" : (IDOLS.Fairy.includes(req) ? "Faｵｰﾙﾏｲﾃｨ" : "Anｵｰﾙﾏｲﾃｨ");
        let idx = tempHand.findIndex((t, i) => t === attrAlm && !consumedByOthers.has(i) && !highlightIndices.has(i));
        if (idx !== -1) { highlightIndices.add(idx); continue; }
        idx = tempHand.findIndex((t, i) => t === "P（ｼﾞｮｰｶｰ）" && !consumedByOthers.has(i) && !highlightIndices.has(i));
        if (idx !== -1) { highlightIndices.add(idx); continue; }
    }
    tiles.forEach((el, idx) => { if (highlightIndices.has(idx)) el.classList.add('hover-highlight'); else el.classList.remove('hover-highlight'); });
}

function highlightNakiUnit(unitName, discardedTile) {
    const tiles = document.querySelectorAll('#my-hand-area .mahjong-tile');
    if (!unitName) { tiles.forEach(el => el.classList.remove('hover-highlight')); return; }
    
    let usedTiles = consumeUnitFromHand([...myLocalHand], unitName, discardedTile);
    let highlightIndices = new Set();
    let tempHand = [...myLocalHand];
    
    let fromHand = usedTiles.slice(1);
    
    for (let tile of fromHand) {
        let idx = tempHand.indexOf(tile);
        if (idx !== -1) {
            highlightIndices.add(idx);
            tempHand[idx] = null;
        }
    }
    
    tiles.forEach((el, idx) => { 
        if (highlightIndices.has(idx)) el.classList.add('hover-highlight'); 
        else el.classList.remove('hover-highlight'); 
    });
}

function reorderLockedTilesToLeft() {
    let tempHand = [...myLocalHand];
    let lockedTiles = []; let unlockedTiles = []; let consumedIndices = new Set();
    
    let lockedStatus = [];
    for (let unitName of lockedUnits) {
        let unit = (typeof UNIT_BY_NAME !== "undefined" && UNIT_BY_NAME[unitName]) || OFFICIAL_UNITS.find(u => u.name === unitName); if (!unit) continue;
        let missing = []; let unitLocked = [];
        for (let req of unit.members) {
            let idx = tempHand.findIndex((t, i) => t === req && !consumedIndices.has(i));
            if (idx !== -1) { consumedIndices.add(idx); unitLocked.push(tempHand[idx]); }
            else { missing.push(req); }
        }
        lockedStatus.push({ unitName, missing, unitLocked });
    }
    
    for (let status of lockedStatus) {
        let almCandidates = []; let canComplete = true; let tempConsumed = new Set(consumedIndices);
        for (let req of status.missing) {
            let attrAlm = IDOLS.Princess.includes(req) ? "Prｵｰﾙﾏｲﾃｨ" : (IDOLS.Fairy.includes(req) ? "Faｵｰﾙﾏｲﾃｨ" : "Anｵｰﾙﾏｲﾃｨ");
            let idx = tempHand.findIndex((t, i) => t === attrAlm && !tempConsumed.has(i));
            if (idx !== -1) { tempConsumed.add(idx); almCandidates.push(idx); continue; }
            idx = tempHand.findIndex((t, i) => t === "P（ｼﾞｮｰｶｰ）" && !tempConsumed.has(i));
            if (idx !== -1) { tempConsumed.add(idx); almCandidates.push(idx); continue; }
            canComplete = false; break;
        }
        if (canComplete) {
            for (let idx of almCandidates) { consumedIndices.add(idx); status.unitLocked.push(tempHand[idx]); }
        }
        lockedTiles.push(...status.unitLocked);
    }
    
    for (let i = 0; i < tempHand.length; i++) { if (!consumedIndices.has(i)) unlockedTiles.push(tempHand[i]); }
    
    myLocalHand = [...lockedTiles, ...unlockedTiles];
    currentLockedIndices.clear();
    for(let i = 0; i < lockedTiles.length; i++) { currentLockedIndices.add(i); }
}

function sortMyHand() { myLocalHand.sort((a, b) => (SORT_ORDER[a] ?? 999) - (SORT_ORDER[b] ?? 999)); reorderLockedTilesToLeft(); renderHand(isMyTurnNow); }

function createTileElement(tileText, isHand = false, onClick = null) {
    const div = document.createElement('div'); div.className = 'mahjong-tile';
    if(!tileText) return div;
    if(tileText.includes('ｵｰﾙﾏｲﾃｨ') || tileText === 'P（ｼﾞｮｰｶｰ）') div.classList.add('almighty');
    if(tileText === '青葉美咲' || tileText === '音無小鳥') div.classList.add('clerk');
    
    let displayText = tileText;
    if(tileText === 'Prｵｰﾙﾏｲﾃｨ') displayText = 'Pr';
    else if(tileText === 'Faｵｰﾙﾏｲﾃｨ') displayText = 'Fa';
    else if(tileText === 'Anｵｰﾙﾏｲﾃｨ') displayText = 'An';
    else if(tileText === 'P（ｼﾞｮｰｶｰ）') displayText = 'P';
    
    const img = document.createElement('img');
    img.src = `idol_images/${tileText}.png`;
    img.alt = displayText;
    
    img.onerror = function() {
        this.style.display = 'none';
        const span = document.createElement('span');
        span.className = 'tile-text';
        span.innerText = displayText;
        div.appendChild(span);
    };
    
    div.appendChild(img);
    if(onClick) { div.onclick = onClick; div.style.cursor = 'pointer'; }
    return div;
}

function getRelPos(targetId) { return (targetId - myId + 4) % 4; }

function renderOtherHands() {
    for (let i = 1; i <= 3; i++) {
        const absId = (myId + i) % 4; 
        const div = document.getElementById(`hand-${i}`); div.innerHTML = '';
        
        const closedCount = globalHandLens[absId] || 0; 
        const openArr = globalOpenTiles[absId] || [];

        for (let j = 0; j < closedCount; j++) { 
            const tile = document.createElement('div'); tile.className = 'mahjong-tile facedown'; div.appendChild(tile); 
        }
        if (openArr.length > 0) {
            const spacer = document.createElement('div');
            spacer.style.width = '15px'; spacer.style.height = '15px';
            div.appendChild(spacer);
            for (let j = 0; j < openArr.length; j++) {
                const tile = createTileElement(openArr[j]); tile.classList.add('open-tile'); div.appendChild(tile);
            }
        }
    }
}

function getRemaining(req, visibleTiles) {
    let initialCount = (req.includes('ｵｰﾙﾏｲﾃｨ') || req === 'P（ｼﾞｮｰｶｰ）' || req === '青葉美咲' || req === '音無小鳥') ? 1 : 2;
    let seenCount = visibleTiles.filter(t => t === req).length;
    return Math.max(0, initialCount - seenCount);
}

function updateProgressUI() {
    const progressList = document.getElementById('progress-list'); progressList.innerHTML = '';
    
    let visibleTiles = [...myLocalHand];
    for(let i=0; i<4; i++) {
        if(globalOpenTiles[i]) visibleTiles.push(...globalOpenTiles[i]);
        if(discards[i]) visibleTiles.push(...discards[i]);
    }

    let tenpaiInfo = getTenpaiInfo(myLocalHand, globalOpenTiles[myId] || [], isMyTurnNow, myId);
    if (tenpaiInfo.length > 0) {
        let tenpaiDiv = document.createElement('div');
        tenpaiDiv.style.marginBottom = '15px';
        tenpaiDiv.style.padding = '10px';
        tenpaiDiv.style.background = '#fff3e0';
        tenpaiDiv.style.border = '2px solid #ff9800';
        tenpaiDiv.style.borderRadius = '6px';
        tenpaiDiv.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        
        let title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.style.color = '#e65100';
        title.style.marginBottom = '8px';
        title.style.fontSize = '14px';
        title.innerText = '★ 聴牌（テンパイ）ナビ';
        tenpaiDiv.appendChild(title);
        
        tenpaiInfo.forEach(info => {
            let waits = info.waits.filter(wObj => getRemaining(wObj.tile, visibleTiles) > 0);
            if (waits.length === 0) return; 
            
            let row = document.createElement('div');
            row.style.fontSize = '13px';
            row.style.marginBottom = '8px';
            row.style.borderBottom = '1px dashed #ffb74d';
            row.style.paddingBottom = '6px';
            
            let discardHtml = '';
            if (info.discard) {
                discardHtml = `<span style="background:#444; color:#fff; padding:2px 6px; border-radius:4px; font-weight:bold; margin-right:4px;">${info.discard} 切</span>`;
            } else {
                discardHtml = `<span style="background:#e65100; color:#fff; padding:2px 6px; border-radius:4px; font-weight:bold; margin-right:4px;">聴牌</span>`;
            }
            
            let waitHtmls = waits.map(wObj => {
                let w = wObj.tile;
                let rem = getRemaining(w, visibleTiles);
                let color = '#d32f2f';
                let fw = 'bold';
                let uNames = wObj.units.join(' / ');
                let hanText = `<span style="color:#d32f2f; font-weight:bold; margin-left:4px;">${wObj.rank} (${wObj.scoreVal}点)</span>`;
                return `<div style="margin-top:4px; display:flex; align-items:center; flex-wrap:wrap;"><span style="color:${color}; font-weight:${fw}; display:inline-block; background:#fff; padding:1px 4px; border-radius:3px; margin:0 4px 0 0; border:1px solid #ccc;">${w}(残${rem})</span><span style="font-size:11px; color:#555; display:inline-flex; align-items:center;">役: ${uNames} ${hanText}</span></div>`;
            }).join('');
            
            row.innerHTML = `<div style="margin-bottom:4px;">${discardHtml}</div><div style="padding-left:8px; line-height:1.4;">${waitHtmls}</div>`;
            tenpaiDiv.appendChild(row);
        });
        progressList.appendChild(tenpaiDiv);
    }

    let tempHand = [...myLocalHand];
    let consumedIndices = new Set();
    let lockedStatus = [];
    
    lockedUnits.forEach(unitName => {
        let unit = (typeof UNIT_BY_NAME !== "undefined" && UNIT_BY_NAME[unitName]) || OFFICIAL_UNITS.find(u => u.name === unitName); if (!unit) return;
        let missing = []; let matchCount = 0;
        for (let req of unit.members) {
            let idx = tempHand.findIndex((t, i) => t === req && !consumedIndices.has(i));
            if (idx !== -1) { consumedIndices.add(idx); matchCount++; }
            else { missing.push(req); }
        }
        lockedStatus.push({ unitName, unit, missing, matchCount });
    });
    
    let progressData = [];
    for (let status of lockedStatus) {
        let almCandidates = []; let canComplete = true; let tempConsumed = new Set(consumedIndices);
        let finalMissing = [];
        for (let req of status.missing) {
            let attrAlm = IDOLS.Princess.includes(req) ? "Prｵｰﾙﾏｲﾃｨ" : (IDOLS.Fairy.includes(req) ? "Faｵｰﾙﾏｲﾃｨ" : "Anｵｰﾙﾏｲﾃｨ");
            let idx = tempHand.findIndex((t, i) => t === attrAlm && !tempConsumed.has(i));
            if (idx !== -1) { tempConsumed.add(idx); almCandidates.push(idx); continue; }
            idx = tempHand.findIndex((t, i) => t === "P（ｼﾞｮｰｶｰ）" && !tempConsumed.has(i));
            if (idx !== -1) { tempConsumed.add(idx); almCandidates.push(idx); continue; }
            canComplete = false; break;
        }
        
        let potentialMatch = status.matchCount;
        if (canComplete) {
            potentialMatch = status.unit.members.length;
            finalMissing = [];
            for (let idx of almCandidates) { consumedIndices.add(idx); }
        } else {
            let availableAlms = [];
            for(let i=0; i<tempHand.length; i++) { if(!consumedIndices.has(i)) availableAlms.push({t: tempHand[i], i}); }
            for (let req of status.missing) {
                if (useAlmForProgress) {
                    let attrAlm = IDOLS.Princess.includes(req) ? "Prｵｰﾙﾏｲﾃｨ" : (IDOLS.Fairy.includes(req) ? "Faｵｰﾙﾏｲﾃｨ" : "Anｵｰﾙﾏｲﾃｨ");
                    let idx = availableAlms.findIndex(x => x.t === attrAlm);
                    if (idx !== -1) { availableAlms.splice(idx,1); potentialMatch++; continue; }
                    idx = availableAlms.findIndex(x => x.t === "P（ｼﾞｮｰｶｰ）");
                    if (idx !== -1) { availableAlms.splice(idx,1); potentialMatch++; continue; }
                }
                finalMissing.push(req);
            }
        }
        progressData.push({ name: status.unitName, match: potentialMatch, total: status.unit.members.length, ratio: potentialMatch / status.unit.members.length, isLocked: true, missing: finalMissing });
    }

    let remainingHand = [];
    for (let i = 0; i < tempHand.length; i++) { if (!consumedIndices.has(i)) remainingHand.push(tempHand[i]); }

    OFFICIAL_UNITS.forEach(unit => {
        if (lockedUnits.has(unit.name)) return; 
        
        let tempHandCopy = [...remainingHand];
        let missing = [];
        let matchCount = 0;
        for (let req of unit.members) {
            let idx = tempHandCopy.indexOf(req);
            if(idx !== -1) { tempHandCopy.splice(idx, 1); matchCount++; }
            else { missing.push(req); }
        }
        let finalMissing = [];
        for (let req of missing) {
            if (useAlmForProgress) {
                let attrAlm = IDOLS.Princess.includes(req) ? "Prｵｰﾙﾏｲﾃｨ" : (IDOLS.Fairy.includes(req) ? "Faｵｰﾙﾏｲﾃｨ" : "Anｵｰﾙﾏｲﾃｨ");
                let idx = tempHandCopy.indexOf(attrAlm);
                if (idx !== -1) { tempHandCopy.splice(idx, 1); matchCount++; continue; }
                idx = tempHandCopy.indexOf("P（ｼﾞｮｰｶｰ）");
                if (idx !== -1) { tempHandCopy.splice(idx, 1); matchCount++; continue; }
            }
            finalMissing.push(req);
        }

        let ratio = matchCount / unit.members.length;
        if (ratio > 0.50) progressData.push({ name: unit.name, match: matchCount, total: unit.members.length, ratio: ratio, isLocked: false, missing: finalMissing });
    });
    
    progressData.sort((a, b) => {
        let aComp = a.match === a.total ? 1 : 0;
        let bComp = b.match === b.total ? 1 : 0;
        if (aComp !== bComp) return bComp - aComp;
        if (aComp) return b.total - a.total; 
        if (b.ratio !== a.ratio) return b.ratio - a.ratio; 
        return b.total - a.total; 
    });

    if(progressData.length === 0 && tenpaiInfo.length === 0) { 
        progressList.innerHTML = '<div style="color:#666;">該当なし</div>'; 
        return; 
    }
    
    progressData.forEach(p => {
        let percent = Math.floor(p.ratio * 100);
        let div = document.createElement('div'); 
        div.className = 'progress-item' + (p.isLocked ? ' selected' : '');
        div.onclick = () => toggleLockUnit(p.name);
        div.onmouseenter = () => highlightUnit(p.name);
        div.onmouseleave = () => highlightUnit(null);

        let missingHtml = '';
        if (p.missing.length > 0) {
            let missingInfos = p.missing.map(req => {
                let rem = getRemaining(req, visibleTiles);
                let color = rem === 0 ? '#ff0000' : '#555';
                let fw = rem === 0 ? 'bold' : 'normal';
                return `<span style="color:${color}; font-weight:${fw}; display:inline-block; margin-right:6px; background:#eee; padding:2px 4px; border-radius:3px;">${req}(残${rem})</span>`;
            });
            missingHtml = `<div style="font-size:12px; margin-top:6px; line-height:1.4;">${missingInfos.join('')}</div>`;
        }

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:15px; font-weight:bold; margin-bottom:4px;">
                <span>${p.name}</span>
                <span>${p.match}/${p.total}</span>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percent}%;"></div></div>
            ${missingHtml}
        `;
        progressList.appendChild(div);
    });
}

function updateScores(scores) { 
    for(let i=0; i<4; i++) { 
        let rel = getRelPos(i); let box = document.getElementById(`score-box-${rel}`);
        if(box && globalPlayerNames[i]) {
            let nName = globalPlayerNames[i];
            let isDealer = (i === currentDealer);
            let dealerMark = isDealer ? '<span style="color:#ff7bac; font-weight:bold;">[親]</span> ' : '';
            let riichiMark = globalPlayerRiichi[i] ? '<span style="color:#ff5722; font-weight:bold;">[立直]</span> ' : '';
            
            box.innerHTML = `<span class="score-name">${dealerMark}${riichiMark}${nName}</span><span class="score-val">${scores[i]}</span>`;
            
            if (i === clientCurrentTurn) {
                box.classList.add('active-turn');
            } else {
                box.classList.remove('active-turn');
            }
        }
    } 
}

let lastAskCouldRon = false;

function startActionTimer() {
    let timeLeft = ACTION_LIMIT_SEC; 
    document.getElementById('action-msg-text').innerHTML = `アクション <span id="action-timer" style="color:red; font-size:18px;">${timeLeft}</span>秒`;
    clearInterval(actionTimerInterval);
    
    actionTimerInterval = setInterval(() => {
        timeLeft--; 
        let timerEl = document.getElementById('action-timer');
        if (timerEl) timerEl.innerText = timeLeft;
        if (timeLeft <= 0) { sendAction('SKIP'); hideActions(); }
    }, 1000);
}

function startDiscardTimer() {
    let timeLeft = DISCARD_LIMIT_SEC; 
    document.getElementById('action-bar').style.display = 'flex';
    document.getElementById('action-msg-text').innerHTML = `捨てる牌を選択 <span id="action-timer" style="color:red; font-size:18px;">${timeLeft}</span>秒`;
    document.getElementById('btn-tsumo').style.display = 'none';
    document.getElementById('btn-ron').style.display = 'none';
    let nakiContainer = document.getElementById('naki-buttons-container');
    if (nakiContainer) nakiContainer.innerHTML = '';
    document.getElementById('btn-skip').style.display = 'none';
    
    clearInterval(actionTimerInterval);
    actionTimerInterval = setInterval(() => {
        timeLeft--; 
        let timerEl = document.getElementById('action-timer');
        if (timerEl) timerEl.innerText = timeLeft;
        if (timeLeft <= 0) { 
            clearInterval(actionTimerInterval); 
            isPendingRiichi = false;
            autoDiscard(); 
        }
    }, 1000);
}

function autoDiscard() {
    let unlocked = getUnlockedHand();
    if (unlocked.length > 0) {
        sendAction('DISCARD', { tile: unlocked[unlocked.length - 1], isRiichi: false });
    } else {
        sendAction('DISCARD', { tile: myLocalHand[myLocalHand.length - 1], isRiichi: false });
    }
    hideActions();
}

function handleHostMsg(data) {
    if (data.handLens) globalHandLens = data.handLens;
    if (data.openTiles) globalOpenTiles = data.openTiles;
    if (data.playerRiichi) globalPlayerRiichi = data.playerRiichi;
    if (data.riichiDiscardIndex) globalRiichiDiscardIndex = data.riichiDiscardIndex;
    if (data.riichiSticks !== undefined) {
        globalRiichiSticks = data.riichiSticks;
        document.getElementById('riichi-sticks-count').innerText = globalRiichiSticks;
    }
    
    if (data.scores) {
        playerScores = data.scores;
        updateScores(data.scores);
    }

    if (data.type === 'ACTION_TOAST') {
        showActionToast(data.text, data.actionType);
    }
    if (data.type === 'AGARI_REJECTED') {
        restoreTurnAfterRejectedAgari();
    }

    if(data.type === 'START_KYOKU') {
        hideWaitOverlay();
        const dov = document.getElementById('disconnect-overlay');
        if (dov) dov.style.display = 'none';
        globalPlayerNames = data.names; document.getElementById('result-overlay').style.display = 'none';
        myId = data.pId; myLocalHand = data.hand; roleMap = data.roles; lockedUnits.clear(); currentLockedIndices.clear();
        currentDealer = data.dealer;
        clientCurrentTurn = data.dealer;
        discards = [[],[],[],[]];
        localSkipFuriten = false;
        lastAskCouldRon = false;
        selectedHandIdx = -1;
        
        document.getElementById('setup-panel').style.display = 'none'; 
        document.getElementById('app-container').style.display = 'flex'; 
        document.getElementById('deck-count').innerText = data.deckLen; document.getElementById('round-info').innerText = `${ROUND_NAMES[data.bakaze]}${data.kyoku}局`;
        isMyTurnNow = false; isPendingRiichi = false; document.getElementById('action-status').style.visibility = 'hidden';
        document.getElementById('river-0').innerHTML=''; document.getElementById('river-1').innerHTML=''; document.getElementById('river-2').innerHTML=''; document.getElementById('river-3').innerHTML='';
        reorderLockedTilesToLeft(); renderHand(false); renderOtherHands();
        updateScores(playerScores);
        requestAnimationFrame(() => { layoutTable(); setTimeout(layoutTable, 80); });
    }
    
    if(data.type === 'TURN_CHANGE') { 
        document.getElementById('action-status').style.visibility = 'hidden'; 
        document.getElementById('deck-count').innerText = data.deckLen; 
        clientCurrentTurn = data.turn; 
        
        if(data.turn !== myId) { isMyTurnNow = false; renderHand(false); } 
        renderOtherHands(); 
        updateScores(playerScores); 
    }
    
    if(data.type === 'DRAWN_TILE') {
        if (!globalPlayerRiichi[myId]) localSkipFuriten = false;
        myLocalHand.push(data.tile); reorderLockedTilesToLeft(); isMyTurnNow = true; renderHand(true); 
        showActionToast('あなたの番です', 'turn'); 
        
        let fullHand = [...myLocalHand, ...(globalOpenTiles[myId] || [])];
        let globalMemo = {};
        let agariCheck = checkAgari(fullHand, globalMemo);
        
        if(agariCheck.isValid) { 
            let isClosed = (globalOpenTiles[myId] || []).length === 0;
            let isDealer = (myId === currentDealer);
            let scoreInfo = scoreHand(agariCheck.units, fullHand, globalOpenTiles[myId] || [], data.tile, isClosed, globalPlayerRiichi[myId], true, isDealer);
            
            if (scoreInfo.han > 0) {
                document.getElementById('action-bar').style.display = 'flex'; 
                document.getElementById('action-msg-text').innerHTML = `ツモできます`; 
                document.getElementById('btn-tsumo').style.display = 'inline-block'; 
                document.getElementById('btn-ron').style.display = 'none'; 
                document.getElementById('btn-skip').style.display = 'none'; 
                document.getElementById('btn-riichi').style.display = 'none';
                let nakiContainer = document.getElementById('naki-buttons-container');
                if(nakiContainer) nakiContainer.innerHTML = '';
                return;
            }
        }
        
        if (globalPlayerRiichi[myId]) {
            setTimeout(() => { 
                if(isMyTurnNow) { hideActions(); sendAction('DISCARD', { tile: data.tile, isRiichi: false }); }
            }, 800);
        } else {
            if ((globalOpenTiles[myId] || []).length === 0 && playerScores[myId] >= 1000) {
                let tInfo = getTenpaiInfo(myLocalHand, [], true, myId);
                let validWaits = tInfo.filter(t => t.waits.length > 0);
                if (validWaits.length > 0) {
                    validRiichiDiscards = validWaits.map(w => w.discard);
                    document.getElementById('action-bar').style.display = 'flex';
                    document.getElementById('action-msg-text').innerHTML = `リーチ可能です`;
                    document.getElementById('btn-riichi').style.display = 'inline-block';
                }
            }
        }
    }
    
    if(data.type === 'DISCARDED') {
        if (data.discards) discards = data.discards;
        if(data.pIdx === myId) { 
            clearInterval(actionTimerInterval); document.getElementById('action-status').style.visibility = 'hidden';
            let idx = myLocalHand.indexOf(data.tile); if (idx !== -1) myLocalHand.splice(idx, 1); 
            isMyTurnNow = false; reorderLockedTilesToLeft(); renderHand(false); 
        }
        const list = data.discards[data.pIdx]; const div = document.getElementById(`river-${getRelPos(data.pIdx)}`); div.innerHTML = '';
        list.forEach((tile, idx) => { 
            let el = createTileElement(tile);
            if (idx === globalRiichiDiscardIndex[data.pIdx]) el.classList.add('riichi-discard');
            div.appendChild(el); 
        }); renderOtherHands();
    }

    if(data.type === 'DISCARD_REMOVED') {
        if (data.discards) discards = data.discards;
        const list = data.discards[data.pIdx]; const div = document.getElementById(`river-${getRelPos(data.pIdx)}`); div.innerHTML = '';
        list.forEach((tile, idx) => { 
            let el = createTileElement(tile);
            if (idx === globalRiichiDiscardIndex[data.pIdx]) el.classList.add('riichi-discard');
            div.appendChild(el); 
        }); renderOtherHands();
    }

    if(data.type === 'WAITING_ACTION') { 
        const statusEl = document.getElementById('action-status');
        statusEl.innerText = '他家アクション待機中...'; statusEl.style.color = '#ffeb3b'; statusEl.style.visibility = 'visible'; 
    }
    if(data.type === 'CLERK_EFFECT') { document.getElementById('deck-count').innerText = data.deckLen; renderOtherHands(); }
    if(data.type === 'CLERK_DRAW') { myLocalHand.push(...data.drawn); reorderLockedTilesToLeft(); isMyTurnNow = true; renderHand(true); showActionToast('あなたの番です', 'turn'); }
    if(data.type === 'TURN_CONTINUE') { 
        clientCurrentTurn = data.pIdx; updateScores(playerScores);
        if(data.pIdx === myId) { isMyTurnNow = true; renderHand(true); showActionToast('あなたの番です', 'turn'); } 
        renderOtherHands(); 
    }
    
    if(data.type === 'ASK_ACTION') {
        if(data.discarder !== myId && roleMap[myId] !== 'CPU') {
            let fullHand = [...myLocalHand, ...(globalOpenTiles[myId] || []), data.tile];
            let globalMemo = {};
            let agariCheck = checkAgari(fullHand, globalMemo);
            let canRon = false;
            
            if (agariCheck.isValid) {
                let isClosed = (globalOpenTiles[myId] || []).length === 0;
                let isDealer = (myId === currentDealer);
                let scoreInfo = scoreHand(agariCheck.units, fullHand, globalOpenTiles[myId] || [], data.tile, isClosed, globalPlayerRiichi[myId], false, isDealer);
                if (scoreInfo.han > 0) canRon = true;
            }
            if (canRon && clientIsFuriten()) canRon = false;
            lastAskCouldRon = canRon;
            
            let unlocked = getUnlockedHand();
            let nakiUnits = globalPlayerRiichi[myId] ? null : checkCanNaki(unlocked, data.tile);

            if (canRon || nakiUnits) {
                document.getElementById('action-bar').style.display = 'flex';
                document.getElementById('action-msg-text').innerHTML = `アクション <span id="action-timer" style="color:red; font-size:18px;">${ACTION_LIMIT_SEC}</span>秒`;
                document.getElementById('btn-tsumo').style.display = 'none';
                document.getElementById('btn-riichi').style.display = 'none';
                document.getElementById('btn-skip').style.display = 'inline-block';
                document.getElementById('btn-ron').style.display = canRon ? 'inline-block' : 'none';
                
                let nakiContainer = document.getElementById('naki-buttons-container');
                if(!nakiContainer) {
                    nakiContainer = document.createElement('span');
                    nakiContainer.id = 'naki-buttons-container';
                    document.getElementById('action-bar').insertBefore(nakiContainer, document.getElementById('btn-skip'));
                }
                nakiContainer.innerHTML = '';
                
                if (nakiUnits) {
                    nakiUnits.forEach(u => {
                        let btn = document.createElement('button');
                        btn.className = 'btn';
                        btn.style.background = '#ff9800';
                        btn.style.marginRight = '5px';
                        btn.innerText = `${u}でスカウト`;
                        btn.onclick = () => { sendAction('NAKI', u); hideActions(); };
                        btn.onmouseenter = () => highlightNakiUnit(u, data.tile);
                        btn.onmouseleave = () => highlightUnit(null);
                        nakiContainer.appendChild(btn);
                    });
                }
                startActionTimer();
            } else {
                sendAction('SKIP'); 
            }
        }
    }

    if(data.type === 'NAKI_TURN') {
        document.getElementById('action-status').style.visibility = 'hidden';
        myLocalHand = data.hand; 
        if(data.unitName) lockedUnits.add(data.unitName); 
        reorderLockedTilesToLeft(); isMyTurnNow = true; renderHand(true); showActionToast('あなたの番です', 'turn');
        let fullHand = [...myLocalHand, ...(globalOpenTiles[myId] || [])];
        
        let globalMemo = {};
        let agariCheck = checkAgari(fullHand, globalMemo);
        if(agariCheck.isValid) { 
            let isClosed = (globalOpenTiles[myId] || []).length === 0;
            let isDealer = (myId === currentDealer);
            let scoreInfo = scoreHand(agariCheck.units, fullHand, globalOpenTiles[myId] || [], null, isClosed, globalPlayerRiichi[myId], false, isDealer);
            
            if (scoreInfo.han > 0) {
                document.getElementById('action-bar').style.display = 'flex'; 
                document.getElementById('action-msg-text').innerHTML = `ツモできます`; 
                document.getElementById('btn-tsumo').style.display = 'inline-block'; 
                document.getElementById('btn-ron').style.display = 'none'; 
                document.getElementById('btn-skip').style.display = 'none'; 
                document.getElementById('btn-riichi').style.display = 'none';
                let nakiContainer = document.getElementById('naki-buttons-container');
                if (nakiContainer) nakiContainer.innerHTML = ''; 
                return;
            }
        }
        startDiscardTimer();
    }
    
    if(data.type === 'KYOKU_OVER') {
        hideActions(); updateScores(data.scores); document.getElementById('action-status').style.visibility = 'hidden';
        document.getElementById('btn-endmatch').style.display = 'none';
        
        if (data.isRyukyoku) {
            document.getElementById('result-winner').innerText = `流局`; 
            document.getElementById('result-hand').innerHTML = ''; 
            const extra = (data.ryukyokuLines && data.ryukyokuLines.length)
                ? data.ryukyokuLines.join('<br>')
                : '山札が尽きました';
            const ren = data.dealerRenchan ? '<br>親テンパイのため連荘' : '';
            document.getElementById('result-yaku').innerHTML = extra + ren; 
            document.getElementById('result-score-text').innerText = ''; 
            document.getElementById('btn-next-kyoku').style.display = 'inline-block';
            document.getElementById('next-kyoku-msg').style.display = 'none';
            document.getElementById('result-overlay').style.display = 'flex';
        } else {
            const pName = globalPlayerNames[data.pIdx];
            showCutin(data.isTsumo ? 'ツモ！' : 'ロン！', data.isTsumo ? '#4aa9e6' : '#ff0055');
            setTimeout(() => {
                document.getElementById('result-winner').innerText = `${pName} のアガリ！`;
                
                const resultHandDiv = document.getElementById('result-hand'); 
                resultHandDiv.innerHTML = '';
                
                let groupedHand = formatResultHand(data.hand, data.units);
                groupedHand.forEach(group => {
                    let groupWrap = document.createElement('div');
                    groupWrap.style.display = 'flex';
                    groupWrap.style.gap = '2px';
                    groupWrap.style.margin = '4px';
                    groupWrap.style.padding = '4px 6px';
                    groupWrap.style.background = 'rgba(0,0,0,0.4)';
                    groupWrap.style.borderRadius = '8px';
                    groupWrap.style.border = '1px solid #555';
                    
                    group.forEach(tile => {
                        let el = createTileElement(tile, true);
                        groupWrap.appendChild(el);
                    });
                    resultHandDiv.appendChild(groupWrap);
                });

                document.getElementById('result-yaku').innerHTML = data.score.details.join('<br>'); 
                document.getElementById('result-score-text').innerText = `${data.score.rank} ${data.score.score}点`; 
                document.getElementById('btn-next-kyoku').style.display = 'inline-block';
                document.getElementById('next-kyoku-msg').style.display = 'none';
                document.getElementById('result-overlay').style.display = 'flex';
            }, 1200);
        }
    }

    if(data.type === 'MATCH_OVER') {
        document.getElementById('result-winner').innerText = data.reason === 'tobi' ? '飛び終了！' : '試合終了！';
        document.getElementById('result-hand').innerHTML = '';
        let rankHtml = "最終スコア<br><br>";
        let ranks = [0,1,2,3].map(i => ({ id: i, score: data.scores[i], name: globalPlayerNames[i] }));
        ranks.sort((a,b) => b.score - a.score); ranks.forEach((r, idx) => { rankHtml += `${idx+1}位: ${r.name} - ${r.score}点<br>`; });
        document.getElementById('result-yaku').innerHTML = rankHtml; document.getElementById('result-score-text').innerText = ''; 
        document.getElementById('btn-next-kyoku').style.display = 'none';
        document.getElementById('next-kyoku-msg').style.display = 'none';
        document.getElementById('btn-endmatch').style.display = 'inline-block'; 
        document.getElementById('result-overlay').style.display = 'flex';
    }
    if(data.type === 'MSG') logM(data.msg);
}

function renderHand(isMyTurn) {
    const div = document.getElementById('my-hand-area'); div.innerHTML = '';
    myLocalHand.forEach((tile, idx) => {
        let isLocked = currentLockedIndices.has(idx);
        let isClickable = isMyTurn && !isLocked;
        
        if (globalPlayerRiichi[myId]) {
            isClickable = false;
        }

        if (isPendingRiichi && !validRiichiDiscards.includes(tile)) {
            isClickable = false;
        }

        let el = createTileElement(tile, true, null);
        if (isClickable) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (ev) => {
                ev.preventDefault();
                if (isCoarsePointer()) {
                    if (selectedHandIdx === idx) discardFromHand(tile);
                    else { selectedHandIdx = idx; renderHand(isMyTurnNow); }
                } else {
                    discardFromHand(tile);
                }
            });
        }
        if (selectedHandIdx === idx) el.classList.add('tile-selected');
        
        if (isLocked) {
            el.classList.add('locked-tile'); el.style.cursor = 'default';
        } else if (!isCoarsePointer()) {
            el.draggable = true;
            el.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(idx)); el.style.opacity = '0.5'; };
            el.ondragend = () => { el.style.opacity = '1'; };
            el.ondragover = (e) => { e.preventDefault(); };
            el.ondrop = (e) => { e.preventDefault(); let fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10); if(isNaN(fromIdx) || fromIdx === idx) return; let movingTile = myLocalHand.splice(fromIdx, 1)[0]; myLocalHand.splice(idx, 0, movingTile); selectedHandIdx = -1; reorderLockedTilesToLeft(); renderHand(isMyTurnNow); };
        }
        
        if(!isClickable) el.classList.add('disabled'); 
        div.appendChild(el);
    });
    
    let myOpen = globalOpenTiles[myId] || [];
    if (myOpen.length > 0) {
        let spacer = document.createElement('div'); spacer.style.width = '20px'; div.appendChild(spacer);
        myOpen.forEach(tile => {
            let el = createTileElement(tile, true);
            el.classList.add('open-tile'); el.style.cursor = 'default';
            div.appendChild(el);
        });
    }
    
    clearTimeout(window._progressTimer);
    window._progressTimer = setTimeout(() => {
        updateProgressUI();
    }, 10);
}

function hideActions() { 
    clearInterval(actionTimerInterval); 
    document.getElementById('action-bar').style.display = 'none'; 
    document.getElementById('btn-tsumo').style.display = 'none'; 
    document.getElementById('btn-ron').style.display = 'none'; 
    document.getElementById('btn-skip').style.display = 'none'; 
    document.getElementById('btn-riichi').style.display = 'none';
    isPendingRiichi = false;
    let btnRiichi = document.getElementById('btn-riichi');
    if (btnRiichi) btnRiichi.style.background = '#ff9800';
    let nakiContainer = document.getElementById('naki-buttons-container');
    if (nakiContainer) nakiContainer.innerHTML = '';
    highlightUnit(null);
}

window.addEventListener('resize', () => {
    document.documentElement.style.setProperty('--app-h', (window.visualViewport ? window.visualViewport.height : window.innerHeight) + 'px');
});
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        document.documentElement.style.setProperty('--app-h', window.visualViewport.height + 'px');
    });
}

window.addEventListener('resize', () => requestAnimationFrame(layoutTable));
window.addEventListener('orientationchange', () => setTimeout(layoutTable, 200));
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => requestAnimationFrame(layoutTable));
}