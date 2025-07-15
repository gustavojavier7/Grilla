const COLORS = ['gris-ondas', 'verde', 'cyan', 'cuadricula-pequena', 'rayado', 'magenta'];
const FALL_DURATION = 0.2; // duration in seconds for a single fall animation
const FALL_STAGGER_DELAY = 0; // delay between consecutive cell falls in a column
let gameContainer = document.getElementById('game-container');
let board = [];
let cellReferences = [];
let firstSelected = null;
let isProcessing = false;
let score = 0;
let roundsInCascade = 1;
let totalRemovedThisCascade = 0;
let contadorDeCeldasEnRonda = 0;
let rows = 10;
let cols = 10;
let cellCounts = {};
let totalCellsRemoved = 0;
let mainSeparatorVisible = true;
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
    ON: 'black',    // Visible: texto negro
    OFF: 'transparent'  // Invisible: texto transparente
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
        separator.style.color = SEPARATOR_COLORS.ON;
    });
    document.querySelectorAll('.separador-sec').forEach(separator => {
        separator.style.color = SEPARATOR_COLORS.ON;
    });
}

function toggleSeparators() {
    secondarySeparatorVisible = !secondarySeparatorVisible;
    document.querySelectorAll('.separador-sec').forEach(separator => {
        separator.style.color = secondarySeparatorVisible ? SEPARATOR_COLORS.ON : SEPARATOR_COLORS.OFF;
    });
}

function manageClock() {
    document.querySelectorAll('#reloj-sec .separador-sec').forEach(separator => {
        separator.classList.remove('paused');
        separator.style.color = secondarySeparatorVisible ? SEPARATOR_COLORS.ON : SEPARATOR_COLORS.OFF;
    });
}

function addFallAnimation(cell, delay = 0, initialOffset = 0, isNewCell = false) {
    // Set initial state (hidden above or at original position)
    cell.style.transition = 'none'; // Disable transition for initial positioning
    cell.style.transform = `translateY(${initialOffset}px)`;
    if (isNewCell) {
        cell.style.opacity = '0';
    }
    
    // Force reflow to apply the initial transform immediately
    void cell.offsetWidth; 

    // Re-enable transition and animate to final position (translateY(0))
    cell.style.transition = `transform ${FALL_DURATION}s cubic-bezier(0.42, 0, 1.0, 1.0) ${delay}s, opacity ${FALL_DURATION}s linear ${delay}s`;
    cell.style.transform = 'translateY(0)';
    if (isNewCell) {
        cell.style.opacity = '1';
    }

    // Clean up inline styles after animation
    const transitionEndHandler = () => {
        cell.style.transition = ''; // Remove inline transition
        cell.style.transform = ''; // Remove inline transform
        cell.style.opacity = ''; // Remove inline opacity
        cell.removeEventListener('transitionend', transitionEndHandler);
    };
    cell.addEventListener('transitionend', transitionEndHandler);
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    countdownStarted = true;  // Iniciar el conteo regresivo

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
        handleCascade(matches);
    } else {
        isProcessing = false;
        cells.forEach(cell => cell.classList.remove('processing'));
    }
}

async function handleCascade(matches) {
    // Previously the grid flashed here; effect removed
    matches.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        const cell = cellReferences[row][col];
        cell.classList.add('matched');
    });
    await wait(700);
    await processMatchedCells(matches);
}

function getNewWeightedColorOptimized(row, col) {
    // Ordenar colores por conteo (menor a mayor para priorizar los menos comunes)
    const sortedColors = COLORS.slice().sort((a, b) => {
        const countA = cellCounts[a] || 0;
        const countB = cellCounts[b] || 0;
        return countA - countB;
    });

    // Iterar sobre los colores para encontrar el primero "seguro"
    for (const color of sortedColors) {
        const isSafe = !(
            // Verificaciones verticales
            (row < board.length - 2 && board[row + 1][col] === color && board[row + 2][col] === color) || // Abajo
            (row > 1 && board[row - 1][col] === color && board[row - 2][col] === color) || // Arriba

            // Verificaciones horizontales
            (col > 1 && board[row][col - 1] === color && board[row][col - 2] === color) || // Izquierda
            (col < board[0].length - 2 && board[row][col + 1] === color && board[row][col + 2] === color) || // Derecha
            (col > 0 && col < board[0].length - 1 && board[row][col - 1] === color && board[row][col + 1] === color) || // Centro horizontal

            // Verificaciones diagonales (solo si están dentro de límites)
            (row < board.length - 2 && col < board[0].length - 2 && board[row + 1][col + 1] === color && board[row + 2][col + 2] === color) || // Diagonal descendente derecha
            (row > 1 && col > 1 && board[row - 1][col - 1] === color && board[row - 2][col - 2] === color) || // Diagonal ascendente izquierda
            (row < board.length - 2 && col > 1 && board[row + 1][col - 1] === color && board[row + 2][col - 2] === color) || // Diagonal descendente izquierda
            (row > 1 && col < board[0].length - 2 && board[row - 1][col + 1] === color && board[row - 2][col + 2] === color) // Diagonal ascendente derecha
        );

        if (isSafe) {
            return color; // Retornar el primer color seguro encontrado
        }
    }

    // Fallback: Si todos los colores son inseguros (caso raro), devolver el menos común
    return sortedColors[0];
}

async function processMatchedCells(matches) {
    const rows = board.length;
    const cols = board[0].length;

    // Remove matched effect and clear matched cells
    matches.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        const cell = cellReferences[row][col];
        cell.classList.remove('matched');
        const color = board[row][col];
        board[row][col] = null;
        cell.className = 'cell'; // Clear visual of old cell
        cellCounts[color]--;
        totalCellsRemoved++;
        contadorDeCeldasEnRonda++;
    });
    updateCellsRemovedDisplay();

    let newMatches = new Set();
    let maxDelay = 0;

    for (let col = 0; col < cols; col++) {
        let emptySpaceCount = 0;
        let delayIndex = 0;

        for (let row = rows - 1; row >= 0; row--) {
            if (board[row][col] === null) {
                emptySpaceCount++;
            } else if (emptySpaceCount > 0) {
                const oldRow = row;
                const newRow = row + emptySpaceCount;
                const fallingColor = board[oldRow][col];

                board[newRow][col] = fallingColor;
                board[oldRow][col] = null;

                const targetCellElement = cellReferences[newRow][col];
                const oldCellElement = cellReferences[oldRow][col];

                oldCellElement.className = 'cell';
                targetCellElement.className = `cell ${fallingColor}`;

                const distanceToMoveUp = emptySpaceCount * (40 + 2);
                addFallAnimation(targetCellElement, delayIndex * FALL_STAGGER_DELAY, -distanceToMoveUp, false);

                if (delayIndex * FALL_STAGGER_DELAY > maxDelay) maxDelay = delayIndex * FALL_STAGGER_DELAY;
                delayIndex++;
            }
        }

        // Handle newly generated cells at the top
        for (let i = 0; i < emptySpaceCount; i++) {
            const targetRow = (emptySpaceCount - 1) - i;
            
            // *** NEW LOGIC: Get a weighted random color that doesn't create an immediate match ***
            const newColor = getNewWeightedColorOptimized(targetRow, col);
            
            board[targetRow][col] = newColor;
            cellReferences[targetRow][col].className = `cell ${newColor}`;
            
            const distanceToFall = (emptySpaceCount - i) * (40 + 2);
            addFallAnimation(cellReferences[targetRow][col], delayIndex * FALL_STAGGER_DELAY, -distanceToFall, true);
            
            if (delayIndex * FALL_STAGGER_DELAY > maxDelay) maxDelay = delayIndex * FALL_STAGGER_DELAY;
            cellCounts[newColor]++;
            delayIndex++;
        }
    }

    await wait((maxDelay + FALL_DURATION) * 1000);

    newMatches = checkNewMatches();

    if (newMatches.size > 0) {
        const n = Math.log2(roundsInCascade) + 1;
        roundsInCascade = Math.pow(2, n);
        totalRemovedThisCascade += newMatches.size;

        const scoreIncrement = totalRemovedThisCascade * roundsInCascade;
        incrementScoreAnimated(scoreIncrement, 2000, 20);

        await handleCascade(newMatches);
    } else {
        isProcessing = false;
        manageClock();
        let finalPoints = totalRemovedThisCascade * roundsInCascade;
        score += finalPoints;
        updateScoreDisplay();

        cellsRemovedHistory.push(contadorDeCeldasEnRonda);
        if (cellsRemovedHistory.length > 5) {
            cellsRemovedHistory.shift();
        }

        if (cellsRemovedHistory.length > 1) {
            const averageCellsRemoved = cellsRemovedHistory.reduce((sum, value) => sum + value, 0) / cellsRemovedHistory.length;
            document.getElementById('current-average').textContent = averageCellsRemoved.toFixed(3).padStart(7, '0');
            console.log(`Promedio de celdas removidas: ${averageCellsRemoved.toFixed(2)}`);

            if (contadorDeCeldasEnRonda > averageCellsRemoved) {
                const extraTime = Math.ceil(contadorDeCeldasEnRonda);
                countdown += extraTime;
                console.log(`Tiempo extendido por ${extraTime} segundos. Nuevo tiempo: ${countdown} segundos.`);
            }
        } else if (cellsRemovedHistory.length === 1) {
            document.getElementById('current-average').textContent = cellsRemovedHistory[0].toFixed(3).padStart(7, '0');
        }

        roundsInCascade = 1;
        totalRemovedThisCascade = 0;
        contadorDeCeldasEnRonda = 0;
        isProcessing = false;
        manageClock();
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('processing');
        });
        applyScoreBlink();
    }
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

function clearAllTimeouts() {
    timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutIds = [];
}

function clearAllIntervals() {
    intervalIds.forEach(intervalId => clearInterval(intervalId));
    intervalIds = [];
}

function resetGame() {
    // Detener todas las animaciones y procesos en curso
    clearAllTimeouts();
    clearAllIntervals();

    // Restablece el puntaje y los contadores
    score = 0;
    countdown = 60;
    countdownStarted = false;
    cascadeMultiplier = 1;
    roundsInCascade = 1;
    totalRemovedThisCascade = 0;
    totalCellsRemoved = 0;
    cellsRemovedHistory = [];
    contadorDeCeldasEnRonda = 0;
    updateCellsRemovedDisplay();

    // Restablece los contadores de colores
    cellCounts = {};
    COLORS.forEach(color => {
        cellCounts[color] = 0;
    });

    // Actualiza la visualización del puntaje
    updateScoreDisplay();
    document.getElementById('current-average').textContent = '000.000';
    
    // Recrea la cuadrícula y la llena con colores aleatorios
    createGrid(rows, cols);
    fillGrid();

    // Actualiza la muestra de colores
    updateColorSamples();

    // Oculta el overlay de "GAME OVER" si está visible
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }

    // Asegúrate de que el juego puede ser jugado de nuevo
    isProcessing = false;

    // Habilita botones basados en la selección de dificultad
    checkSelections();
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
    intervalIds.push(intervalId);
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
    // La lógica de umbral se ha deshabilitado

    // Find the top two counts
    const sortedCounts = Object.entries(cellCounts).sort(([, a], [, b]) => b - a);
    const topTwoColors = sortedCounts.slice(0, 2).map(([color]) => color);

    COLORS.forEach(color => {
        const count = cellCounts[color];
        const totalCells = rows * cols;
        const percent = ((count / totalCells) * 100).toFixed(2);

        const cellSample = document.querySelector(`.cell-sample.${color}`);
        const span = cellSample.querySelector('span');
        span.textContent = count;
        cellSample.setAttribute('data-percentage', `${percent}%`);

        // Highlight if the color is one of the top two
        if (topTwoColors.includes(color)) {
            span.classList.add('highlight-max-count');
        } else {
            span.classList.remove('highlight-max-count');
        }

        // La verificación de umbral se ha eliminado; simplemente limpiamos la clase
        cellSample.classList.remove('blink-threshold');
    });
}

function getGameOverThreshold(rows, cols) {
    // La funcionalidad de umbral se ha desactivado por completo
    return null;
}

function showGameOver(reason) {
    const overlay = document.getElementById('game-over-overlay');
    const message = document.getElementById('game-over-message');
    const gameOverReason = document.getElementById('game-over-reason');
    const gameOverThreshold = document.getElementById('game-over-threshold');

    if (reason === 'Tiempo agotado') {
        gameOverReason.textContent = '¡Se acabó el tiempo!';
        gameOverThreshold.style.display = 'none';
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
        const separadorPrincipal = document.getElementById('separador-principal');

        if (countdownStarted && countdown > 0 && !isProcessing) {
            countdown--;
            const minutes = Math.floor(countdown / 60).toString().padStart(2, '0');
            const seconds = (countdown % 60).toString().padStart(2, '0');
            document.getElementById('minutos').textContent = minutes;
            document.getElementById('segundos').textContent = seconds;

            if (separadorPrincipal) {
                mainSeparatorVisible = !mainSeparatorVisible;
                separadorPrincipal.style.color = mainSeparatorVisible ? SEPARATOR_COLORS.ON : SEPARATOR_COLORS.OFF;
                console.log('Separador Principal (activo): ', separadorPrincipal.style.color);
            }
        } else {
            if (separadorPrincipal) {
                separadorPrincipal.style.color = SEPARATOR_COLORS.ON;
                console.log('Separador Principal (pausado/terminado): ', separadorPrincipal.style.color);
            }
        }

        if (countdown === 0 && countdownStarted) {
            showGameOver('Tiempo agotado');
        }

        document.getElementById('horas-sec').textContent = new Date().getHours().toString().padStart(2, '0');
        document.getElementById('minutos-sec').textContent = new Date().getMinutes().toString().padStart(2, '0');
        document.getElementById('segundos-sec').textContent = new Date().getSeconds().toString().padStart(2, '0');
        
        toggleSeparators();
        lastUpdateTime = now;
    }

    requestAnimationFrame(contadorRegresivo);
}

document.addEventListener('DOMContentLoaded', () => {
    const difficultySelect = document.getElementById('difficulty');
    const difficulties = [10, 15, 20];
    difficultySelect.innerHTML = '<option value="">--Seleccionar--</option>' +
        difficulties.map(d => `<option value="${d}">${d}x${d}</option>`).join('');
    difficultySelect.addEventListener('change', () => {
        const difficulty = difficultySelect.value;
        console.log("Dificultad seleccionada:", difficulty);
        document.getElementById('fill-grid-btn').disabled = !difficulty;
        document.getElementById('reset-game-btn').disabled = !difficulty;
    });

    resetGame();
    requestAnimationFrame(contadorRegresivo);
});

createGrid(rows, cols);
updateColorSamples();
