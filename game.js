// モバイル用サイドバー切り替え
function toggleSidebar() {
    const sidebar = document.getElementById('progress-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

function showReturnLobbyConfirmation() {
    document.getElementById('return-lobby-overlay').classList.add('open');
}

function hideReturnLobbyConfirmation() {
    document.getElementById('return-lobby-overlay').classList.remove('open');
}

function confirmReturnToLobby() {
    window.location.reload();
}

const customUnitNames = new Set(CUSTOM_UNIT_NAMES);
const selectedCustomUnitMembers = new Set();

function openUnitEditorLogin() {
    document.getElementById('unit-login-status').innerText = '';
    document.getElementById('unit-login-password-one').value = '';
    document.getElementById('unit-login-password-two').value = '';
    document.getElementById('unit-login-overlay').classList.add('open');
    document.getElementById('unit-login-password-one').focus();
}

function closeUnitEditorLogin() {
    document.getElementById('unit-login-overlay').classList.remove('open');
}

async function submitUnitEditorLogin() {
    const status = document.getElementById('unit-login-status');
    const submitButton = document.getElementById('unit-login-submit');
    submitButton.disabled = true;
    status.innerText = '';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                passwordOne: document.getElementById('unit-login-password-one').value,
                passwordTwo: document.getElementById('unit-login-password-two').value
            })
        });
        if (!response.ok) {
            status.innerText = response.status === 401
                ? '2つのパスワードを確認してください。'
                : response.status === 429
                    ? '認証に複数回失敗したため、1分後に再試行してください。'
                    : '認証サーバーでエラーが発生しました。';
            return;
        }
        closeUnitEditorLogin();
        openUnitEditor();
    } catch (error) {
        status.innerText = '認証サーバーに接続できません。サーバーから開いてください。';
    } finally {
        document.getElementById('unit-login-password-one').value = '';
        document.getElementById('unit-login-password-two').value = '';
        submitButton.disabled = false;
    }
}

function populateUnitIdolButtons() {
    const grid = document.getElementById('unit-idol-grid');
    grid.replaceChildren();
    selectedCustomUnitMembers.clear();
    [...IDOLS.Princess, ...IDOLS.Fairy, ...IDOLS.Angel].forEach(idol => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'unit-idol-button';
        button.innerText = idol;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
            if (selectedCustomUnitMembers.has(idol)) {
                selectedCustomUnitMembers.delete(idol);
                button.classList.remove('selected');
                button.setAttribute('aria-pressed', 'false');
            } else {
                selectedCustomUnitMembers.add(idol);
                button.classList.add('selected');
                button.setAttribute('aria-pressed', 'true');
            }
            document.getElementById('unit-selection-count').innerText = `${selectedCustomUnitMembers.size}人選択中`;
        });
        grid.appendChild(button);
    });
    document.getElementById('unit-selection-count').innerText = 'アイドルを選択してください';
}

function openUnitEditor() {
    populateUnitIdolButtons();
    document.getElementById('unit-name-input').value = '';
    document.getElementById('unit-editor-status').innerText = '';
    document.getElementById('unit-editor-overlay').classList.add('open');
}

function getCustomUnitDefinitions() {
    return [...customUnitNames].map(name => ({ name, members: [...UNIT_BY_NAME[name].members] }));
}

function replaceCustomUnits(units) {
    for (const name of customUnitNames) {
        delete RAW_UNITS[name];
        delete UNIT_BY_NAME[name];
        const index = OFFICIAL_UNITS.findIndex(unit => unit.name === name);
        if (index !== -1) OFFICIAL_UNITS.splice(index, 1);
    }
    customUnitNames.clear();

    const validIdols = new Set([...IDOLS.Princess, ...IDOLS.Fairy, ...IDOLS.Angel]);
    for (const definition of Array.isArray(units) ? units : []) {
        const name = typeof definition.name === 'string' ? definition.name.trim() : '';
        const members = Array.isArray(definition.members) ? [...new Set(definition.members)] : [];
        if (!name || /[<>]/.test(name) || members.length < 2 || members.some(idol => !validIdols.has(idol))) continue;
        if (Object.prototype.hasOwnProperty.call(RAW_UNITS, name)) continue;

        const unit = { name, members, score: members.length - 2 };
        RAW_UNITS[name] = members;
        UNIT_BY_NAME[name] = unit;
        OFFICIAL_UNITS.push(unit);
        customUnitNames.add(name);
    }
    _unitsBySizeDesc = null;
    _unitsByTile = null;
    _progressKey = '';
    _tenpaiProgressKey = '';
}

async function addCustomUnit() {
    const name = document.getElementById('unit-name-input').value.trim();
    const members = [...selectedCustomUnitMembers];
    const status = document.getElementById('unit-editor-status');
    if (!name) {
        status.innerText = 'ユニット名を入力してください。';
        return;
    }
    if (/[<>]/.test(name)) {
        status.innerText = 'ユニット名に < または > は使用できません。';
        return;
    }
    if (UNIT_BY_NAME[name]) {
        status.innerText = '同じ名前のユニットが既にあります。';
        return;
    }
    if (members.length < 2) {
        status.innerText = 'アイドルを2人以上選択してください。';
        return;
    }

    try {
        const response = await fetch('/api/units', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, members })
        });
        const result = await response.json();
        if (!response.ok) {
            const messages = {
                401: 'セッションが切れました。もう一度ログインしてください。',
                409: '同じ名前のユニットが既にあります。',
                400: 'ユニット名またはメンバーを確認してください。'
            };
            status.innerText = messages[response.status] || 'data.jsを更新できませんでした。';
            return;
        }
        replaceCustomUnits(result.customUnits);
    } catch (error) {
        status.innerText = 'サーバーに接続できないか、data.jsを更新できませんでした。';
        return;
    }
    document.getElementById('unit-name-input').value = '';
    populateUnitIdolButtons();
    status.innerText = `「${name}」を追加しました。続けて追加できます。`;
}

function returnToLobbyFromUnitEditor() {
    document.getElementById('unit-editor-overlay').classList.remove('open');
}

/*
let _actionBudgetMeasureContext = null;
function layoutActionBudget() {
    const row = document.getElementById('player-hand-row');
    const sortButton = document.getElementById('btn-sort-hand');
    const scroll = document.getElementById('player-hand-scroll');
    const hand = document.getElementById('my-hand-area');
    const budget = document.getElementById('action-budget');
    const dock = document.getElementById('player-dock');
    const gameBoard = document.getElementById('game-board');
    if (!row || !sortButton || !scroll || !hand || !budget || !dock || !gameBoard) return;

    const rowWidth = row.clientWidth;
    if (rowWidth < 1) return;
    const rowStyle = getComputedStyle(row);
    const gap = parseFloat(rowStyle.columnGap) || 0;
    const buttonWidth = sortButton.getBoundingClientRect().width;
    const preferredBudgetWidth = Math.min(240, Math.max(84, rowWidth * 0.36));
    let budgetWidth = preferredBudgetWidth;
    budget.style.width = `${budgetWidth}px`;
    const scrollWidth = Math.max(0, rowWidth - buttonWidth - budgetWidth - gap * 2);
    scroll.style.width = `${scrollWidth}px`;
    scroll.style.flexBasis = `${scrollWidth}px`;
    const rowRect = row.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    let budgetLeft = rowRect.right - budgetWidth;
    const minimumBudgetWidth = Math.min(minimumFontBox, preferredBudgetWidth);
    budget.style.right = `${Math.max(0, dockRect.right - rowRect.right)}px`;
    budget.style.bottom = `${Math.max(0, dockRect.bottom - rowRect.bottom)}px`;

    const playLeft = gameBoard.getBoundingClientRect().left;
    const tile = hand.querySelector('.mahjong-tile');
    const tileStyle = tile ? getComputedStyle(tile) : null;
    const root = document.documentElement;
    let tileWidth = parseFloat(getComputedStyle(root).getPropertyValue('--hand-tile-base-w'))
        || parseFloat(getComputedStyle(root).getPropertyValue('--hand-tile-w')) || 30;
    const marginLeft = tileStyle ? parseFloat(tileStyle.marginLeft) || 0 : 2;
    const horizontalMargins = tileStyle ? marginLeft + (parseFloat(tileStyle.marginRight) || 0) : 4;
    const handGap = parseFloat(getComputedStyle(hand).columnGap) || 0;
    const openArea = document.getElementById('my-open-area');
    const openTileCount = openArea ? openArea.children.length : 0;
    let scrollRect = scroll.getBoundingClientRect();
    const baseHandTileWidth = tileWidth;
    let concealedHandWidth = 13 * (tileWidth + horizontalMargins) + 12 * handGap;
    let placementFits = openTileCount === 0;

    for (let candidateWidth = baseHandTileWidth; openTileCount > 0 && candidateWidth >= 12; candidateWidth--) {
        const candidateLaneWidth = 13 * (candidateWidth + horizontalMargins) + 12 * handGap;
        const candidateMeldWidth = (candidateWidth * 2)
            + (openTileCount * (candidateWidth + horizontalMargins))
            + ((openTileCount - 1) * 2);
        const candidateBudgetLeft = playLeft + candidateLaneWidth - (marginLeft * 2)
            + (2 * (candidateMeldWidth + gap));
        const availableBudgetWidth = rowRect.right - candidateBudgetLeft;
        const firstTileLeft = ((playLeft + candidateBudgetLeft) / 2) - (candidateLaneWidth / 2);
        const canCenterHand = firstTileLeft - marginLeft >= scrollRect.left;
        if (availableBudgetWidth >= minimumFontBox && canCenterHand) {
            tileWidth = candidateWidth;
            concealedHandWidth = candidateLaneWidth;
            budgetLeft = candidateBudgetLeft;
            budgetWidth = Math.min(preferredBudgetWidth, availableBudgetWidth);
            placementFits = true;
            break;
        }
    }
    if (!placementFits) {
        tileWidth = baseHandTileWidth;
        concealedHandWidth = 13 * (tileWidth + horizontalMargins) + 12 * handGap;
        budgetWidth = preferredBudgetWidth;
        budgetLeft = rowRect.right - budgetWidth;
    }
    root.style.setProperty('--hand-tile-w', `${tileWidth}px`);
    root.style.setProperty('--tile-depth', `${Math.max(3, Math.min(6, tileWidth * 0.12))}px`);
                const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
                const budgetWidth = Math.min(240, Math.max(84, rowWidth * 0.36));
                scroll.style.width = `${Math.max(0, rowWidth - buttonWidth - budgetWidth - gap * 2)}px`;
                scroll.style.flexBasis = scroll.style.width;

}

                const boardLeft = gameBoard.getBoundingClientRect().left;
                const budgetLeft = rowRect.right - budgetWidth;
let _tableResizeObserver = null;
function layoutTable() {
        return;
    }
    _layoutLock = true;
                const tileWidth = parseFloat(getComputedStyle(root).getPropertyValue('--hand-tile-base-w'))
        _layoutLock = false;
        if (_layoutPending) {
            let _actionBudgetMeasureContext = null;
            function layoutActionBudget() {
                const row = document.getElementById('player-hand-row');
                const sortButton = document.getElementById('btn-sort-hand');
                const scroll = document.getElementById('player-hand-scroll');
                const hand = document.getElementById('my-hand-area');
                const budget = document.getElementById('action-budget');
                const dock = document.getElementById('player-dock');
                const gameBoard = document.getElementById('game-board');
                if (!row || !sortButton || !scroll || !hand || !budget || !dock || !gameBoard) return;

                const rowWidth = row.clientWidth;
                if (rowWidth < 1) return;
                const rowGap = parseFloat(getComputedStyle(row).columnGap) || 0;
                const buttonWidth = sortButton.getBoundingClientRect().width;
                const budgetWidth = Math.min(240, Math.max(84, rowWidth * 0.36));
                budget.style.width = `${budgetWidth}px`;
                const scrollWidth = Math.max(0, rowWidth - buttonWidth - budgetWidth - (rowGap * 2));
                scroll.style.width = `${scrollWidth}px`;
                scroll.style.flexBasis = `${scrollWidth}px`;

                const rowRect = row.getBoundingClientRect();
                const dockRect = dock.getBoundingClientRect();
                budget.style.right = `${Math.max(0, dockRect.right - rowRect.right)}px`;
                budget.style.bottom = `${Math.max(0, dockRect.bottom - rowRect.bottom)}px`;

                const timerRect = budget.getBoundingClientRect();
                const baseTileWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hand-tile-base-w'))
                    || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hand-tile-w')) || 30;
                const tile = hand.querySelector('.mahjong-tile');
                const tileStyle = tile ? getComputedStyle(tile) : null;
                const tileMarginLeft = tileStyle ? parseFloat(tileStyle.marginLeft) || 0 : 2;
                const tileHorizontalMargins = tileStyle
                    ? tileMarginLeft + (parseFloat(tileStyle.marginRight) || 0)
                    : 4;
                const handGap = parseFloat(getComputedStyle(hand).columnGap) || 0;
                const concealedHandWidth = 13 * (baseTileWidth + tileHorizontalMargins) + 12 * handGap;
                const boardLeft = gameBoard.getBoundingClientRect().left;
                const scrollRect = scroll.getBoundingClientRect();
                const firstTileLeft = ((boardLeft + timerRect.left) / 2) - (concealedHandWidth / 2);
                hand.style.marginLeft = `${Math.max(0, firstTileLeft - scrollRect.left - tileMarginLeft)}px`;

                if (!_actionBudgetMeasureContext) _actionBudgetMeasureContext = document.createElement('canvas').getContext('2d');
                if (!_actionBudgetMeasureContext) return;
                const budgetStyle = getComputedStyle(budget);
                const textChrome = parseFloat(budgetStyle.paddingLeft) + parseFloat(budgetStyle.paddingRight)
                    + parseFloat(budgetStyle.borderLeftWidth) + parseFloat(budgetStyle.borderRightWidth);
                const availableTextWidth = Math.max(0, budgetWidth - textChrome);
                const maxTimeLabel = roomTimerSettings.basicSeconds === 0 && roomTimerSettings.poolSeconds === 0
                    ? '0秒＋10秒'
                    : `${roomTimerSettings.basicSeconds}秒＋${roomTimerSettings.poolSeconds}秒`;
                let fontSize = 54;
                for (; fontSize > 10; fontSize--) {
                    _actionBudgetMeasureContext.font = `800 ${fontSize}px ${budgetStyle.fontFamily}`;
                    if (_actionBudgetMeasureContext.measureText(maxTimeLabel).width <= availableTextWidth) break;
                }
                budget.style.fontSize = `${fontSize}px`;
            }

            let _layoutLock = false;
            let _layoutPending = false;
            let _tableResizeObserver = null;
            function layoutTable() {
                if (_layoutLock) {
                    _layoutPending = true;
                    return;
                }
                _layoutLock = true;
                requestAnimationFrame(() => {
                    _layoutLock = false;
                    if (_layoutPending) {
                        _layoutPending = false;
                        layoutTable();
                    }
                });

                const board = document.getElementById('table-area') || document.getElementById('game-board');
                const app = document.getElementById('app-container');
                if (!board || !app || app.style.display === 'none') return;
                if (!_tableResizeObserver && typeof ResizeObserver !== 'undefined') {
                    _tableResizeObserver = new ResizeObserver(() => layoutTable());
                    _tableResizeObserver.observe(board);
                }

                const { width, height } = board.getBoundingClientRect();
                if (width < 40 || height < 40) return;
                const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
                const root = document.documentElement;
                const isPortrait = height > width;
                const isCompactLandscape = !isPortrait && height < 480;
                const handWidth = clamp(Math.min(width * 0.07, height * 0.07), 24, 48);
                const handHeight = clamp(handWidth * 1.4, 34, 64);
                const riverLength = isPortrait ? height : width;
                const riverWidth = clamp(Math.min(width * 0.073, height * 0.07, (riverLength - 34) / 18), 12, 48);
                const riverHeight = riverWidth * 1.4;
                const otherWidth = clamp(riverWidth * 0.86, 17, 40);
                const otherHeight = otherWidth * 1.4;
                const centerScale = clamp(Math.min(width / 440, height / 600), 0.62, 0.86);
                const tilt = height < 420 ? 22 : height < 560 ? 25 : 28;

                root.style.setProperty('--hand-tile-w', `${handWidth}px`);
                root.style.setProperty('--hand-tile-base-w', `${handWidth}px`);
                root.style.setProperty('--hand-tile-h', `${handHeight}px`);
                root.style.setProperty('--concealed-hand-width', `${13 * (handWidth + 4) + 24}px`);
                root.style.setProperty('--river-tile-w', `${riverWidth}px`);
                root.style.setProperty('--river-tile-h', `${riverHeight}px`);
                root.style.setProperty('--other-tile-w', `${otherWidth}px`);
                root.style.setProperty('--other-tile-h', `${otherHeight}px`);
                root.style.setProperty('--tile-depth', `${clamp(handWidth * 0.12, 3, 6)}px`);
                root.style.setProperty('--center-scale', centerScale);
                root.style.setProperty('--table-tilt', `${tilt}deg`);

                const rivers = [0, 1, 2, 3].map(index => document.getElementById(`river-${index}`));
                rivers.forEach((river, index) => {
                    if (!river) return;
                    const isLongRow = isPortrait ? index === 1 || index === 3 : isCompactLandscape && (index === 0 || index === 2);
                    const columns = isLongRow ? 18 : 6;
                    const rows = isLongRow ? 1 : 3;
                    river.style.width = `${columns * riverWidth + (columns - 1) * 2}px`;
                    river.style.gridTemplateColumns = `repeat(${columns}, ${riverWidth}px)`;
                    river.style.gridTemplateRows = `repeat(${rows}, ${riverHeight}px)`;
                    river.style.gridAutoRows = `${riverHeight}px`;
                });

                const [bottomRiver, rightRiver, topRiver, leftRiver] = rivers;
                if (isPortrait) {
                    rightRiver.style.left = '76%';
                    leftRiver.style.left = '24%';
                    bottomRiver.style.top = '68%';
                    bottomRiver.style.left = '50%';
                    bottomRiver.style.direction = 'ltr';
                    topRiver.style.top = '13%';
                    topRiver.style.left = '50%';
                    topRiver.style.direction = 'ltr';
                } else if (isCompactLandscape) {
                    rightRiver.style.left = '73%';
                    leftRiver.style.left = '27%';
                    bottomRiver.style.top = '78%';
                    bottomRiver.style.left = '45%';
                    bottomRiver.style.direction = 'rtl';
                    topRiver.style.top = '17%';
                    topRiver.style.left = '47%';
                    topRiver.style.direction = 'ltr';
                } else {
                    rightRiver.style.left = '73%';
                    leftRiver.style.left = '27%';
                    bottomRiver.style.top = '68%';
                    bottomRiver.style.left = '50%';
                    bottomRiver.style.direction = 'ltr';
                    topRiver.style.top = '13%';
                    topRiver.style.left = '50%';
                    topRiver.style.direction = 'ltr';
                }

                const rightSeat = document.getElementById('seat-1');
                const topSeat = document.getElementById('seat-2');
                const leftSeat = document.getElementById('seat-3');
                if (rightSeat) rightSeat.style.left = isPortrait ? '88%' : '87%';
                if (topSeat) topSeat.style.top = isCompactLandscape ? '3%' : '6%';
                if (leftSeat) leftSeat.style.left = isPortrait ? '12%' : '13%';
                layoutActionBudget();
            }

            let useAlmForProgress = true;
    if (tile === req) return true;
    if (tile === "P（ｼﾞｮｰｶｰ）") return true;
    const alm = attrAlmightyFor(req);
    return !!(alm && tile === alm);
}

// ワイルドカードの割り当て違いを含む抽出（残り手牌のユニークな形だけ返す）
*/
let _actionBudgetMeasureContext = null;
function layoutActionBudget() {
    const row = document.getElementById('player-hand-row');
    const handControls = document.getElementById('hand-controls');
    const scroll = document.getElementById('player-hand-scroll');
    const hand = document.getElementById('my-hand-area');
    const budget = document.getElementById('action-budget');
    const dock = document.getElementById('player-dock');
    const gameBoard = document.getElementById('game-board');
    if (!row || !handControls || !scroll || !hand || !budget || !dock || !gameBoard) return;

    const rowWidth = row.clientWidth;
    if (rowWidth < 1) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const controlsWidth = handControls.getBoundingClientRect().width;
    const budgetWidth = Math.min(240, Math.max(84, rowWidth * 0.36));
    const scrollWidth = Math.max(0, rowWidth - controlsWidth - budgetWidth - gap * 2);
    scroll.style.width = `${scrollWidth}px`;
    scroll.style.flexBasis = `${scrollWidth}px`;

    const rowRect = row.getBoundingClientRect();
    const dockRect = dock.getBoundingClientRect();
    budget.style.width = `${budgetWidth}px`;
    budget.style.right = `${Math.max(0, dockRect.right - rowRect.right)}px`;
    budget.style.bottom = `${Math.max(0, dockRect.bottom - rowRect.bottom)}px`;

    const tile = hand.querySelector('.mahjong-tile');
    const tileStyle = tile ? getComputedStyle(tile) : null;
    const root = document.documentElement;
    const tileWidth = parseFloat(getComputedStyle(root).getPropertyValue('--hand-tile-base-w'))
        || parseFloat(getComputedStyle(root).getPropertyValue('--hand-tile-w')) || 30;
    const marginLeft = tileStyle ? parseFloat(tileStyle.marginLeft) || 0 : 2;
    const horizontalMargins = tileStyle
        ? marginLeft + (parseFloat(tileStyle.marginRight) || 0)
        : 4;
    const handGap = parseFloat(getComputedStyle(hand).columnGap) || 0;
    const concealedHandWidth = 13 * (tileWidth + horizontalMargins) + 12 * handGap;
    root.style.setProperty('--concealed-hand-width', `${concealedHandWidth}px`);
    const scrollRect = scroll.getBoundingClientRect();
    const timerRect = budget.getBoundingClientRect();
    const boardLeft = gameBoard.getBoundingClientRect().left;
    const firstTileLeft = ((boardLeft + timerRect.left) / 2) - (concealedHandWidth / 2);
    hand.style.marginLeft = `${Math.max(0, firstTileLeft - scrollRect.left - marginLeft)}px`;

    if (!_actionBudgetMeasureContext) _actionBudgetMeasureContext = document.createElement('canvas').getContext('2d');
    if (!_actionBudgetMeasureContext) return;
    const budgetStyle = getComputedStyle(budget);
    const horizontalChrome = parseFloat(budgetStyle.paddingLeft) + parseFloat(budgetStyle.paddingRight)
        + parseFloat(budgetStyle.borderLeftWidth) + parseFloat(budgetStyle.borderRightWidth);
    const availableTextWidth = Math.max(0, budgetWidth - horizontalChrome);
    const timeLabel = roomTimerSettings.basicSeconds === 0 && roomTimerSettings.poolSeconds === 0
        ? '0秒＋10秒'
        : `${roomTimerSettings.basicSeconds}秒＋${roomTimerSettings.poolSeconds}秒`;
    let fontSize = 54;
    for (; fontSize > 10; fontSize--) {
        _actionBudgetMeasureContext.font = `800 ${fontSize}px ${budgetStyle.fontFamily}`;
        if (_actionBudgetMeasureContext.measureText(timeLabel).width <= availableTextWidth) break;
    }
    budget.style.fontSize = `${fontSize}px`;
}

let _layoutLock = false;
let _layoutPending = false;
let _tableResizeObserver = null;
function layoutTable() {
    if (_layoutLock) {
        _layoutPending = true;
        return;
    }
    _layoutLock = true;
    requestAnimationFrame(() => {
        _layoutLock = false;
        if (_layoutPending) {
            _layoutPending = false;
            layoutTable();
        }
    });

    const board = document.getElementById('table-area') || document.getElementById('game-board');
    const app = document.getElementById('app-container');
    if (!board || !app || app.style.display === 'none') return;
    if (!_tableResizeObserver && typeof ResizeObserver !== 'undefined') {
        _tableResizeObserver = new ResizeObserver(() => layoutTable());
        _tableResizeObserver.observe(board);
    }

    const { width, height } = board.getBoundingClientRect();
    if (width < 40 || height < 40) return;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const root = document.documentElement;
    const isPortrait = height > width;
    const isCompactLandscape = !isPortrait && height < 480;
    const handWidth = clamp(Math.min(width * 0.07, height * 0.07), 24, 48);
    const handHeight = clamp(handWidth * 1.4, 34, 64);
    const riverLength = isPortrait ? height : width;
    const riverWidth = clamp(Math.min(width * 0.073, height * 0.07, (riverLength - 34) / 18), 12, 48);
    const riverHeight = riverWidth * 1.4;
    const otherWidth = clamp(riverWidth * 0.86, 17, 40);
    const otherHeight = otherWidth * 1.4;
    const centerScale = clamp(Math.min(width / 440, height / 600), 0.62, 0.86);
    const tilt = height < 420 ? 22 : height < 560 ? 25 : 28;

    root.style.setProperty('--hand-tile-w', `${handWidth}px`);
    root.style.setProperty('--hand-tile-base-w', `${handWidth}px`);
    root.style.setProperty('--hand-tile-h', `${handHeight}px`);
    root.style.setProperty('--concealed-hand-width', `${13 * (handWidth + 4) + 24}px`);
    root.style.setProperty('--river-tile-w', `${riverWidth}px`);
    root.style.setProperty('--river-tile-h', `${riverHeight}px`);
    root.style.setProperty('--other-tile-w', `${otherWidth}px`);
    root.style.setProperty('--other-tile-h', `${otherHeight}px`);
    root.style.setProperty('--tile-depth', `${clamp(handWidth * 0.12, 3, 6)}px`);
    root.style.setProperty('--center-scale', centerScale);
    root.style.setProperty('--table-tilt', `${tilt}deg`);

    const rivers = [0, 1, 2, 3].map(index => document.getElementById(`river-${index}`));
    rivers.forEach((river, index) => {
        if (!river) return;
        const isLongRow = isPortrait ? index === 1 || index === 3 : isCompactLandscape && (index === 0 || index === 2);
        const columns = isLongRow ? 18 : 6;
        const rows = isLongRow ? 1 : 3;
        river.style.width = `${columns * riverWidth + (columns - 1) * 2}px`;
        river.style.gridTemplateColumns = `repeat(${columns}, ${riverWidth}px)`;
        river.style.gridTemplateRows = `repeat(${rows}, ${riverHeight}px)`;
        river.style.gridAutoRows = `${riverHeight}px`;
    });

    const [bottomRiver, rightRiver, topRiver, leftRiver] = rivers;
    if (isPortrait) {
        rightRiver.style.left = '76%'; leftRiver.style.left = '24%';
        bottomRiver.style.top = '68%'; bottomRiver.style.left = '50%'; bottomRiver.style.direction = 'ltr';
        topRiver.style.top = '13%'; topRiver.style.left = '50%'; topRiver.style.direction = 'ltr';
    } else if (isCompactLandscape) {
        rightRiver.style.left = '73%'; leftRiver.style.left = '27%';
        bottomRiver.style.top = '78%'; bottomRiver.style.left = '45%'; bottomRiver.style.direction = 'rtl';
        topRiver.style.top = '17%'; topRiver.style.left = '47%'; topRiver.style.direction = 'ltr';
    } else {
        rightRiver.style.left = '73%'; leftRiver.style.left = '27%';
        bottomRiver.style.top = '68%'; bottomRiver.style.left = '50%'; bottomRiver.style.direction = 'ltr';
        topRiver.style.top = '13%'; topRiver.style.left = '50%'; topRiver.style.direction = 'ltr';
    }

    const rightSeat = document.getElementById('seat-1');
    const topSeat = document.getElementById('seat-2');
    const leftSeat = document.getElementById('seat-3');
    if (rightSeat) rightSeat.style.left = isPortrait ? '88%' : '87%';
    if (topSeat) topSeat.style.top = isCompactLandscape ? '3%' : '6%';
    if (leftSeat) leftSeat.style.left = isPortrait ? '12%' : '13%';
    layoutActionBudget();
}

let useAlmForProgress = true;
let useAlmightyForNaki = true;
let autoWinEnabled = false;
let pendingAutoWinAction = null;
function toggleAlmighty() {
    useAlmForProgress = !useAlmForProgress;
    const button = document.getElementById('btn-toggle-alm');
    button.querySelector('.progress-toggle-state').innerText = useAlmForProgress ? 'ON' : 'OFF';
    button.style.background = useAlmForProgress ? '#4caf50' : '#9e9e9e';
    button.setAttribute('aria-pressed', String(useAlmForProgress));
    updateProgressUI();
}

function toggleNakiAlmighty() {
    useAlmightyForNaki = !useAlmightyForNaki;
    const button = document.getElementById('btn-toggle-naki-alm');
    button.querySelector('.progress-toggle-state').innerText = useAlmightyForNaki ? 'ON' : 'OFF';
    button.style.background = useAlmightyForNaki ? '#4caf50' : '#9e9e9e';
    button.setAttribute('aria-pressed', String(useAlmightyForNaki));
}

function toggleAutoWin() {
    autoWinEnabled = !autoWinEnabled;
    const button = document.getElementById('btn-auto-win');
    button.querySelector('.progress-toggle-state').innerText = autoWinEnabled ? 'ON' : 'OFF';
    button.style.background = autoWinEnabled ? '#4caf50' : '#9e9e9e';
    button.setAttribute('aria-pressed', String(autoWinEnabled));
    if (autoWinEnabled && pendingAutoWinAction && document.getElementById('action-bar').style.display !== 'none') {
        const action = pendingAutoWinAction;
        sendAction(action);
        hideActions();
    }
}

function logM(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = 'white';
    toast.style.padding = '8px 16px';
    toast.style.borderRadius = '20px';
    toast.style.fontSize = '14px';
    toast.style.transition = 'opacity 0.5s';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function showCutin(text, color) {
    const overlay = document.getElementById('cutin-overlay');
    const label = document.getElementById('cutin-text');
    label.innerText = text;
    label.style.color = color;
    label.style.animation = 'none';
    overlay.style.display = 'flex';
    setTimeout(() => { label.style.animation = 'popIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'; }, 10);
    setTimeout(() => { overlay.style.display = 'none'; }, 1200);
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
    const attr = IDOL_ATTR[req] || (IDOLS.Princess.includes(req) ? 'Pr' : IDOLS.Fairy.includes(req) ? 'Fa' : IDOLS.Angel.includes(req) ? 'An' : null);
    return attr ? `${attr}ｵｰﾙﾏｲﾃｨ` : null;
}

function canPossiblyExtract(hand, required) {
    const pool = Object.create(null);
    hand.forEach(tile => { pool[tile] = (pool[tile] || 0) + 1; });
    let needPr = 0, needFa = 0, needAn = 0;
    for (const req of required) {
        if (pool[req] > 0) { pool[req]--; continue; }
        const attr = IDOL_ATTR[req];
        if (attr === 'Pr') needPr++;
        else if (attr === 'Fa') needFa++;
        else if (attr === 'An') needAn++;
        else return false;
    }
    const consume = (need, key) => {
        const used = Math.min(need, pool[key] || 0);
        pool[key] = (pool[key] || 0) - used;
        return need - used;
    };
    needPr = consume(needPr, 'Prｵｰﾙﾏｲﾃｨ');
    needFa = consume(needFa, 'Faｵｰﾙﾏｲﾃｨ');
    needAn = consume(needAn, 'Anｵｰﾙﾏｲﾃｨ');
    return needPr + needFa + needAn <= (pool['P（ｼﾞｮｰｶｰ）'] || 0);
}

function scoreHand(units, hand, openTiles, agariTile, isClosed, isRiichi, isTsumo, isDealer, pIdx = null) {
    const openNames = pIdx == null ? null : (isHost ? openUnitNames[pIdx] : globalOpenUnitNames[pIdx]);
    return calculateMahjongScore(units, hand, openTiles || [], agariTile, isClosed, isRiichi, isTsumo, isDealer, OFFICIAL_UNITS, playerFavorites[pIdx] || null, openNames);
}

function tileFillsReq(tile, req) {
    if (tile === req || tile === 'P（ｼﾞｮｰｶｰ）') return true;
    const almighty = attrAlmightyFor(req);
    return !!almighty && tile === almighty;
}

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
    for (let i = 0; i < hand.length; i++) {
        if (hand[i] === '青葉美咲' || hand[i] === '音無小鳥') {
            return { isValid: false, units: [] };
        }
    }

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

function checkPlayerAgari(concealedHand, pIdx, memo = {}) {
    const result = checkAgari(concealedHand, memo);
    if (!result.isValid) return result;
    return {
        isValid: true,
        units: [...result.units, ...(globalOpenUnitNames[pIdx] || [])]
    };
}

// 外部ファイル化したスコア計算をかませて、役（ハン）が1以上あるか確認する
function candidateWaitTiles(hand) {
    const pool = Object.create(null);
    for (let i = 0; i < hand.length; i++) pool[hand[i]] = (pool[hand[i]] || 0) + 1;
    const cands = new Set();
    const units = unitsBySizeDesc();
    for (let u = 0; u < units.length; u++) {
        const mem = units[u].members;
        if (mem.length > hand.length + 1) continue;
        const used = Object.create(null);
        const miss = [];
        for (let i = 0; i < mem.length; i++) {
            const m = mem[i];
            if ((pool[m] || 0) > (used[m] || 0)) used[m] = (used[m] || 0) + 1;
            else miss.push(m);
        }
        let wild = pool['P（ｼﾞｮｰｶｰ）'] || 0;
        let pr = pool['Prｵｰﾙﾏｲﾃｨ'] || 0;
        let fa = pool['Faｵｰﾙﾏｲﾃｨ'] || 0;
        let an = pool['Anｵｰﾙﾏｲﾃｨ'] || 0;
        const still = [];
        for (let i = 0; i < miss.length; i++) {
            const attr = (typeof IDOL_ATTR !== 'undefined') ? IDOL_ATTR[miss[i]] : null;
            if (attr === 'Pr' && pr > 0) { pr--; continue; }
            if (attr === 'Fa' && fa > 0) { fa--; continue; }
            if (attr === 'An' && an > 0) { an--; continue; }
            if (wild > 0) { wild--; continue; }
            still.push(miss[i]);
        }
        if (still.length <= 2) {
            for (let i = 0; i < still.length; i++) cands.add(still[i]);
            for (let i = 0; i < mem.length; i++) cands.add(mem[i]);
        }
    }
    for (let i = 0; i < hand.length; i++) {
        const t = hand[i];
        if (t !== '青葉美咲' && t !== '音無小鳥') cands.add(t);
    }
    cands.add('P（ｼﾞｮｰｶｰ）');
    cands.add('Prｵｰﾙﾏｲﾃｨ');
    cands.add('Faｵｰﾙﾏｲﾃｨ');
    cands.add('Anｵｰﾙﾏｲﾃｨ');
    return [...cands];
}

function getWaits(testHand, memo, isClosed, pIdx, openTilesArr = [], withScore = false, isRiichi = false) {
    let waits = [];
    let isDealer = (pIdx === currentDealer);
    const concealedHand = testHand.slice(0, Math.max(0, testHand.length - openTilesArr.length));
    const waitTiles = candidateWaitTiles(concealedHand);
    for (let t = 0; t < waitTiles.length; t++) {
        const tile = waitTiles[t];
        const tHand = testHand.concat(tile);
        const res = checkPlayerAgari(concealedHand.concat(tile), pIdx, memo);
        if (!res.isValid) continue;
        if (withScore) {
            const score = scoreHand(res.units, tHand, openTilesArr, tile, isClosed, isRiichi, false, isDealer, pIdx);
            if (score.han > 0) {
                waits.push({ tile: tile, units: res.units, han: score.han, fu: score.fu, rank: score.rank, scoreVal: score.score });
            }
        } else {
            waits.push({ tile: tile, units: res.units, han: 1, fu: 20, rank: '', scoreVal: 0 });
        }
    }
    return waits;
}

function getTenpaiInfo(myHand, myOpen, isMyTurn, pIdx, withScore = false, isRiichi = false) {
    const fullHand = myHand.concat(myOpen);
    const tenpaiList = [];
    const globalMemo = {};
    const isClosed = myOpen.length === 0;
    if (checkPlayerAgari(myHand, pIdx, globalMemo).isValid) return [];

    if (isMyTurn) {
        const uniqueHand = [];
        const seen = Object.create(null);
        for (let i = 0; i < myHand.length; i++) {
            if (seen[myHand[i]]) continue;
            seen[myHand[i]] = 1;
            uniqueHand.push(myHand[i]);
        }
        for (let d = 0; d < uniqueHand.length; d++) {
            const discardTile = uniqueHand[d];
            const testHand = fullHand.slice();
            testHand.splice(testHand.indexOf(discardTile), 1);
            const waits = getWaits(testHand, globalMemo, isClosed, pIdx, myOpen, withScore, isRiichi);
            if (waits.length > 0) tenpaiList.push({ discard: discardTile, waits: waits });
        }
    } else {
        const waits = getWaits(fullHand, globalMemo, isClosed, pIdx, myOpen, withScore, isRiichi);
        if (waits.length > 0) tenpaiList.push({ discard: null, waits: waits });
    }
    return tenpaiList;
}

let _unitsByTile = null;
function unitsPossiblyUsing(tile) {
    if (!_unitsByTile && typeof OFFICIAL_UNITS !== 'undefined') {
        _unitsByTile = Object.create(null);
        for (let i = 0; i < OFFICIAL_UNITS.length; i++) {
            const u = OFFICIAL_UNITS[i];
            if (u.members.length < 3) continue;
            for (let j = 0; j < u.members.length; j++) {
                const m = u.members[j];
                if (!_unitsByTile[m]) _unitsByTile[m] = [];
                _unitsByTile[m].push(u);
            }
        }
    }
    if (tile === 'P（ｼﾞｮｰｶｰ）') {
        return OFFICIAL_UNITS.filter(u => u.members.length >= 3);
    }
    if (tile === 'Prｵｰﾙﾏｲﾃｨ' || tile === 'Faｵｰﾙﾏｲﾃｨ' || tile === 'Anｵｰﾙﾏｲﾃｨ') {
        const attr = tile.substring(0, 2);
        return OFFICIAL_UNITS.filter(u => u.members.length >= 3 && u.members.some(m => IDOL_ATTR[m] === attr));
    }
    return (_unitsByTile && _unitsByTile[tile]) || [];
}

function isAlmightyTile(tile) {
    return tile === 'P（ｼﾞｮｰｶｰ）' || tile.includes('ｵｰﾙﾏｲﾃｨ');
}

function checkCanNaki(unlockedHand, tile, allowHandAlmighty = true) {
    let nakiUnits = [];
    const unitList = unitsPossiblyUsing(tile);
    for (let unit of unitList) {
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
                    const handForNaki = allowHandAlmighty
                        ? unlockedHand
                        : unlockedHand.filter(handTile => !isAlmightyTile(handTile));
                    if (tryExtract(handForNaki, remainingReqs)) {
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

function consumeUnitFromHand(hand, unitName, discardedTile, allowHandAlmighty = true) {
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
    
    for (let req of allowHandAlmighty ? missing : []) {
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
let clientFavoritesMap = {}; let playerFavorites = [null, null, null, null];
let deck = [], playerHands = [[],[],[],[]], discards = [[],[],[],[]];
let currentTurn = 0, currentDiscard = null, nakiResponses = [], nakiTimer = null;
let currentTurnHasDrawn = false;
let isWaitingAction = false; let isMyTurnNow = false; 

let gameRuleMaxRounds = 1; let currentBakaze = 0; let currentKyoku = 1; let currentDealer = 0;
let playerScores = [25000, 25000, 25000, 25000];
let playerRiichi = [false, false, false, false];
let riichiSticks = 0;
let riichiDiscardIndex = [-1, -1, -1, -1];

let globalHandLens = [12,12,12,12]; let getHandLens = () => playerHands.map(h => h.length);
let openTiles = [[], [], [], []]; let getOpenTiles = () => openTiles;
let globalOpenTiles = [[], [], [], []];
let openUnitNames = [[], [], [], []];
let globalOpenUnitNames = [[], [], [], []];
let globalPlayerRiichi = [false, false, false, false];
let globalRiichiSticks = 0;
let globalRiichiDiscardIndex = [-1, -1, -1, -1];
let isPendingRiichi = false;
let validRiichiDiscards = [];
let clientCurrentTurn = -1;

let clerkState = { active: false, originalPlayer: null, discardsLeft: 0, firstNakiPlayer: null, secondNakiPlayer: null, interruptedByNaki: false };

let lockedUnits = new Set();
let completedNakiUnits = new Set();
let currentLockedIndices = new Set();
let actionTimerInterval = null;

let readyForNextKyokuCount = 0;
let isNextRenchan = false;

let gameEpoch = 0;
let kyokuActive = false;
let skipFuriten = [false, false, false, false];
let localSkipFuriten = false;
let roomTimerSettings = { basicSeconds: 20, poolSeconds: 120 };
let playerThinkingPools = [120, 120, 120, 120];
let activeDecisionTimer = null;
function readRoomTimerSettings() {
    return {
        basicSeconds: Number(document.getElementById('base-time-select').value),
        poolSeconds: Number(document.getElementById('thinking-pool-select').value)
    };
}

function setConnStatus(msg) {
    const el = document.getElementById('conn-status');
    if (el) el.innerText = msg || '';
}
function isIdolTile(tile) {
    return IDOLS.Princess.includes(tile) || IDOLS.Fairy.includes(tile) || IDOLS.Angel.includes(tile);
}
function selectedFavoriteIdol() {
    const select = document.getElementById('favorite-idol-select');
    return select && isIdolTile(select.value) ? select.value : null;
}
function requireFavoriteIdol() {
    if (selectedFavoriteIdol()) return true;
    setConnStatus('入室前に担当アイドルを選択してください');
    const select = document.getElementById('favorite-idol-select');
    if (select) select.focus();
    return false;
}
function populateFavoriteIdolSelector() {
    const select = document.getElementById('favorite-idol-select');
    if (!select) return;
    for (const [attribute, idols] of Object.entries(IDOLS)) {
        const group = document.createElement('optgroup');
        group.label = attribute;
        idols.forEach(idol => {
            const option = document.createElement('option');
            option.value = idol;
            option.innerText = idol;
            group.appendChild(option);
        });
        select.appendChild(group);
    }
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
    data.openUnitNames = openUnitNames.map(names => [...names]);
    data.timerSettings = roomTimerSettings;
    data.thinkingPools = [...playerThinkingPools];
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
    const concealedHand = isTsumo ? playerHands[pIdx] : [...playerHands[pIdx], agariTile];
    const res = checkPlayerAgari(concealedHand, pIdx, memo);
    if (!res.isValid) return null;
    const isClosed = openTiles[pIdx].length === 0;
    const isDealer = (pIdx === currentDealer);
    const scoreInfo = scoreHand(res.units, fullHand, openTiles[pIdx], agariTile, isClosed, playerRiichi[pIdx], isTsumo, isDealer, pIdx);
    if (scoreInfo.han <= 0) return null;
    return { res, scoreInfo };
}

function getWaitTilesForPlayer(pIdx) {
    const closed = playerHands[pIdx];
    const opened = openTiles[pIdx] || [];
    const full = [...closed, ...opened];
    if (checkPlayerAgari(closed, pIdx, {}).isValid) return [];
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
    if (checkPlayerAgari(closed, myId, {}).isValid) return false;
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

function simulateNaki(pIdx, tile, unitName, allowHandAlmighty = true) {
    const hand = playerHands[pIdx].slice();
    const used = consumeUnitFromHand(hand, unitName, tile, allowHandAlmighty);
    return {
        closedLeft: hand.length,
        hand,
        openAfter: (openTiles[pIdx] || []).concat(used)
    };
}

function canNakiWithDiscardLeft(pIdx, tile, unitName, allowHandAlmighty = true) {
    return simulateNaki(pIdx, tile, unitName, allowHandAlmighty).closedLeft >= 1;
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
        _progressKey = "";
    hideActions();
    sendAction('DISCARD', { tile: tile, isRiichi: isRiichiAction });
}

function createRoom() {
    if (!requireFavoriteIdol()) return;
    roomTimerSettings = readRoomTimerSettings();
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
    if (!requireFavoriteIdol()) return;
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
            hostConn.send({ type: 'SET_NAME', name: document.getElementById('player-name-input').value || 'ゲスト', favoriteIdol: selectedFavoriteIdol() });
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
    if (!requireFavoriteIdol()) return;
    gameRuleMaxRounds = parseInt(document.getElementById('game-rule').value);
    currentBakaze = 0; currentKyoku = 1; currentDealer = 0; playerScores = [25000, 25000, 25000, 25000];
    riichiSticks = 0;
    const slots = [{ role: 'HOST', conn: null, name: document.getElementById('player-name-input').value || 'ホスト', favoriteIdol: selectedFavoriteIdol() }];
    clientConns.forEach(c => {
        if (c && c.open) slots.push({ role: 'CLIENT', conn: c, name: clientNamesMap[c.peer] || 'ゲスト', favoriteIdol: clientFavoritesMap[c.peer] || null });
    });
    while (slots.length < 4) slots.push({ role: 'CPU', conn: null, name: 'CPU' + slots.length, favoriteIdol: null });
    shuffleSeats(slots);
    playerRoles = slots.map(s => s.role);
    playerConns = slots.map(s => s.conn);
    globalPlayerNames = slots.map(s => s.name);
    playerFavorites = slots.map(s => s.favoriteIdol);
    playerThinkingPools = slots.map(s => s.role === 'CPU' ? 0 : roomTimerSettings.poolSeconds);
    hostSeat = playerRoles.indexOf('HOST');
    if (hostSeat < 0) hostSeat = 0;
    startKyoku();
}

function startKyoku() {
    bumpGameEpoch();
    kyokuActive = true;
    playerThinkingPools = playerRoles.map(role => role === 'CPU' ? 0 : roomTimerSettings.poolSeconds);
    deck = []; discards = [[],[],[],[]]; openTiles = [[],[],[],[]]; openUnitNames = [[],[],[],[]];
    playerRiichi = [false, false, false, false]; riichiDiscardIndex = [-1, -1, -1, -1];
    skipFuriten = [false, false, false, false];
    for(let attr in IDOLS) IDOLS[attr].forEach(i => deck.push(i, i));
    SPECIAL_TILES.forEach(s => { for(let i=0; i<s.count; i++) deck.push(s.name); });
    for(let i = deck.length-1; i>0; i--) { let j = Math.floor(Math.random()*(i+1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }

    for(let i=0; i<4; i++) { playerHands[i] = deck.splice(-12); playerHands[i].sort((a, b) => (SORT_ORDER[a] ?? 999) - (SORT_ORDER[b] ?? 999)); }
    isWaitingAction = false; currentTurn = currentDealer; currentTurnHasDrawn = false;
    clerkState = { active: false, originalPlayer: null, discardsLeft: 0, firstNakiPlayer: null, secondNakiPlayer: null, interruptedByNaki: false };
    const customUnits = getCustomUnitDefinitions();
    
    playerRoles.forEach((role, idx) => {
        let msg = { type: 'START_KYOKU', pId: idx, hand: [...playerHands[idx]], deckLen: deck.length, roles: playerRoles, names: globalPlayerNames, favorites: playerFavorites, customUnits, timerSettings: roomTimerSettings, thinkingPools: [...playerThinkingPools], handLens: getHandLens(), openTiles: getOpenTiles(), openUnitNames: openUnitNames, scores: playerScores, bakaze: currentBakaze, kyoku: currentKyoku, dealer: currentDealer, playerRiichi: playerRiichi, riichiSticks: riichiSticks, riichiDiscardIndex: riichiDiscardIndex };
        if(role === 'HOST') handleHostMsg(msg);
        else if(role === 'CLIENT') sendToClient(idx, msg);
    });
    kyokuTimeout(nextTurn, 1500);
}

function nextTurn() {
    if (!kyokuActive || currentTurnHasDrawn) return;
    isWaitingAction = false;
    skipFuriten[currentTurn] = playerRiichi[currentTurn] ? skipFuriten[currentTurn] : false;
    if(deck.length === 0) { 
        settleRyukyokuAndEnd();
        return; 
    }
    if(playerHands[currentTurn].length + openTiles[currentTurn].length >= 14) return;

    currentTurnHasDrawn = true;
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
    if(data.type === 'SET_NAME') {
        clientNamesMap[conn.peer] = data.name;
        clientFavoritesMap[conn.peer] = isIdolTile(data.favoriteIdol) ? data.favoriteIdol : null;
        return;
    }
    if(data.type === 'READY_NEXT') { handleReadyNext(); return; }
    
    let pIdx = playerConns.indexOf(conn);
    if (pIdx < 0) return;
    if(data.type === 'DISCARD' && currentTurn === pIdx && !isWaitingAction) processDiscard(pIdx, data.tile, data.isRiichi, data.spentExtraSeconds);
    if(data.type === 'ACTION') processNakiAction(pIdx, data.action, data.payload, data.spentExtraSeconds);
    if(data.type === 'TSUMO' && currentTurn === pIdx) {
        if (!processAgari(pIdx, true, data.spentExtraSeconds)) sendToClient(pIdx, { type: 'AGARI_REJECTED', thinkingPools: [...playerThinkingPools] });
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
function sendAction(action, payload=null, spentExtraOverride=null) {
    const measuredExtra = finishDecisionTimer();
    const spentExtraSeconds = spentExtraOverride == null ? measuredExtra : spentExtraOverride;
    if(action === 'DISCARD') { 
        let t = payload.tile !== undefined ? payload.tile : payload;
        let r = payload.isRiichi || false;
        if(isHost) processDiscard(hostSeat, t, r, spentExtraSeconds); else sendToHost({type:'DISCARD', tile: t, isRiichi: r, spentExtraSeconds});
    }
    else if(action === 'TSUMO') {
        if(isHost) {
            if (!processAgari(hostSeat, true, spentExtraSeconds)) restoreTurnAfterRejectedAgari();
        } else sendToHost({type:'TSUMO', spentExtraSeconds});
    }
    else if(action === 'NAKI') { if(isHost) processNakiAction(hostSeat, action, payload, spentExtraSeconds); else sendToHost({type:'ACTION', action:action, payload:payload, spentExtraSeconds}); }
    else {
        if (action === 'SKIP' && lastAskCouldRon) localSkipFuriten = true;
        if(isHost) processNakiAction(hostSeat, action, null, spentExtraSeconds); else sendToHost({type:'ACTION', action:action, spentExtraSeconds});
    }
}

function processDiscard(pIdx, tile, isRiichi = false, spentExtraSeconds = 0) {
    if (!kyokuActive || isWaitingAction) return; 
    if (currentTurn !== pIdx) return;
    let h = playerHands[pIdx]; let tIdx = h.indexOf(tile);
    if(tIdx === -1) return; 
    chargeThinkingPool(pIdx, spentExtraSeconds);
    
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
    
    const isClerkTile = tile === "青葉美咲" || tile === "音無小鳥";
    const continuesClerkEffect = clerkState.active && pIdx === clerkState.originalPlayer && !clerkState.interruptedByNaki;
    if (isClerkTile && !playerRiichi[pIdx] && (!clerkState.active || continuesClerkEffect)) {
        if (deck.length < 2) {
            if (continuesClerkEffect) clerkState.discardsLeft--;
            broadcast({ type: 'MSG', msg: "山札が足りず効果不発。" });
            advanceTurnAfterDiscard();
            return;
        }
        if (continuesClerkEffect) {
            clerkState.discardsLeft = Math.max(0, clerkState.discardsLeft - 1) + 2;
        } else {
            clerkState = { active: true, originalPlayer: pIdx, discardsLeft: 2, firstNakiPlayer: null, secondNakiPlayer: null, interruptedByNaki: false };
        }
        let d1 = deck.pop(); let d2 = deck.pop(); h.push(d1, d2);
        
        broadcast({ type: 'CLERK_EFFECT', pIdx: pIdx, deckLen: deck.length, handLens: getHandLens(), openTiles: getOpenTiles() });
        let msg = { type: 'CLERK_DRAW', drawn: [d1, d2], discardsLeft: clerkState.discardsLeft };
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
    else if (roomTimerSettings.basicSeconds === 0 && roomTimerSettings.poolSeconds === 0) {
        nakiTimer = kyokuTimeout(resolveActions, 10000);
    }
    else {
        const pendingPools = playerThinkingPools.filter((_, idx) => idx !== pIdx && playerRoles[idx] !== 'CPU');
        const maxPool = pendingPools.length ? Math.max(...pendingPools) : 0;
        nakiTimer = kyokuTimeout(resolveActions, (roomTimerSettings.basicSeconds + maxPool + 1) * 1000);
    }
}

function processNakiAction(pIdx, action, payload=null, spentExtraSeconds = 0) {
    if (!kyokuActive || !isWaitingAction || !currentDiscard) return;
    if(pIdx === currentDiscard.pIdx) return;
    if(nakiResponses.find(r => r.pIdx === pIdx)) return;
    chargeThinkingPool(pIdx, spentExtraSeconds);
    if (action === 'RON') {
        const tile = currentDiscard.tile;
        const evalRon = evaluateAgari(pIdx, [...playerHands[pIdx], ...openTiles[pIdx], tile], tile, false);
        if (!evalRon || isFuriten(pIdx)) action = 'SKIP';
    }
    if (action === 'NAKI') {
        const unitName = typeof payload === 'string' ? payload : payload && payload.unitName;
        const allowHandAlmighty = payload && typeof payload.allowHandAlmighty === 'boolean'
            ? payload.allowHandAlmighty
            : true;
        if (playerRiichi[pIdx] || !unitName) action = 'SKIP';
        else {
            const can = checkCanNaki(playerHands[pIdx], currentDiscard.tile, allowHandAlmighty);
            if (!can || !can.includes(unitName)) action = 'SKIP';
            else if (!canNakiWithDiscardLeft(pIdx, currentDiscard.tile, unitName, allowHandAlmighty)) action = 'SKIP';
            else payload = { unitName, allowHandAlmighty };
        }
    }
    if (action === 'SKIP') {
        const tile = currentDiscard.tile;
        const evalRon = evaluateAgari(pIdx, [...playerHands[pIdx], ...openTiles[pIdx], tile], tile, false);
        if (evalRon) skipFuriten[pIdx] = true;
    }
    nakiResponses.push({ pIdx, action, payload });
    broadcast({ type: 'TIMER_UPDATE' });
    if(nakiResponses.length === 3) { clearTimeout(nakiTimer); resolveActions(); }
}

function advanceTurnAfterDiscard() {
    if (clerkState.active) {
        if (clerkState.discardsLeft > 0) {
            clerkState.interruptedByNaki = false;
            currentTurn = clerkState.originalPlayer;
            broadcast({ type: 'TURN_CONTINUE', pIdx: currentTurn, clerkDiscardsLeft: clerkState.discardsLeft, handLens: getHandLens(), openTiles: getOpenTiles() });
            if (playerRoles[currentTurn] === 'CPU') { kyokuTimeout(() => { processDiscard(currentTurn, getCpuDiscard(playerHands[currentTurn], currentTurn), false); }, 1200); }
            return;
        } else {
            let nextP = null;
            if (clerkState.secondNakiPlayer !== null) nextP = (clerkState.secondNakiPlayer + 1) % 4;
            else if (clerkState.firstNakiPlayer !== null) nextP = (clerkState.firstNakiPlayer + 1) % 4;
            else nextP = (clerkState.originalPlayer + 1) % 4;
            
            clerkState.active = false; currentTurn = nextP; currentTurnHasDrawn = false;
            kyokuTimeout(nextTurn, 1000); 
            return;
        }
    }
    currentTurn = (currentDiscard.pIdx + 1) % 4;
    currentTurnHasDrawn = false;
    kyokuTimeout(nextTurn, 1000); 
}

function seatDistanceFromDiscarder(pIdx) {
    return (pIdx - currentDiscard.pIdx + 4) % 4;
}

function resolveActions() {
    if (!isWaitingAction || !currentDiscard) return;
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
            let nPlayer = naki.pIdx;
            const nUnit = typeof naki.payload === 'string' ? naki.payload : naki.payload.unitName;
            const allowHandAlmighty = typeof naki.payload === 'object' && naki.payload !== null
                ? naki.payload.allowHandAlmighty !== false
                : true;
            if (playerRiichi[nPlayer]) continue;
            const can = checkCanNaki(playerHands[nPlayer], currentDiscard.tile, allowHandAlmighty);
            if (!can || !can.includes(nUnit)) continue;
            if (!canNakiWithDiscardLeft(nPlayer, currentDiscard.tile, nUnit, allowHandAlmighty)) continue;

            if (clerkState.active && !clerkState.interruptedByNaki && currentDiscard.pIdx === clerkState.originalPlayer) {
                if (clerkState.discardsLeft === 1) clerkState.firstNakiPlayer = nPlayer;
                else if (clerkState.discardsLeft === 0) clerkState.secondNakiPlayer = nPlayer;
                clerkState.interruptedByNaki = true;
            }

            let usedTiles = consumeUnitFromHand(playerHands[nPlayer], nUnit, currentDiscard.tile, allowHandAlmighty);
            openTiles[nPlayer].push(...usedTiles);
            openUnitNames[nPlayer].push(nUnit);
            discards[currentDiscard.pIdx].pop();
            
            broadcast({ type: 'DISCARD_REMOVED', pIdx: currentDiscard.pIdx, discards: discards, handLens: getHandLens(), openTiles: getOpenTiles(), playerRiichi: playerRiichi, riichiSticks: riichiSticks, riichiDiscardIndex: riichiDiscardIndex, scores: playerScores });
            
            broadcast({ type: 'ACTION_TOAST', text: 'スカウト！', actionType: 'scout' });
            broadcast({ type: 'MSG', msg: `${globalPlayerNames[nPlayer]} がスカウトしました` });

            currentTurn = nPlayer; currentTurnHasDrawn = true;
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

function processAgari(pIdx, isTsumo, spentExtraSeconds = 0) {
    if (!kyokuActive) return false;
    chargeThinkingPool(pIdx, spentExtraSeconds);
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
    const scoresBefore = [...playerScores];
    const riichiSticksAwarded = riichiSticks;
    const isDealer = pIdx === currentDealer;
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
        broadcast({ type: 'KYOKU_OVER', isRyukyoku: false, pIdx, isTsumo, hand: fullHand, score: legacyScoreObj, scores: playerScores, scoresBefore, riichiSticks: riichiSticks, riichiSticksAwarded, units: res.units });
        prepareNextKyoku(pIdx === currentDealer);
        return true;
    }
}

function isPlayerTenpai(pIdx) {
    const info = getTenpaiInfo(playerHands[pIdx], openTiles[pIdx] || [], false, pIdx);
    return info.some(t => t.waits && t.waits.length > 0);
}

function settleRyukyokuAndEnd() {
    const scoresBefore = [...playerScores];
    const tenpai = [0, 1, 2, 3].map(i => isPlayerTenpai(i));
    const tCount = tenpai.filter(Boolean).length;
    const notenBappu = [
        { notenPays: 0, tenpaiReceives: 0 },
        { notenPays: 1000, tenpaiReceives: 3000 },
        { notenPays: 1500, tenpaiReceives: 1500 },
        { notenPays: 3000, tenpaiReceives: 1000 },
        { notenPays: 0, tenpaiReceives: 0 }
    ][tCount];
    for (let i = 0; i < 4; i++) {
        if (tenpai[i]) playerScores[i] += notenBappu.tenpaiReceives;
        else playerScores[i] -= notenBappu.notenPays;
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
        scoresBefore,
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

let resultStage = 'details';
function resetResultStage() {
    resultStage = 'details';
    document.getElementById('result-hand').style.display = '';
    document.getElementById('result-yaku').style.display = '';
    document.getElementById('result-score-text').style.display = '';
    document.getElementById('result-point-transfer').style.display = 'none';
    const button = document.getElementById('btn-next-kyoku');
    button.innerText = '点数移動を見る';
    button.onclick = advanceResultStage;
}

function renderPointTransfer(scoresBefore, scoresAfter, note = '') {
    const panel = document.getElementById('result-point-transfer');
    panel.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'result-transfer-title';
    title.innerText = '点数移動';
    panel.appendChild(title);

    const table = document.createElement('div');
    table.className = 'result-transfer-table';
    const appendCell = (text, className = '') => {
        const cell = document.createElement('div');
        cell.className = `result-transfer-cell ${className}`.trim();
        cell.innerText = text;
        table.appendChild(cell);
        return cell;
    };

    appendCell('', 'header name');
    appendCell('移動前', 'header');
    appendCell('移動後', 'header');
    appendCell('増減', 'header');

    for (let i = 0; i < 4; i++) {
        const before = Number((scoresBefore || scoresAfter)[i] || 0);
        const after = Number(scoresAfter[i] || 0);
        const delta = after - before;
        appendCell(globalPlayerNames[i] || `プレイヤー${i + 1}`, 'name');
        appendCell(`${before.toLocaleString('ja-JP')}点`);
        appendCell(`${after.toLocaleString('ja-JP')}点`);
        const deltaCell = appendCell(`${delta > 0 ? '+' : ''}${delta.toLocaleString('ja-JP')}点`, 'delta');
        deltaCell.style.color = delta > 0 ? '#81c784' : delta < 0 ? '#ef9a9a' : '#ddd';
    }
    panel.appendChild(table);

    if (note) {
        const noteElement = document.createElement('div');
        noteElement.className = 'result-transfer-note';
        noteElement.innerText = note;
        panel.appendChild(noteElement);
    }
}

function showActionPrompt(text) {
    const prompt = document.getElementById('action-prompt');
    const tableArea = document.getElementById('table-area');
    const river = document.getElementById('river-0');
    if (!prompt || !tableArea || !river) return;
    prompt.innerText = text;
    prompt.style.display = 'block';
    const tableRect = tableArea.getBoundingClientRect();
    const riverRect = river.getBoundingClientRect();
    const promptHeight = prompt.getBoundingClientRect().height;
    prompt.style.top = `${Math.max(4, riverRect.top - tableRect.top - promptHeight - 8)}px`;
}

function advanceResultStage() {
    if (resultStage === 'details') {
        resultStage = 'transfer';
        document.getElementById('result-hand').style.display = 'none';
        document.getElementById('result-yaku').style.display = 'none';
        document.getElementById('result-score-text').style.display = 'none';
        document.getElementById('result-point-transfer').style.display = 'block';
        document.getElementById('btn-next-kyoku').innerText = '次へ進む';
        return;
    }
    sendReadyNext();
}

function handleReadyNext() {
    readyForNextKyokuCount++;
    const humanCount = playerRoles.filter(role => role !== 'CPU').length;
    if (readyForNextKyokuCount >= humanCount) proceedToNextKyoku();
}

function sendReadyNext() {
    document.getElementById('btn-next-kyoku').style.display = 'none';
    document.getElementById('next-kyoku-msg').style.display = 'block';
    if (isHost) handleReadyNext();
    else sendToHost({ type: 'READY_NEXT' });
}

function proceedToNextKyoku() {
    if (hasTobi()) {
        kyokuActive = false;
        broadcast({ type: 'MATCH_OVER', scores: playerScores, reason: 'tobi' });
        return;
    }
    if (!isNextRenchan) {
        currentDealer = (currentDealer + 1) % 4;
        currentKyoku++;
        if (currentKyoku > 4) { currentKyoku = 1; currentBakaze++; }
    }
    if (currentBakaze >= gameRuleMaxRounds) {
        kyokuActive = false;
        broadcast({ type: 'MATCH_OVER', scores: playerScores, reason: 'end' });
    } else {
        startKyoku();
    }
}

let myLocalHand = []; let roleMap = [];

function toggleRiichi() {
    isPendingRiichi = !isPendingRiichi;
    const button = document.getElementById('btn-riichi');
    button.style.background = isPendingRiichi ? '#ff5722' : '#ff9800';
    renderHand(isMyTurnNow);
}

function toggleLockUnit(unitName) {
    if (lockedUnits.has(unitName)) lockedUnits.delete(unitName);
    else lockedUnits.add(unitName);
    reorderLockedTilesToLeft();
    renderHand(isMyTurnNow);
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
    
    let usedTiles = consumeUnitFromHand([...myLocalHand], unitName, discardedTile, useAlmightyForNaki);
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

const idolImageStates = new Map();
const idolImageQueue = [];
let activeIdolImageLoads = 0;
const MAX_IDOL_IMAGE_LOADS = 4;

function revealTileImage(image, fallback, src) {
    image.onload = () => {
        const revealImage = () => {
            image.style.visibility = 'visible';
            image.style.display = '';
            fallback.style.display = 'none';
        };
        const revealFallback = () => {
            image.style.display = 'none';
            image.style.visibility = 'hidden';
            fallback.style.display = '';
        };
        if (image.naturalWidth <= 0) {
            revealFallback();
        } else if (typeof image.decode === 'function') {
            image.decode().then(revealImage).catch(revealFallback);
        } else {
            revealImage();
        }
    };
    image.onerror = () => {
        image.style.display = 'none';
        image.style.visibility = 'hidden';
        fallback.style.display = '';
    };
    fallback.style.display = '';
    image.style.display = '';
    image.style.visibility = 'hidden';
    image.src = src;
    if (image.complete && image.naturalWidth > 0) image.onload();
}

function pumpIdolImageQueue() {
    while (activeIdolImageLoads < MAX_IDOL_IMAGE_LOADS && idolImageQueue.length) {
        const state = idolImageQueue.shift();
        if (state.status !== 'queued') continue;
        state.status = 'loading';
        activeIdolImageLoads++;
        const loader = new Image();
        loader.decoding = 'async';
        let settled = false;
        const finish = success => {
            if (settled) return;
            settled = true;
            clearTimeout(state.timeout);
            state.status = success ? 'loaded' : 'failed';
            state.src = success ? loader.src : '';
            activeIdolImageLoads--;
            state.listeners.splice(0).forEach(({ image, fallback }) => {
                if (success) revealTileImage(image, fallback, state.src);
                else if (!success) { image.style.display = 'none'; fallback.style.display = ''; }
            });
            pumpIdolImageQueue();
        };
        loader.onload = () => finish(loader.naturalWidth > 0);
        loader.onerror = () => finish(false);
        state.timeout = setTimeout(() => finish(false), 10000);
        loader.src = state.srcPath;
    }
}

function requestIdolImage(image, fallback, tileName) {
    let state = idolImageStates.get(tileName);
    if (state && state.status === 'loaded') {
        revealTileImage(image, fallback, state.src);
        return;
    }
    if (state && state.status === 'failed') {
        image.style.display = 'none';
        image.style.visibility = 'hidden';
        fallback.style.display = '';
        return;
    }
    if (!state) {
        state = { status: 'queued', srcPath: `idol_images/${encodeURIComponent(tileName)}.png`, src: '', listeners: [] };
        idolImageStates.set(tileName, state);
        idolImageQueue.push(state);
    }
    state.listeners.push({ image, fallback });
    pumpIdolImageQueue();
}

function createTileElement(tileText, isHand = false, onClick = null) {
    const div = document.createElement('div'); div.className = 'mahjong-tile';
    if(!tileText) return div;
    div.dataset.tile = tileText;
    if(tileText.includes('ｵｰﾙﾏｲﾃｨ') || tileText === 'P（ｼﾞｮｰｶｰ）') div.classList.add('almighty');
    if(tileText === '青葉美咲' || tileText === '音無小鳥') div.classList.add('clerk');
    
    let displayText = tileText;
    if(tileText === 'Prｵｰﾙﾏｲﾃｨ') displayText = 'Pr';
    else if(tileText === 'Faｵｰﾙﾏｲﾃｨ') displayText = 'Fa';
    else if(tileText === 'Anｵｰﾙﾏｲﾃｨ') displayText = 'An';
    else if(tileText === 'P（ｼﾞｮｰｶｰ）') displayText = 'P';
    
    const fallback = document.createElement('span');
    fallback.className = 'tile-text';
    fallback.innerText = displayText;
    div.appendChild(fallback);

    const hasTileImage = IDOLS.Princess.includes(tileText) || IDOLS.Fairy.includes(tileText) || IDOLS.Angel.includes(tileText);
    if (hasTileImage) {
        const img = document.createElement('img');
        img.decoding = 'async';
        img.alt = '';
        img.style.visibility = 'hidden';
        div.appendChild(img);
        requestIdolImage(img, fallback, tileText);
    }

    if(onClick) { div.onclick = onClick; div.style.cursor = 'pointer'; }
    return div;
}

function getRelPos(targetId) { return (targetId - myId + 4) % 4; }

function renderOtherHands() {
    for (let i = 1; i <= 3; i++) {
        const absId = (myId + i) % 4; 
        const div = document.getElementById(`hand-${i}`);
        const meldDiv = document.getElementById(`melds-${i}`);
        const closedCount = globalHandLens[absId] || 0; 
        const openArr = globalOpenTiles[absId] || [];

        while (div.children.length > closedCount) div.lastElementChild.remove();
        while (div.children.length < closedCount) {
            const tile = document.createElement('div');
            tile.className = 'mahjong-tile facedown';
            div.appendChild(tile);
        }

        const meldSignature = openArr.join('\u001f');
        if (meldDiv && meldDiv.dataset.tileSignature !== meldSignature) {
            meldDiv.replaceChildren();
            for (let j = 0; j < openArr.length; j++) {
                const tile = createTileElement(openArr[j]);
                tile.classList.add('open-tile');
                meldDiv.appendChild(tile);
            }
            meldDiv.dataset.tileSignature = meldSignature;
        }
    }
}

function getRemaining(req, visibleTiles) {
    let initialCount = (req.includes('ｵｰﾙﾏｲﾃｨ') || req === 'P（ｼﾞｮｰｶｰ）' || req === '青葉美咲' || req === '音無小鳥') ? 1 : 2;
    let seenCount = visibleTiles.filter(t => t === req).length;
    return Math.max(0, initialCount - seenCount);
}

let _progressKey = '';
let _progressTimer = null;
let _tenpaiProgressKey = '';
let _tenpaiProgressCache = [];
function scheduleProgressUI() {
    const key = myLocalHand.join(',') + '|' + (globalOpenTiles[myId] || []).join(',') + '|' + [...lockedUnits].sort().join(',') + '|' + useAlmForProgress;
    if (key === _progressKey) return;
    clearTimeout(_progressTimer);
    _progressTimer = setTimeout(() => {
        _progressKey = key;
        const run = () => updateProgressUI();
        if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 800 });
        else run();
    }, 480);
}

function updateProgressUI() {
    const progressList = document.getElementById('progress-list'); progressList.innerHTML = '';
    
    let visibleTiles = [...myLocalHand];
    for(let i=0; i<4; i++) {
        if(globalOpenTiles[i]) visibleTiles.push(...globalOpenTiles[i]);
        if(discards[i]) visibleTiles.push(...discards[i]);
    }

    const openTiles = globalOpenTiles[myId] || [];
    const riichiTurn = !!globalPlayerRiichi[myId] && isMyTurnNow;
    const navHand = riichiTurn ? myLocalHand.slice(0, -1) : myLocalHand;
    const tenpaiKey = [
        navHand.slice().sort().join(','),
        openTiles.slice().sort().join(','),
        discards.map(river => river.join(',')).join('|'),
        isMyTurnNow,
        myId,
        currentDealer,
        playerScores[myId],
        playerFavorites[myId],
        !!globalPlayerRiichi[myId]
    ].join('~');
    if (tenpaiKey !== _tenpaiProgressKey) {
        _tenpaiProgressCache = getTenpaiInfo(
            navHand,
            openTiles,
            isMyTurnNow && !globalPlayerRiichi[myId],
            myId,
            true,
            !!globalPlayerRiichi[myId]
        );
        _tenpaiProgressKey = tenpaiKey;
    }
    const tenpaiInfo = _tenpaiProgressCache.slice().sort((a, b) => {
        if (a.discard === null) return b.discard === null ? 0 : -1;
        if (b.discard === null) return 1;
        return navHand.indexOf(a.discard) - navHand.indexOf(b.discard);
    });
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
        if (completedNakiUnits.has(unitName)) return;
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

    const candidateUnits = [];
    const seenU = Object.create(null);
    OFFICIAL_UNITS.forEach(unit => {
        if (unit.members.some(tile => remainingHand.includes(tile)) && !seenU[unit.name]) {
            seenU[unit.name] = 1;
            candidateUnits.push(unit);
        }
    });
    candidateUnits.forEach(unit => {
        if (lockedUnits.has(unit.name) || completedNakiUnits.has(unit.name)) return;
        
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
            
            const stick = globalPlayerRiichi[i] ? '<div class="riichi-stick" title="立直棒"></div>' : '';
            box.innerHTML = `<span class="score-name">${dealerMark}${nName}</span><span class="score-val">${scores[i]}</span>${stick}`;
            
            if (i === clientCurrentTurn) {
                box.classList.add('active-turn');
            } else {
                box.classList.remove('active-turn');
            }
        }
    } 
}

let lastAskCouldRon = false;

function currentThinkingPool(pIdx = myId) {
    const remaining = playerThinkingPools[pIdx];
    return Number.isFinite(remaining) ? Math.max(0, remaining) : roomTimerSettings.poolSeconds;
}

function chargeThinkingPool(pIdx, spentExtraSeconds = 0) {
    if (playerRoles[pIdx] === 'CPU') return;
    const spent = Math.min(currentThinkingPool(pIdx), Math.max(0, Math.ceil(Number(spentExtraSeconds) || 0)));
    playerThinkingPools[pIdx] = currentThinkingPool(pIdx) - spent;
}

function finishDecisionTimer() {
    if (!activeDecisionTimer) return 0;
    clearInterval(actionTimerInterval);
    const elapsed = Math.min(
        activeDecisionTimer.basicSeconds + activeDecisionTimer.poolSeconds,
        (Date.now() - activeDecisionTimer.startedAt) / 1000
    );
    const extra = Math.min(activeDecisionTimer.poolSeconds, Math.max(0, Math.ceil(elapsed - activeDecisionTimer.basicSeconds)));
    activeDecisionTimer = null;
    return extra;
}

function startDecisionTimer(label, onExpire, isNakiDecision = false) {
    clearInterval(actionTimerInterval);
    layoutActionBudget();
    const budget = document.getElementById('action-budget');
    const noTurnLimit = roomTimerSettings.basicSeconds === 0 && roomTimerSettings.poolSeconds === 0;
    if (noTurnLimit && !isNakiDecision) {
        activeDecisionTimer = null;
        if (budget) {
            budget.innerText = '';
            budget.style.visibility = 'hidden';
        }
        return;
    }
    const fixedNakiLimit = noTurnLimit && isNakiDecision;
    activeDecisionTimer = {
        startedAt: Date.now(),
        basicSeconds: fixedNakiLimit ? 10 : roomTimerSettings.basicSeconds,
        poolSeconds: fixedNakiLimit ? 0 : currentThinkingPool(),
        fixedNakiLimit
    };
    const update = () => {
        if (!activeDecisionTimer) return;
        const elapsed = (Date.now() - activeDecisionTimer.startedAt) / 1000;
        if (budget) {
            budget.style.visibility = 'visible';
            if (activeDecisionTimer.fixedNakiLimit) {
                budget.innerText = `0秒＋${Math.max(0, Math.ceil(activeDecisionTimer.basicSeconds - elapsed))}秒`;
            } else {
                const basicLeft = Math.max(0, Math.ceil(activeDecisionTimer.basicSeconds - elapsed));
                const extraElapsed = Math.max(0, Math.ceil(elapsed - activeDecisionTimer.basicSeconds));
                const poolLeft = Math.max(0, activeDecisionTimer.poolSeconds - extraElapsed);
                budget.innerText = `${basicLeft}秒＋${poolLeft}秒`;
            }
        }
        if (elapsed >= activeDecisionTimer.basicSeconds + activeDecisionTimer.poolSeconds) {
            const extra = finishDecisionTimer();
            onExpire(extra);
        }
    };
    update();
    actionTimerInterval = setInterval(update, 250);
}

function startActionTimer() {
    startDecisionTimer('ロン・鳴き判断', extra => {
        sendAction('SKIP', null, extra);
        hideActions();
    }, true);
}

function startDiscardTimer(label = '打牌してください', canTsumo = false) {
    const actionBar = document.getElementById('action-bar');
    const riichiButton = document.getElementById('btn-riichi');
    actionBar.style.display = canTsumo || riichiButton.style.display !== 'none' ? 'flex' : 'none';
    showActionPrompt(label);
    if (!canTsumo) document.getElementById('btn-tsumo').style.display = 'none';
    document.getElementById('btn-ron').style.display = 'none';
    const nakiContainer = document.getElementById('naki-buttons-container');
    if (nakiContainer) nakiContainer.innerHTML = '';
    document.getElementById('btn-skip').style.display = 'none';
    startDecisionTimer(label, extra => {
        isPendingRiichi = false;
        autoDiscard(extra);
    });
}

function autoDiscard(spentExtraSeconds = 0) {
    let unlocked = getUnlockedHand();
    if (unlocked.length > 0) {
        sendAction('DISCARD', { tile: unlocked[unlocked.length - 1], isRiichi: false }, spentExtraSeconds);
    } else {
        sendAction('DISCARD', { tile: myLocalHand[myLocalHand.length - 1], isRiichi: false }, spentExtraSeconds);
    }
    hideActions();
}

function handleHostMsg(data) {
    if (data.timerSettings) roomTimerSettings = data.timerSettings;
    if (data.thinkingPools) playerThinkingPools = data.thinkingPools;
    if (data.handLens) globalHandLens = data.handLens;
    if (data.openTiles) globalOpenTiles = data.openTiles;
    if (data.openUnitNames) globalOpenUnitNames = data.openUnitNames;
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
        replaceCustomUnits(data.customUnits || []);
        hideWaitOverlay();
        const dov = document.getElementById('disconnect-overlay');
        if (dov) dov.style.display = 'none';
        globalPlayerNames = data.names;
        playerFavorites = data.favorites || [null, null, null, null];
        document.getElementById('result-overlay').style.display = 'none';
        myId = data.pId; myLocalHand = data.hand; roleMap = data.roles; lockedUnits.clear(); completedNakiUnits.clear(); currentLockedIndices.clear();
        currentDealer = data.dealer;
        clientCurrentTurn = data.dealer;
        discards = [[],[],[],[]];
        localSkipFuriten = false;
        lastAskCouldRon = false;
        selectedHandIdx = -1;
        _progressKey = "";
        _progressKey = "";
        
        document.getElementById('setup-panel').style.display = 'none'; 
        document.getElementById('app-container').style.display = 'flex'; 
        document.getElementById('btn-open-unit-login').style.display = 'none';
        document.getElementById('btn-return-lobby').style.display = 'block';
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
        validRiichiDiscards = [];
        if (!globalPlayerRiichi[myId]) localSkipFuriten = false;
        myLocalHand.push(data.tile); reorderLockedTilesToLeft(); isMyTurnNow = true; renderHand(true); 
        showActionToast('あなたの番です', 'turn'); 
        
        let fullHand = [...myLocalHand, ...(globalOpenTiles[myId] || [])];
        let globalMemo = {};
        let agariCheck = checkPlayerAgari(myLocalHand, myId, globalMemo);
        
        if(agariCheck.isValid) { 
            let isClosed = (globalOpenTiles[myId] || []).length === 0;
            let isDealer = (myId === currentDealer);
            let scoreInfo = scoreHand(agariCheck.units, fullHand, globalOpenTiles[myId] || [], data.tile, isClosed, globalPlayerRiichi[myId], true, isDealer, myId);
            
            if (scoreInfo.han > 0) {
                pendingAutoWinAction = 'TSUMO';
                if (autoWinEnabled) {
                    sendAction('TSUMO');
                    hideActions();
                    return;
                }
                document.getElementById('action-bar').style.display = 'flex'; 
                showActionPrompt('ツモできます');
                document.getElementById('btn-tsumo').style.display = 'inline-block'; 
                document.getElementById('btn-ron').style.display = 'none'; 
                document.getElementById('btn-skip').style.display = 'none'; 
                document.getElementById('btn-riichi').style.display = 'none';
                let nakiContainer = document.getElementById('naki-buttons-container');
                if(nakiContainer) nakiContainer.innerHTML = '';
                startDiscardTimer('ツモできます', true);
                return;
            }
        }
        
        if (globalPlayerRiichi[myId]) {
            setTimeout(() => { 
                if(isMyTurnNow) { hideActions(); sendAction('DISCARD', { tile: data.tile, isRiichi: false }); }
            }, 800);
        } else {
            let discardPrompt = '打牌してください';
            if ((globalOpenTiles[myId] || []).length === 0 && playerScores[myId] >= 1000) {
                let tInfo = getTenpaiInfo(myLocalHand, [], true, myId);
                let validWaits = tInfo.filter(t => t.waits.length > 0);
                if (validWaits.length > 0) {
                    validRiichiDiscards = validWaits.map(w => w.discard);
                    document.getElementById('action-bar').style.display = 'flex';
                    showActionPrompt('リーチ可能です');
                    document.getElementById('btn-riichi').style.display = 'inline-block';
                    discardPrompt = 'リーチ可能です';
                }
            }
            startDiscardTimer(discardPrompt);
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
    if(data.type === 'CLERK_DRAW') {
        myLocalHand.push(...data.drawn);
        reorderLockedTilesToLeft();
        isMyTurnNow = true;
        renderHand(true);
        showActionToast('あなたの番です', 'turn');
        startDiscardTimer(`事務員牌の効果: ${data.discardsLeft}枚切ってください`);
    }
    if(data.type === 'TURN_CONTINUE') { 
        clientCurrentTurn = data.pIdx; updateScores(playerScores);
        if(data.pIdx === myId) {
            isMyTurnNow = true;
            renderHand(true);
            showActionToast('あなたの番です', 'turn');
            startDiscardTimer(`事務員牌の効果: 残り${data.clerkDiscardsLeft}枚切ってください`);
        }
        renderOtherHands(); 
    }
    
    if(data.type === 'ASK_ACTION') {
        if(data.discarder !== myId && roleMap[myId] !== 'CPU') {
            let fullHand = [...myLocalHand, ...(globalOpenTiles[myId] || []), data.tile];
            let globalMemo = {};
            let agariCheck = checkPlayerAgari([...myLocalHand, data.tile], myId, globalMemo);
            let canRon = false;
            
            if (agariCheck.isValid) {
                let isClosed = (globalOpenTiles[myId] || []).length === 0;
                let isDealer = (myId === currentDealer);
                let scoreInfo = scoreHand(agariCheck.units, fullHand, globalOpenTiles[myId] || [], data.tile, isClosed, globalPlayerRiichi[myId], false, isDealer, myId);
                if (scoreInfo.han > 0) canRon = true;
            }
            if (canRon && clientIsFuriten()) canRon = false;
            lastAskCouldRon = canRon;
            pendingAutoWinAction = canRon ? 'RON' : null;
            if (canRon && autoWinEnabled) {
                sendAction('RON');
                hideActions();
                return;
            }
            
            let unlocked = getUnlockedHand();
            let nakiUnits = globalPlayerRiichi[myId] ? null : checkCanNaki(unlocked, data.tile, useAlmightyForNaki);

            if (canRon || nakiUnits) {
                document.getElementById('action-bar').style.display = 'flex';
                showActionPrompt('ロン・鳴き判断');
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
                        btn.onclick = () => {
                            sendAction('NAKI', { unitName: u, allowHandAlmighty: useAlmightyForNaki });
                            hideActions();
                        };
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
        if (data.unitName) {
            lockedUnits.delete(data.unitName);
            completedNakiUnits.add(data.unitName);
        }
        reorderLockedTilesToLeft(); isMyTurnNow = true; renderHand(true); showActionToast('あなたの番です', 'turn');
        let fullHand = [...myLocalHand, ...(globalOpenTiles[myId] || [])];
        
        let globalMemo = {};
        let agariCheck = checkPlayerAgari(myLocalHand, myId, globalMemo);
        if(agariCheck.isValid) { 
            let isClosed = (globalOpenTiles[myId] || []).length === 0;
            let isDealer = (myId === currentDealer);
            let scoreInfo = scoreHand(agariCheck.units, fullHand, globalOpenTiles[myId] || [], null, isClosed, globalPlayerRiichi[myId], false, isDealer, myId);
            
            if (scoreInfo.han > 0) {
                pendingAutoWinAction = 'TSUMO';
                if (autoWinEnabled) {
                    sendAction('TSUMO');
                    hideActions();
                    return;
                }
                document.getElementById('action-bar').style.display = 'flex'; 
                showActionPrompt('ツモできます');
                document.getElementById('btn-tsumo').style.display = 'inline-block'; 
                document.getElementById('btn-ron').style.display = 'none'; 
                document.getElementById('btn-skip').style.display = 'none'; 
                document.getElementById('btn-riichi').style.display = 'none';
                let nakiContainer = document.getElementById('naki-buttons-container');
                if (nakiContainer) nakiContainer.innerHTML = ''; 
                startDiscardTimer('ツモできます', true);
                return;
            }
        }
        startDiscardTimer();
    }
    
    if(data.type === 'KYOKU_OVER') {
        hideActions(); updateScores(data.scores); document.getElementById('action-status').style.visibility = 'hidden';
        document.getElementById('btn-endmatch').style.display = 'none';
        resetResultStage();
        
        if (data.isRyukyoku) {
            document.getElementById('result-winner').innerText = `流局`; 
            document.getElementById('result-hand').innerHTML = ''; 
            const extra = (data.ryukyokuLines && data.ryukyokuLines.length)
                ? data.ryukyokuLines.join('<br>')
                : '山札が尽きました';
            const ren = data.dealerRenchan ? '<br>親テンパイのため連荘' : '';
            document.getElementById('result-yaku').innerHTML = extra + ren; 
            document.getElementById('result-score-text').innerText = ''; 
            const sticks = data.riichiSticks || 0;
            const note = sticks ? `供託 ${sticks} 本は次局へ持ち越し` : '';
            renderPointTransfer(data.scoresBefore, data.scores, note);
            document.getElementById('btn-next-kyoku').style.display = 'inline-block';
            document.getElementById('next-kyoku-msg').style.display = 'none';
            document.getElementById('result-overlay').style.display = 'flex';
        } else {
            showCutin(data.isTsumo ? 'ツモ！' : 'ロン！', data.isTsumo ? '#4aa9e6' : '#ff0055');
            setTimeout(() => {
                document.getElementById('result-winner').innerText = '点数移動';
                
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
                const sticks = data.riichiSticksAwarded || 0;
                const note = sticks ? `供託 ${sticks} 本（${(sticks * 1000).toLocaleString('ja-JP')}点）は和了者が獲得` : '';
                renderPointTransfer(data.scoresBefore, data.scores, note);
                resultStage = 'transfer';
                document.getElementById('result-point-transfer').style.display = 'block';
                document.getElementById('btn-next-kyoku').style.display = 'inline-block';
                document.getElementById('btn-next-kyoku').innerText = '次へ進む';
                document.getElementById('next-kyoku-msg').style.display = 'none';
                document.getElementById('result-overlay').style.display = 'flex';
            }, 1200);
        }
    }

    if(data.type === 'MATCH_OVER') {
        resetResultStage();
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
    const div = document.getElementById('my-hand-area');
    const openDiv = document.getElementById('my-open-area');
    const closedTilesByName = new Map();
    const openTilesByName = new Map();
    const collectReusableTiles = (container, tilesByName) => {
        Array.from(container.children).forEach(element => {
            if (!element.classList.contains('mahjong-tile')) return;
            const tile = element.dataset.tile;
            if (!tilesByName.has(tile)) tilesByName.set(tile, []);
            tilesByName.get(tile).push(element);
        });
    };
    collectReusableTiles(div, closedTilesByName);
    collectReusableTiles(openDiv, openTilesByName);
    const takeReusableTile = (tilesByName, tile) => {
        const matching = tilesByName.get(tile);
        return matching && matching.length ? matching.shift() : createTileElement(tile, true);
    };
    const closedTiles = [];

    myLocalHand.forEach((tile, idx) => {
        let isLocked = currentLockedIndices.has(idx);
        let isClickable = isMyTurn && !isLocked;
        
        if (globalPlayerRiichi[myId]) {
            isClickable = false;
        }

        if (isPendingRiichi && !validRiichiDiscards.includes(tile)) {
            isClickable = false;
        }

        let el = takeReusableTile(closedTilesByName, tile);
        el.dataset.handKind = 'closed';
        el.dataset.handIndex = String(idx);
        el.classList.remove('open-tile');
        el.classList.toggle('locked-tile', isLocked);
        el.classList.toggle('disabled', !isClickable);
        el.classList.toggle('tile-selected', selectedHandIdx === idx);
        el.style.cursor = isClickable ? 'pointer' : 'default';
        el.onclick = null;
        el.draggable = false;
        el.ondragstart = null;
        el.ondragend = null;
        el.ondragover = null;
        el.ondrop = null;
        if (isClickable) {
            el.onclick = (ev) => {
                ev.preventDefault();
                if (isCoarsePointer()) {
                    if (selectedHandIdx === idx) discardFromHand(tile);
                    else { selectedHandIdx = idx; renderHand(isMyTurnNow); }
                } else {
                    discardFromHand(tile);
                }
            };
        }
        if (!isLocked && !isCoarsePointer()) {
            el.draggable = true;
            el.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(idx)); el.style.opacity = '0.5'; };
            el.ondragend = () => { el.style.opacity = '1'; };
            el.ondragover = (e) => { e.preventDefault(); };
            el.ondrop = (e) => { e.preventDefault(); let fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10); if(isNaN(fromIdx) || fromIdx === idx) return; let movingTile = myLocalHand.splice(fromIdx, 1)[0]; myLocalHand.splice(idx, 0, movingTile); selectedHandIdx = -1;
        _progressKey = ""; reorderLockedTilesToLeft(); renderHand(isMyTurnNow); };
        }
        closedTiles.push(el);
    });
    
    let myOpen = globalOpenTiles[myId] || [];
    const openTiles = [];
    myOpen.forEach(tile => {
        let el = takeReusableTile(openTilesByName, tile);
        el.dataset.handKind = 'open';
        el.classList.add('open-tile'); el.style.cursor = 'default';
        openTiles.push(el);
    });

    const reconcileTiles = (container, desiredTiles) => {
        desiredTiles.forEach((element, index) => {
            const current = container.children[index] || null;
            if (current !== element) container.insertBefore(element, current);
        });
        while (container.children.length > desiredTiles.length) container.lastElementChild.remove();
    };
    reconcileTiles(div, closedTiles);
    reconcileTiles(openDiv, openTiles);
    layoutActionBudget();
    scheduleProgressUI();
}

function hideActions() { 
    pendingAutoWinAction = null;
    clearInterval(actionTimerInterval); 
    document.getElementById('action-budget').innerText = '';
    document.getElementById('action-budget').style.visibility = 'hidden';
    document.getElementById('action-prompt').style.display = 'none';
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

function syncAppViewport() {
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-h', `${height}px`);
    requestAnimationFrame(layoutTable);
}
populateFavoriteIdolSelector();
syncAppViewport();
window.addEventListener('resize', syncAppViewport);
window.addEventListener('orientationchange', () => setTimeout(syncAppViewport, 200));
if (window.visualViewport) window.visualViewport.addEventListener('resize', syncAppViewport);