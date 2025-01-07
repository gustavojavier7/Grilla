const COLORS = ['gris-ondas', 'verde', 'cyan', 'puntos-blancos', 'rayado', 'magenta'];
let gameContainer = document.getElementById('game-container');
let board = [];
let cellReferences = [];
let firstSelected = null;
let isProcessing = false;
let score = 0;
let cascadeMultiplier = 1;
let roundsInCascade = 1;
let totalRemovedThisCascade = 0;
let rows = 6;
let cols = 6;
let cellCounts = {};
let totalCellsRemoved = 0;
let globalClock = { hours: '00', minutes: '00', seconds: '00' };
let separatorVisible = true;
let lastUpdateTime = 0;
const updateInterval = 500; // 500 milisegundos


COLORS.forEach(color => {
    cellCounts[color] = 0;
});

function updateClockMaster() {
    const now = new Date();
    globalClock.hours = now.getHours().toString().padStart(2, '0');
    globalClock.minutes = now.getMinutes().toString().padStart(2, '0');
    globalClock.seconds = now.getSeconds().toString().padStart(2, '0');
}

function renderClocks() {
    if (!isProcessing) {
        document.getElementById('horas').textContent = globalClock.hours;
        document.getElementById('minutos').textContent = globalClock.minutes;
        document.getElementById('segundos').textContent = globalClock.seconds;
    }
    document.getElementById('horas-sec').textContent = globalClock.hours;
    document.getElementById('minutos-sec').textContent = globalClock.minutes;
    document.getElementById('segundos-sec').textContent = globalClock.seconds;
}

function toggleSeparators() {
    separatorVisible = !separatorVisible;
    document.querySelectorAll('.separador').forEach(separator => {
        if (isProcessing) {
            separator.classList.add('paused');
        } else {
            separator.classList.remove('paused');
        }
    });
}

function manageClock() {
    if (isProcessing) {
        document.querySelectorAll('#reloj .separador').forEach(separator => {
            separator.classList.add('paused');
        });
    } else {
        document.querySelectorAll('#reloj .separador').forEach(separator => {
            separator.classList.remove('paused');
        });
    }
}

function checkSelections() {
    const difficulty = document.getElementById('difficulty').value;
    document.getElementById('fill-grid-btn').disabled = !difficulty;
    document.getElementById('reset-game-btn').disabled = !difficulty;
}

function createGrid(rows, cols) {
    gameContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gameContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    gameContainer.innerHTML = '';
    board = Array.from({ length: rows }, () => Array(cols).fill(null));
    cellReferences = Array.from({ length: rows }, () => Array(cols).fill(null));

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cellReferences[row][col] = cell;
            cell.addEventListener('click', () => handleCellClick(cell));
            gameContainer.appendChild(cell);
        }
    }
}

function fillGrid() {
    if (isProcessing) return;
    resetScore();
    totalCellsRemoved = 0;
    updateCellsRemovedDisplay();

    const difficulty = document.getElementById('difficulty').value;
    if (difficulty) {
        rows = cols = parseInt(difficulty, 10);
    }

    createGrid(rows, cols);

    document.querySelectorAll('.cell').forEach(cell => {
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        const row = cell.dataset.row;
        const col = cell.dataset.col;
        board[row][col] = randomColor;
        cell.className = `cell ${randomColor}`;
        cellCounts[randomColor]++;
    });
    checkPatterns();
}

function handleCellClick(cell) {
    if (isProcessing) return;

    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    if (firstSelected === null) {
        firstSelected = { row, col, element: cell };
        cell.classList.add('selected');
    } else {
        const isAdjacent = (row === firstSelected.row && Math.abs(col - firstSelected.col) === 1) ||
                           (col === firstSelected.col && Math.abs(row - firstSelected.row) === 1);

        if (isAdjacent) {
            swapColors(firstSelected, { row, col, element: cell });
            checkPatterns();
        }

        firstSelected.element.classList.remove('selected');
        firstSelected = null;
    }
}

function swapColors(cell1, cell2) {
    const tempColor = board[cell1.row][cell1.col];
    board[cell1.row][cell1.col] = board[cell2.row][cell2.col];
    board[cell2.row][cell2.col] = tempColor;

    cell1.element.className = `cell ${board[cell1.row][cell1.col]}`;
    cell2.element.className = `cell ${board[cell2.row][cell2.col]}`;
}

function checkLine(startRow, startCol, deltaRow, deltaCol) {
    const color = board[startRow][startCol];
    for (let i = 1; i < 3; i++) {
        const row = startRow + i * deltaRow;
        const col = startCol + i * deltaCol;
        if (board[row][col] !== color) return false;
    }
    return true;
}

function checkPatterns() {
    if (isProcessing) return;
    isProcessing = true;
    manageClock();
    const cells = document.querySelectorAll('.cell');
    const rows = board.length;
    const cols = board[0].length;
    const matches = new Set();

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (board[row][col]) {
                if (col < cols - 2 && checkLine(row, col, 0, 1)) {
                    matches.add(`${row},${col}`);
                    matches.add(`${row},${col + 1}`);
                    matches.add(`${row},${col + 2}`);
                }
                if (row < rows - 2 && checkLine(row, col, 1, 0)) {
                    matches.add(`${row},${col}`);
                    matches.add(`${row + 1},${col}`);
                    matches.add(`${row + 2},${col}`);
                }
                if (row < rows - 2 && col < cols - 2 && checkLine(row, col, 1, 1)) {
                    matches.add(`${row},${col}`);
                    matches.add(`${row + 1},${col + 1}`);
                    matches.add(`${row + 2},${col + 2}`);
                }
                if (row > 1 && col < cols - 2 && checkLine(row, col, -1, 1)) {
                    matches.add(`${row},${col}`);
                    matches.add(`${row - 1},${col + 1}`);
                    matches.add(`${row - 2},${col + 2}`);
                }
            }
        }
    }

    if (matches.size > 0) {
        roundsInCascade = 1;
        totalRemovedThisCascade += matches.size;

        matches.forEach(coord => {
            const [row, col] = coord.split(',').map(Number);
            const cell = cellReferences[row][col];
            cell.classList.add('matched');
        });

        setTimeout(() => {
            removePulsatingCells(matches);
        }, 1000);
    } else {
        isProcessing = false;
        cells.forEach(cell => cell.classList.remove('processing'));
    }
}

function removePulsatingCells(matches) {
    const rows = board.length;
    const cols = board[0].length;

    matches.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        const cell = cellReferences[row][col];
        cell.classList.remove('matched');
    });

    matches.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        const cell = cellReferences[row][col];
        cell.classList.add('matched');
    });

    setTimeout(() => {
        matches.forEach(coord => {
            const [row, col] = coord.split(',').map(Number);
            const color = board[row][col];
            board[row][col] = null;
            cellReferences[row][col].className = 'cell';
            cellCounts[color]--;
            totalCellsRemoved++;
        });
        updateCellsRemovedDisplay();

        let newMatches = new Set();

        for (let col = 0; col < cols; col++) {
            let emptySpaceCount = 0;

            for (let row = rows - 1; row >= 0; row--) {
                if (board[row][col] === null) {
                    emptySpaceCount++;
                } else if (emptySpaceCount > 0) {
                    const newRow = row + emptySpaceCount;
                    board[newRow][col] = board[row][col];
                    cellReferences[newRow][col].className = `cell ${board[newRow][col]}`;
                    board[row][col] = null;
                    cellReferences[row][col].className = 'cell';
                }
            }

            for (let row = 0; emptySpaceCount > 0; row++, emptySpaceCount--) {
                const newColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                board[row][col] = newColor;
                cellReferences[row][col].className = `cell ${newColor}`;
                cellCounts[newColor]++;
            }
        }

        newMatches = checkNewMatches();
        if (newMatches.size > 0) {
            newMatches.forEach(coord => {
                const [row, col] = coord.split(',').map(Number);
                const cell = cellReferences[row][col];
                cell.classList.remove('matched');
                cell.classList.add('matched');
            });

            const n = Math.log2(roundsInCascade) + 1;
            roundsInCascade = Math.pow(2, n);
            totalRemovedThisCascade += newMatches.size;

            const scoreIncrement = totalRemovedThisCascade * roundsInCascade;
            incrementScoreAnimated(scoreIncrement, 2000, 20);

            setTimeout(() => {
                removePulsatingCells(newMatches);
            }, 1000);
        } else {
            isProcessing = false;
            manageClock();
            let finalPoints = totalRemovedThisCascade * roundsInCascade;
            score += finalPoints;
            updateScoreDisplay();

            cascadeMultiplier = 1;
            roundsInCascade = 1;
            totalRemovedThisCascade = 0;

            isProcessing = false;
            manageClock();
            document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('processing'));

            applyScoreBlink();
        }
    }, 1000);
    updateColorSamples();
}

function checkNewMatches() {
    const rows = board.length;
    const cols = board[0].length;
    const newMatches = new Set();

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (board[row][col]) {
                if (col < cols - 2 && checkLine(row, col, 0, 1)) {
                    newMatches.add(`${row},${col}`);
                    newMatches.add(`${row},${col + 1}`);
                    newMatches.add(`${row},${col + 2}`);
                }
                if (row < rows - 2 && checkLine(row, col, 1, 0)) {
                    newMatches.add(`${row},${col}`);
                    newMatches.add(`${row + 1},${col}`);
                    newMatches.add(`${row + 2},${col}`);
                }
                if (row < rows - 2 && col < cols - 2 && checkLine(row, col, 1, 1)) {
                    newMatches.add(`${row},${col}`);
                    newMatches.add(`${row + 1},${col + 1}`);
                    newMatches.add(`${row + 2},${col + 2}`);
                }
                if (row > 1 && col < cols - 2 && checkLine(row, col, -1, 1)) {
                    newMatches.add(`${row},${col}`);
                    newMatches.add(`${row - 1},${col + 1}`);
                    newMatches.add(`${row - 2},${col + 2}`);
                }
            }
        }
    }

    return newMatches;
}

function updateScoreDisplay() {
    let scoreString = score.toString().padStart(16, '0');
    let formattedScore = scoreString.match(/.{1,4}/g).join('-');
    document.getElementById('current-score').textContent = formattedScore;
}

function resetScore() {
    score = 0;
    updateScoreDisplay();
}

function resetGame() {
    score = 0;
    cascadeMultiplier = 1;
    roundsInCascade = 1;
    totalRemovedThisCascade = 0;
    totalCellsRemoved = 0;
    updateCellsRemovedDisplay();

    cellCounts = {};
    COLORS.forEach(color => {
        cellCounts[color] = 0;
    });

    updateScoreDisplay();
    createGrid(rows, cols);
    fillGrid();
    updateColorSamples();

    const overlay = document.getElementById('game-over-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
window.resetGame = resetGame;

function incrementScoreAnimated(incrementBy, duration, steps) {
    const targetScore = score + incrementBy;
    const stepSize = Math.round(incrementBy / steps);
    let stepsCompleted = 0;
    const intervalId = setInterval(() => {
        if (stepsCompleted < steps - 1) {
            score += stepSize;
            updateScoreDisplay();
            stepsCompleted++;
        } else {
            score = targetScore;
            updateScoreDisplay();
            clearInterval(intervalId);
        }
    }, duration / steps);
}

function applyScoreBlink() {
    if (!isProcessing) {
        const scoreElement = document.getElementById('current-score');
        scoreElement.classList.add('blink-score');
        setTimeout(() => {
            scoreElement.classList.remove('blink-score');
        }, 2000);
    }
}

function updateColorSamples() {
    const threshold = getGameOverThreshold(rows, cols);
    COLORS.forEach(color => {
        const count = cellCounts[color];
        const totalCells = rows * cols;
        const percent = ((count / totalCells) * 100).toFixed(2);

        const cellSample = document.querySelector(`.cell-sample.${color}`);
        cellSample.querySelector('span').textContent = count;
        cellSample.setAttribute('data-percentage', `${percent}%`);

        if (threshold !== null && count >= threshold) {
            cellSample.classList.add('blink-threshold');
            showGameOver(color, threshold);
        } else {
            cellSample.classList.remove('blink-threshold');
        }
    });
}

function getGameOverThreshold(rows, cols) {
    const baseThreshold = 50;
    const baseGridSize = 15 * 15;

    if ((rows === 6 && cols === 6) || (rows === 10 && cols === 10)) {
        return null;
    }

    const currentGridSize = rows * cols;
    return Math.floor((baseThreshold / baseGridSize) * currentGridSize);
}

function showGameOver(color, threshold) {
    const overlay = document.getElementById('game-over-overlay');
    const colorElement = document.getElementById('game-over-color');
    const thresholdElement = document.getElementById('game-over-threshold');

    colorElement.textContent = color;
    thresholdElement.textContent = threshold;
    overlay.style.display = 'flex';

    isProcessing = true;
    document.querySelectorAll('.cell').forEach(cell => cell.classList.add('processing'));
}

function updateCellsRemovedDisplay() {
    const cellsRemovedElement = document.getElementById('cells-removed');
    cellsRemovedElement.textContent = totalCellsRemoved;

    cellsRemovedElement.classList.add('blink-cells-removed');
    setTimeout(() => {
        cellsRemovedElement.classList.remove('blink-cells-removed');
    }, 1000);
}

function animate() {
    const now = performance.now();
    if (now - lastUpdateTime > updateInterval) {
        updateClockMaster();
        renderClocks();
        if (!isProcessing) {
            toggleSeparators();
        }
        lastUpdateTime = now;
    }
    // Usar requestAnimationFrame para el siguiente ciclo, pero no para cada actualización
    requestAnimationFrame(animate);
}


document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(animate);
});

createGrid(rows, cols);
updateColorSamples();
