// ==========================================
// 麻雀 点数計算ロジック (score.js)
// ==========================================

function calculateMahjongScore(units, fullHand, openTiles, agariTile, isClosed, isRiichi, isTsumo, isDealer, OFFICIAL_UNITS) {
    let han = 0;
    let fu = 20; // 副底 (ベースの符)
    let details = [];

    // 1. 状況役の判定
    if (isRiichi) { han += 1; details.push("リーチ (1翻)"); }
    if (isClosed && isTsumo) { han += 1; details.push("門前清自摸和 (1翻)"); }
    
    // 基本の符加算
    if (isClosed && !isTsumo) { fu += 10; details.push("門前ロン (+10符)"); }
    if (isTsumo) { fu += 2; details.push("ツモ (+2符)"); }
    fu += 2; // 待ち符（ユニット待ちを一律カンチャン・単騎相当とする）

    // 2. ジョーカーなしボーナス (ハネすぎ防止のため1翻に減少)
    let usedJoker = fullHand.some(t => t === "P（ｼﾞｮｰｶｰ）" || t.includes("ｵｰﾙﾏｲﾃｨ"));
    if (!usedJoker) { han += 1; details.push("純愛/ジョーカー不使用 (1翻)"); }

    // 3. ユニットごとの人数による翻・符の細かな調整
    let tempOpen = [...openTiles];
    let isAgariTileUsed = false;
    
    units.forEach(uName => {
        let unitData = OFFICIAL_UNITS.find(o => o.name === uName);
        if (!unitData) return;
        
        let len = unitData.members.length;
        
        // 翻数の計算（2人=0翻, 3人=1翻, 4人=2翻...）
        let uHan = Math.max(0, len - 2);
        han += uHan;
        if (uHan > 0) details.push(`${uName} (${uHan}翻)`);
        else details.push(`${uName} (0翻)`);
        
        // 明ユニット（鳴いた牌）か暗ユニット（手牌）かの推測判定
        let isOpenUnit = false;
        let matchCount = 0;
        unitData.members.forEach(req => {
            let idx = tempOpen.indexOf(req);
            if (idx !== -1) {
                matchCount++;
                tempOpen.splice(idx, 1);
            }
        });
        
        if (matchCount > 0 && matchCount >= Math.floor(len / 2)) {
            isOpenUnit = true; // 鳴き牌を半分以上使っていれば明ユニットとみなす
        } else if (!isTsumo && !isAgariTileUsed && unitData.members.includes(agariTile)) {
            isOpenUnit = true; // ロン牌を使ったユニットは明扱い（明刻/明槓相当）
            isAgariTileUsed = true;
        }
        
        // ▼▼ ここを調整することで、人数や明暗による符のバランスを変更できます ▼▼
        let uFu = 0;
        if (len === 3) uFu = isOpenUnit ? 2 : 4;       // 3人: 明刻2符 / 暗刻4符
        else if (len === 4) uFu = isOpenUnit ? 8 : 16; // 4人: 明槓8符 / 暗槓16符
        else if (len >= 5) uFu = isOpenUnit ? 16 : 32; // 5人以上: 特大明16符 / 特大暗32符
        // ▲▲ 調整エリアここまで ▲▲
        
        if (uFu > 0) fu += uFu;
    });

    // 4. 符の切り上げ (例: 32符 -> 40符)
    fu = Math.ceil(fu / 10) * 10;
    if (fu === 20 && !isTsumo) fu = 30; // 鳴きロンの最低符は30符

    // 役が何もない場合はアガれない（0点）
    if (han === 0) return { han: 0, fu: 0, details: ["役なし"], rank: "役なし", score: 0, payAll: 0, payDealer: 0, payChild: 0 };

    // 5. 満貫以上の判定
    let rank = "";
    let basePoint = 0;

    if (han >= 13) { rank = "役満"; basePoint = 8000; }
    else if (han >= 11) { rank = "三倍満"; basePoint = 6000; }
    else if (han >= 8) { rank = "倍満"; basePoint = 4000; }
    else if (han >= 6) { rank = "跳満"; basePoint = 3000; }
    else {
        // 基本点の計算: 符 × 2の(2+翻)乗
        basePoint = fu * Math.pow(2, 2 + han);
        if (basePoint >= 2000) { rank = "満貫"; basePoint = 2000; }
        else { rank = `${han}翻 ${fu}符`; }
    }

    // 6. 親・子ごとの支払い点数の計算
    let totalScore = 0, payAll = 0, payDealer = 0, payChild = 0;
    if (isDealer) {
        totalScore = Math.ceil((basePoint * 6) / 100) * 100;
        payAll = Math.ceil((basePoint * 2) / 100) * 100; // ツモ時の各自支払い
    } else {
        totalScore = Math.ceil((basePoint * 4) / 100) * 100;
        payDealer = Math.ceil((basePoint * 2) / 100) * 100; // ツモ時の親支払い
        payChild = Math.ceil(basePoint / 100) * 100;        // ツモ時の子支払い
    }

    details.push(`【 ${rank} 】`);
    return { han, fu, details, rank, score: totalScore, payAll, payDealer, payChild };
}
