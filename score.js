// ==========================================
// 麻雀 点数計算ロジック (score.js)
// ==========================================

function calculateMahjongScore(units, hand, isClosed, isRiichi, isTsumo, isDealer, OFFICIAL_UNITS) {
    let han = 0;
    let fu = 20; // 副底 (ベースの符)
    let details = [];

    // 1. 状況役の判定
    if (isRiichi) { han += 1; details.push("リーチ (1翻)"); }
    if (isClosed && !isTsumo) { fu += 10; details.push("門前ロン (+10符)"); }
    if (isTsumo) {
        if (isClosed) { han += 1; details.push("門前清自摸和 (1翻)"); }
        fu += 2; // ツモ符
    }
    
    // 2. ジョーカーなしボーナス
    let usedJoker = hand.some(t => t === "P（ｼﾞｮｰｶｰ）" || t.includes("ｵｰﾙﾏｲﾃｨ"));
    if (!usedJoker) { han += 2; details.push("純愛(ジョーカー不使用) (2翻)"); }

    // 3. ユニットごとの人数による翻・符の細かな調整
    units.forEach(uName => {
        let unitData = OFFICIAL_UNITS.find(o => o.name === uName);
        if (unitData) {
            let len = unitData.members.length;
            let uHan = 0;
            let uFu = 0;

            // ▼▼ ここを調整することで、人数ごとの点数バランスを変更できます ▼▼
            if (len <= 2) {
                uHan = 1;  uFu = 0;   // 2人ユニット: 1翻, 0符（順子扱い）
            } else if (len === 3) {
                uHan = 2;  uFu = 4;   // 3人ユニット: 2翻, 4符（刻子扱い）
            } else if (len === 4) {
                uHan = 3;  uFu = 8;   // 4人ユニット: 3翻, 8符（明槓扱い）
            } else if (len === 5) {
                uHan = 4;  uFu = 16;  // 5人ユニット: 4翻, 16符（暗槓扱い）
            } else {
                uHan = len - 1; uFu = 32; // 6人以上の大型: 人数-1翻, 32符
            }
            // ▲▲ 調整エリアここまで ▲▲

            han += uHan;
            fu += uFu;
            details.push(`${uName} (${uHan}翻 ${uFu}符)`);
        }
    });

    // 4. 符の切り上げ (例: 32符 -> 40符)
    fu = Math.ceil(fu / 10) * 10;
    if (fu === 20 && !isTsumo) fu = 30; // ロンの最低符は30符

    // 役が何もない場合は0点
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
    let totalScore = 0;
    let payAll = 0, payDealer = 0, payChild = 0;

    if (isDealer) {
        totalScore = Math.ceil((basePoint * 6) / 100) * 100;
        payAll = Math.ceil((basePoint * 2) / 100) * 100; // ツモ時の各自支払い
    } else {
        totalScore = Math.ceil((basePoint * 4) / 100) * 100;
        payDealer = Math.ceil((basePoint * 2) / 100) * 100; // ツモ時の親支払い
        payChild = Math.ceil(basePoint / 100) * 100;        // ツモ時の子支払い
    }

    details.push(`【 ${rank} 】`);

    return { 
        han, fu, details, rank, 
        score: totalScore, 
        payAll, payDealer, payChild 
    };
}