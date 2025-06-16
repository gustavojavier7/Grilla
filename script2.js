const COLORS = ['gris-ondas', 'verde', 'cyan', 'puntos-blancos', 'rayado', 'magenta'];
let gameContainer = document.getElementById('grid-container');
let board = [];
let cellReferences = [];
let firstSelected = null;
let isProcessing = false;
let score = 0;
let roundsInCascade = 1;
let totalRemovedThisCascade = 0;
let contadorDeCeldasEnRonda = 0;
let rows = 6;
let cols = 6;
let cellCounts = {};
let totalCellsRemoved = 0;
let secondarySeparatorVisible = true;
let lastUpdateTime = 0;
let countdown = 60; // 1 minuto en segundos
let countdownStarted = false;
let cascadeHistory = []; // Historial de cascadas
let currentCascadeCount = 0; // Contador de cascadas en la ronda actual
let cellsRemovedHistory = []; // Historial de celdas removidas en las últimas 5 jugadas
let timeoutIds = []; // Array para almacenar los IDs de los timeouts
let intervalIds = []; // Array para almacenar los IDs de los intervals
const updateInterval = 1000; // 1s
const SEPARATOR_COLORS = {
    ON: 'yellow',
    OFF: 'black'
};

COLORS.forEach(color => {
    cellCounts[color] = 0;
});

function checkSelections() {
    const difficulty = document.getElementById('difficulty').value;
    console.log("Dificultad seleccionada:", difficulty);
    document.getElementById('fill-grid-btn').disabled = !difficulty;
    document.getElementById('reset-game-btn').disabled = !difficulty;
}

function initializeSeparators() {
    document.querySelectorAll('.separador').forEach(separator => {
        separator.style.backgroundColor = SEPARATOR_COLORS.ON;
    });
    document.querySelectorAll('.separador-sec').forEach(separator => {
        separator.style.backgroundColor = SEPARATOR_COLORS.ON;
    });
}

function toggleSeparators() {
    secondarySeparatorVisible = !secondarySeparatorVisible;
    document.querySelectorAll('.separador-sec').forEach(separator => {
        separator.style.backgroundColor = secondarySeparatorVisible ? SEPARATOR_COLORS.ON : SEPARATOR_COLORS.OFF;
    });
}

// Nueva función para manejar el parpadeo del separador principal
function toggleMainSeparator() {
    const mainSeparator = document.getElementById('separador-principal');
    if (countdownStarted && countdown > 0 && !isProcessing) {
        mainSeparator.classList.add('blink');
    } else {
        mainSeparator.classList.remove('blink');
    }
}

function manageClock() {
    document.querySelectorAll('#reloj-sec .separador-sec').forEach(separator => {
        separator.classList.remove('paused');
        separator.style.backgroundColor = secondarySeparatorVisible ? SEPARATOR_COLORS.ON : SEPARATOR_COLORS.OFF;
    });
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
    if (isProcessing || !document.getElementById('difficulty').value) return; // Asegurarse de que se haya seleccionado una dificultad

    resetScore();
    totalCellsRemoved = 0;
    updateCellsRemovedDisplay();
    countdownStarted = true; // Iniciar el conteo regresivo

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

        const timeoutId = setTimeout(() => {
            removePulsatingCells(matches);
        }, 1000);
        timeoutIds.push(timeoutId);
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

    const timeoutId = setTimeout(() => {
        matches.forEach(coord => {
            const [row, col] = coord.split(',').map(Number);
            const color = board[row][col];
            board[row][col] = null;
            cellReferences[row][col].className = 'cell';
            cellCounts[color]--;
            totalCellsRemoved++;
            contadorDeCeldasEnRonda++; // Incrementa las celdas eliminadas en esta ronda
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

            roundsInCascade++;
            totalRemovedThisCascade += newMatches.size;

            const timeoutId = setTimeout(() => {
                removePulsatingCells(newMatches);
            }, 1000);
            timeoutIds.push(timeoutId);
        } else {
            cascadeHistory.push(totalRemovedThisCascade);
            if (cascadeHistory.length > 5) {
                cascadeHistory.shift();
            }

            const cascadeScore = calculateCascadeScore(totalRemovedThisCascade, roundsInCascade);
            score += cascadeScore;
            updateScore();
            applyScoreBlink();

            totalRemovedThisCascade = 0;
            roundsInCascade = 1;
            isProcessing = false;

            const cells = document.querySelectorAll('.cell');
            cells.forEach(cell => cell.classList.remove('processing'));
        }

        updateColorSamples();
    }, 1000);
    timeoutIds.push(timeoutId);
}

function checkNewMatches() {
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

    return matches;
}

function calculateCascadeScore(cellsRemoved, cascadeRounds) {
    const baseScore = cellsRemoved * 10;
    const cascadeBonus = (cascadeRounds - 1) * 50;
    return baseScore + cascadeBonus;
}

function updateScore() {
    const formattedScore = score.toString().padStart(16, '0');
    const scoreDisplay = `${formattedScore.slice(0, 4)}-${formattedScore.slice(4, 8)}-${formattedScore.slice(8, 12)}-${formattedScore.slice(12, 16)}`;
    document.getElementById('current-score').textContent = scoreDisplay;

    const average = cellsRemovedHistory.length > 0 ? (cellsRemovedHistory.reduce((a, b) => a + b, 0) / cellsRemovedHistory.length).toFixed(2) : '0.00';
    document.getElementById('current-average').textContent = average;
}

function resetScore() {
    score = 0;
    contadorDeCeldasEnRonda = 0; // Reinicia el contador de celdas en ronda
    updateScore();
    COLORS.forEach(color => {
        cellCounts[color] = 0;
    });
    updateColorSamples();
}

function resetGame() {
    isProcessing = false;
    firstSelected = null;
    countdown = 60;
    countdownStarted = false;

    document.getElementById('minutos').textContent = '01';
    document.getElementById('segundos').textContent = '00';

    // Detener el parpadeo del separador principal
    const mainSeparator = document.getElementById('separador-principal');
    mainSeparator.classList.remove('blink');

    timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutIds = [];

    intervalIds.forEach(intervalId => clearInterval(intervalId));
    intervalIds = [];

    const overlay = document.getElementById('game-over-overlay');
    overlay.style.display = 'none';

    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.classList.remove('processing', 'matched', 'selected');
    });

    resetScore();
    contadorDeCeldasEnRonda = 0; // Reinicia el contador de celdas en ronda
    updateCellsRemovedDisplay();

    const difficultySelect = document.getElementById('difficulty');
    const difficulty = difficultySelect.value;
    if (difficulty) {
        rows = cols = parseInt(difficulty, 10);
        createGrid(rows, cols);
    }

    initializeSeparators();
}

function clearAllTimeouts() {
    timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutIds = [];
}

function clearAllIntervals() {
    intervalIds.forEach(intervalId => clearInterval(intervalId));
}

function applyScoreBlink() {
    if (!isProcessing) {
        const scoreElement = document.getElementById('current-score');
        scoreElement.classList.add('blink-score');
        const timeoutId = setTimeout(() => {
            scoreElement.classList.remove('blink-score');
        }, 2000);
        timeoutIds.push(timeoutId);
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
            showGameOver(color, threshold); // Pase el color y el umbral
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

function showGameOver(reason, threshold = null) {
    const overlay = document.getElementById('game-over-overlay');
    const message = document.getElementById('game-over-message');
    const gameOverReason = document.getElementById('game-over-reason');
    const gameOverThreshold = document.getElementById('game-over-threshold');

    // Detener el parpadeo del separador principal cuando termine el juego
    const mainSeparator = document.getElementById('separador-principal');
    mainSeparator.classList.remove('blink');

    if (reason === 'Tiempo agotado') {
        gameOverReason.textContent = '¡Se acabó el tiempo!';
        gameOverThreshold.style.display = 'none';
    } else {
        gameOverReason.textContent = `El color/patrón "${reason}" alcanzó`;
        gameOverThreshold.textContent = `${threshold} o más celdas.`;
        gameOverThreshold.style.display = 'inline';
    }

    overlay.style.display = 'flex';
    isProcessing = true; // Asegúrate de que esto está en true para evitar nuevas interacciones
    document.querySelectorAll('.cell').forEach(cell => cell.classList.add('processing'));
}

function updateCellsRemovedDisplay() {
    // Mostrar el total de celdas eliminadas
    const totalCellsRemovedElement = document.getElementById('cells-removed');
    totalCellsRemovedElement.textContent = totalCellsRemoved;

    // Mostrar las celdas eliminadas en la ronda actual
    const cellsRemovedInRoundElement = document.getElementById('cells-removed-in-round');
    cellsRemovedInRoundElement.textContent = contadorDeCeldasEnRonda;

    // Añadir animación de parpadeo
    totalCellsRemovedElement.classList.add('blink-cells-removed');
    cellsRemovedInRoundElement.classList.add('blink-cells-removed');
    setTimeout(() => {
        totalCellsRemovedElement.classList.remove('blink-cells-removed');
        cellsRemovedInRoundElement.classList.remove('blink-cells-removed');
    }, 1000);
}

function contadorRegresivo() {
    const now = performance.now();
    if (now - lastUpdateTime > updateInterval) {
        if (countdownStarted && countdown > 0 && !isProcessing) {
            countdown--;
            const minutes = Math.floor(countdown / 60).toString().padStart(2, '0');
            const seconds = (countdown % 60).toString().padStart(2, '0');
            document.getElementById('minutos').textContent = minutes;
            document.getElementById('segundos').textContent = seconds;
        }
        if (countdown === 0 && countdownStarted) {
            showGameOver('Tiempo agotado', 0);
        }

        // El reloj secundario sigue funcionando como antes
        document.getElementById('horas-sec').textContent = new Date().getHours().toString().padStart(2, '0');
        document.getElementById('minutos-sec').textContent = new Date().getMinutes().toString().padStart(2, '0');
        document.getElementById('segundos-sec').textContent = new Date().getSeconds().toString().padStart(2, '0');

        // Solo parpadea el reloj secundario
        toggleSeparators();
        
        // Manejar el parpadeo del separador principal del cronómetro
        toggleMainSeparator();

        lastUpdateTime = now;
    }
    requestAnimationFrame(contadorRegresivo);
}

document.addEventListener('DOMContentLoaded', () => {
    // Asegurar que el gameContainer esté disponible
    gameContainer = document.getElementById('grid-container');
    
    // Vincular el evento 'change' al selector de dificultad
    const difficultySelect = document.getElementById('difficulty');
    difficultySelect.addEventListener('change', () => {
        const difficulty = difficultySelect.value;
        console.log("Dificultad seleccionada:", difficulty);
        document.getElementById('fill-grid-btn').disabled = !difficulty;
        document.getElementById('reset-game-btn').disabled = !difficulty;
    });

    // Inicializa el juego
    resetGame();
    requestAnimationFrame(contadorRegresivo);
});

createGrid(rows, cols);
updateColorSamples();

