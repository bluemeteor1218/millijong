// ==========================================
// ミリオン麻雀 13枚用・点数計算ロジック (score.js)
// ==========================================

function calculateMahjongScore(units, fullHand, openTiles, agariTile, isClosed, isRiichi, isTsumo, isDealer, OFFICIAL_UNITS) {
    // 1. 手牌のユニットを「人数の多い順」に並び替える
    let unitDetails = units.map(uName => {
        let data = OFFICIAL_UNITS.find(o => o.name === uName);
        return { name: uName, len: data ? data.members.length : 0, originalMembers: data ? data.members : [] };
    }).sort((a, b) => b.len - a.len);

    let details = [];
    let han = 0;
    let fu = 20; // 副底 (ベースの符)

    // --------------------------------------------------
    // A. 基準翻数の計算（最大のユニットから算出）
    // --------------------------------------------------
    let maxUnit = unitDetails[0];
    let baseHan = 0;
    
    // 3人以下は1翻、以降は (人数-2) が基本翻数。13人(MTS等)なら13翻(役満)扱い
    if (maxUnit.len <= 3) baseHan = 1;
    else if (maxUnit.len >= 13) baseHan = 13;
    else baseHan = maxUnit.len - 2; 
    
    details.push(`メイン: ${maxUnit.name} (${baseHan}翻)`);
    han += baseHan;

    // --------------------------------------------------
    // B. 加算符数の計算（残りのユニットの形から算出）
    // --------------------------------------------------
    let tempOpen = [...openTiles];
    let isAgariTileUsed = false;
    
    let remainingUnits = unitDetails.slice(1);
    
    remainingUnits.forEach(u => {
        // 明暗（鳴きか門前か）の判定
        let isOpenUnit = false;
        let matchCount = 0;
        u.originalMembers.forEach(req => {
            let idx = tempOpen.indexOf(req);
            if (idx !== -1) { matchCount++; tempOpen.splice(idx, 1); }
        });
        
        // 鳴き牌を使用している、またはロン牌で完成した部分は明扱い
        if (matchCount > 0 && matchCount >= Math.floor(u.len / 2)) {
            isOpenUnit = true; 
        } else if (!isTsumo && !isAgariTileUsed && u.originalMembers.includes(agariTile)) {
            isOpenUnit = true; 
            isAgariTileUsed = true;
        }

        // 人数と明暗による符の割り当て
        let uFu = 0;
        if (u.len === 2)      uFu = 0; // 順子・雀頭相当
        else if (u.len === 3) uFu = isOpenUnit ? 2 : 4;   // 明刻2符 / 暗刻4符
        else if (u.len === 4) uFu = isOpenUnit ? 4 : 8;   // 明槓4符 / 暗槓8符
        else if (u.len === 5) uFu = isOpenUnit ? 8 : 16;  // 5人ユニット
        else if (u.len >= 6)  uFu = isOpenUnit ? 16 : 32; // 超大型ユニット
        
        if (uFu > 0) {
            fu += uFu;
            details.push(`サブ: ${u.name} (+${uFu}符)`);
        } else {
            details.push(`サブ: ${u.name} (+0符)`);
        }
    });

    // 待ち・アガリ方の符加算
    if (isClosed && !isTsumo) { fu += 10; details.push("門前ロン (+10符)"); }
    if (isTsumo) { fu += 2; details.push("ツモ (+2符)"); }
    
    // 符の切り上げ (例: 32符 -> 40符)
    fu = Math.ceil(fu / 10) * 10;
    if (fu === 20 && !isTsumo) fu = 30; // 鳴きロンの最低保証は30符

    // --------------------------------------------------
    // C. 状況役・ボーナスの加算
    // --------------------------------------------------
    if (isRiichi) { han += 1; details.push("リーチ (+1翻)"); }
    if (isClosed && isTsumo) { han += 1; details.push("門前清自摸和 (+1翻)"); }
    
    let usedJoker = fullHand.some(t => t === "P（ｼﾞｮｰｶｰ）" || t.includes("ｵｰﾙﾏｲﾃｨ"));
    if (!usedJoker) { han += 1; details.push("純愛/ジョーカーなし (+1翻)"); }

    // 役なし判定
    if (han === 0) return { han: 0, fu: 0, details: ["役なし"], rank: "役なし", score: 0, payAll: 0, payDealer: 0, payChild: 0 };

    // --------------------------------------------------
    // D. 最終打点（満貫等）の計算
    // --------------------------------------------------
    let rank = "";
    let basePoint = 0;

    if (han >= 13) { rank = "役満"; basePoint = 8000; }
    else if (han >= 11) { rank = "三倍満"; basePoint = 6000; }
    else if (han >= 8) { rank = "倍満"; basePoint = 4000; }
    else if (han >= 6) { rank = "跳満"; basePoint = 3000; }
    else {
        basePoint = fu * Math.pow(2, 2 + han); // 符 × 2^(2+翻)
        if (basePoint >= 2000) { rank = "満貫"; basePoint = 2000; }
        else { rank = `${han}翻 ${fu}符`; }
    }

    let totalScore = 0, payAll = 0, payDealer = 0, payChild = 0;
    if (isDealer) {
        totalScore = Math.ceil((basePoint * 6) / 100) * 100;
        payAll = Math.ceil((basePoint * 2) / 100) * 100; 
    } else {
        totalScore = Math.ceil((basePoint * 4) / 100) * 100;
        payDealer = Math.ceil((basePoint * 2) / 100) * 100; 
        payChild = Math.ceil(basePoint / 100) * 100;        
    }

    details.push(`【 ${rank} 】`);

    return { 
        han, fu, details, rank, 
        score: totalScore, payAll, payDealer, payChild 
    };
}
