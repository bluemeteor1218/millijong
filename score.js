// ==========================================
// 麻雀 点数計算ロジック (score.js)
//
// ユニット役:
//   基本翻数 = 人数 - 2
//   手牌のうち「人数が最大のユニット」1つの翻だけを採用
//   それ以外のユニットは人数の組み合わせで符を加算
//
// 呼び出し:
//   calculateMahjongScore(units, hand, openTiles, agariTile, isClosed, isRiichi, isTsumo, isDealer, OFFICIAL_UNITS)
// 旧シグネチャも受け付ける:
//   calculateMahjongScore(units, hand, isClosed, isRiichi, isTsumo, isDealer, OFFICIAL_UNITS)
// ==========================================

function _scoreIsClosedFlag(openTiles, isClosed) {
    if (typeof isClosed === 'boolean') return isClosed;
    return !openTiles || openTiles.length === 0;
}

function _unitTable(official) {
    return official || (typeof OFFICIAL_UNITS !== 'undefined' ? OFFICIAL_UNITS : []);
}

function _attrOfIdol(name) {
    if (typeof IDOLS === 'undefined') return null;
    if (IDOLS.Princess.includes(name)) return 'Pr';
    if (IDOLS.Fairy.includes(name)) return 'Fa';
    if (IDOLS.Angel.includes(name)) return 'An';
    return null;
}

function _canFillFrom(poolSrc, members) {
    const pool = {};
    for (let i = 0; i < poolSrc.length; i++) {
        const t = poolSrc[i];
        pool[t] = (pool[t] || 0) + 1;
    }
    const take = (name) => {
        if (pool[name] > 0) { pool[name]--; return true; }
        return false;
    };
    for (let i = 0; i < members.length; i++) {
        const req = members[i];
        if (take(req)) continue;
        const attr = _attrOfIdol(req);
        if (attr && take(attr + 'ｵｰﾙﾏｲﾃｨ')) continue;
        if (take('P（ｼﾞｮｰｶｰ）')) continue;
        return false;
    }
    return true;
}

// 基本翻数 = 人数 - 2（2人ユニットは0翻）
function unitBaseHan(len) {
    return Math.max(0, len - 2);
}

// メイン役以外の1ユニットが持つ符
function unitComboFu(len, isOpen) {
    if (len <= 2) return 0;                 // 2人: 順子相当
    if (len === 3) return isOpen ? 2 : 4;   // 3人: 刻子相当
    if (len === 4) return isOpen ? 8 : 16;  // 4人: 槓相当
    if (len === 5) return isOpen ? 16 : 32; // 5人: 大刻子相当
    return isOpen ? 16 : 32;
}

function calculateMahjongScore(units, hand, a, b, c, d, e, f, g) {
    let openTiles = [];
    let agariTile = null;
    let isClosed, isRiichi, isTsumo, isDealer, official;

    if (typeof a === 'boolean' || a == null) {
        isClosed = !!a;
        isRiichi = !!b;
        isTsumo = !!c;
        isDealer = !!d;
        official = _unitTable(e);
    } else {
        openTiles = Array.isArray(a) ? a : [];
        agariTile = b;
        isClosed = _scoreIsClosedFlag(openTiles, c);
        isRiichi = !!d;
        isTsumo = !!e;
        isDealer = !!f;
        official = _unitTable(g);
    }

    let han = 0;
    let fu = 20;
    let details = [];

    if (isRiichi) { han += 1; details.push('リーチ (1翻)'); }
    if (isClosed && !isTsumo) { fu += 10; details.push('門前ロン (+10符)'); }
    if (isTsumo) {
        if (isClosed) { han += 1; details.push('門前清自摸和 (1翻)'); }
        fu += 2;
        details.push('ツモ (+2符)');
    }

    const usedWild = (hand || []).some(t => t === 'P（ｼﾞｮｰｶｰ）' || (typeof t === 'string' && t.includes('ｵｰﾙﾏｲﾃｨ')));
    if (!usedWild) { han += 2; details.push('純愛(ワイルド不使用) (2翻)'); }

    const openPool = isClosed ? [] : openTiles.slice();
    const parsed = [];
    (units || []).forEach(uName => {
        const unitData = official.find(o => o.name === uName);
        if (!unitData) return;
        const len = unitData.members.length;
        const isOpenUnit = !isClosed && _canFillFrom(openPool, unitData.members);
        if (isOpenUnit) {
            unitData.members.forEach(m => {
                const idx = openPool.indexOf(m);
                if (idx !== -1) openPool.splice(idx, 1);
            });
        }
        parsed.push({ name: uName, len, isOpen: isOpenUnit, baseHan: unitBaseHan(len) });
    });

    let mainIdx = -1;
    let maxLen = -1;
    for (let i = 0; i < parsed.length; i++) {
        if (parsed[i].len > maxLen) {
            maxLen = parsed[i].len;
            mainIdx = i;
        }
    }

    if (mainIdx >= 0) {
        const main = parsed[mainIdx];
        han += main.baseHan;
        const mark = main.isOpen ? '明' : '暗';
        details.push(`メイン役 ${main.name} (${main.len}人=${main.baseHan}翻/${mark})`);
    }

    const others = parsed.filter((_, i) => i !== mainIdx);
    if (others.length > 0) {
        const comboLabel = others.map(o => o.len + '人').join('+');
        let comboFu = 0;
        others.forEach(o => {
            const add = unitComboFu(o.len, o.isOpen);
            comboFu += add;
            const mark = o.isOpen ? '明' : '暗';
            details.push(`${o.name} (${o.len}人/${mark} ${add}符)`);
        });
        fu += comboFu;
        details.push(`その他の構成 ${comboLabel} → ${comboFu}符`);
    }

    fu = Math.ceil(fu / 10) * 10;
    if (fu === 20 && !isTsumo) fu = 30;

    if (han === 0) {
        return { han: 0, fu: 0, details: ['役なし'], rank: '役なし', score: 0, payAll: 0, payDealer: 0, payChild: 0 };
    }

    let rank = '';
    let basePoint = 0;
    if (han >= 13) { rank = '役満'; basePoint = 8000; }
    else if (han >= 11) { rank = '三倍満'; basePoint = 6000; }
    else if (han >= 8) { rank = '倍満'; basePoint = 4000; }
    else if (han >= 6) { rank = '跳満'; basePoint = 3000; }
    else {
        basePoint = fu * Math.pow(2, 2 + han);
        if (basePoint >= 2000) { rank = '満貫'; basePoint = 2000; }
        else { rank = `${han}翻 ${fu}符`; }
    }

    let totalScore = 0;
    let payAll = 0, payDealer = 0, payChild = 0;
    if (isDealer) {
        totalScore = Math.ceil((basePoint * 6) / 100) * 100;
        payAll = Math.ceil((basePoint * 2) / 100) * 100;
    } else {
        totalScore = Math.ceil((basePoint * 4) / 100) * 100;
        payDealer = Math.ceil((basePoint * 2) / 100) * 100;
        payChild = Math.ceil(basePoint / 100) * 100;
    }

    details.push(`【 ${rank} 】`);
    return { han, fu, details, rank, score: totalScore, payAll, payDealer, payChild };
}