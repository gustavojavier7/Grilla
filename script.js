const COLORS = ['gris-ondas', 'verde', 'cyan', 'puntos-blancos', 'rayado', 'magenta'];
let gameContainer = document.getElementById('game-container');
let board = [];
let cellReferences = [];
let firstSelected = null;
let isProcessing = false; // Indica si el efecto cascada o parpadeo está en proceso
let score = 0;
let cascadeMultiplier = 1;
let roundsInCascade = 1; // Inicializado en 1
let totalRemovedThisCascade = 0;
let rows = 6; // Valor por defecto
let cols = 6; // Valor por defecto
let chosenColor = null;

function checkSelections() {
    const difficulty = document.getElementById('difficulty').value;
    const colorChoice = document.getElementById('color-choice').value;
    const fillGridBtn = document.getElementById('fill-grid-btn');

    if (difficulty && colorChoice) {
        fillGridBtn.disabled = false;
    } else {
        fillGridBtn.disabled = true;
    }
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
    if (isProcessing) return; // Evitar que se rellenen celdas mientras se procesa
    resetScore(); // Resetear el puntaje al rellenar celdas
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        const row = cell.dataset.row;
        const col = cell.dataset.col;
        board[row][col] = randomColor;
        cell.className = `cell ${randomColor}`;
    });
    checkPatterns();
}

function handleCellClick(cell) {
    if (isProcessing) return; // Ignorar clics mientras el efecto cascada o parpadeo están activos

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
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.classList.add('processing')); // Bloquear interacciones

    const rows = board.length;
    const cols = board[0].length;
    const matches = new Set();

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (board[row][col]) {
                // Mantener la lógica existente para encontrar patrones
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
        roundsInCascade = 1; // Inicializar roundsInCascade en la primera ronda
        totalRemovedThisCascade += matches.size;

        matches.forEach(coord => {
            const [row, col] = coord.split(',').map(Number);
            const cell = cellReferences[row][col];
            cell.classList.add('matched');
        });

        // Iniciar el destello sincronizado durante 1 segundo
        setTimeout(() => {
            removePulsatingCells(matches);
        }, 1000);
    } else {
        // No resetear cascadeMultiplier aquí
        isProcessing = false;
        cells.forEach(cell => cell.classList.remove('processing')); // Permitir interacciones
        applyScoreBlink(); // Aplicar parpadeo rápido al puntaje

        // Verificar si el jugador ha ganado
        if (chosenColor && document.querySelectorAll(`.cell.${chosenColor}`).length === 0) {
            alert('¡Felicidades! Has ganado eliminando todas las celdas del color/patrón elegido.');
        }
    }
}

function removePulsatingCells(matches) {
    const rows = board.length;
    const cols = board[0].length;

    matches.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        board[row][col] = null; // Vaciar la celda
        cellReferences[row][col].className = 'cell'; // Limpiar la clase de la celda
    });

    let newMatches = new Set(); // Para almacenar nuevas coincidencias formadas durante la caída

    for (let col = 0; col < cols; col++) {
        let emptySpaceCount = 0;

        for (let row = rows - 1; row >= 0; row--) {
            if (board[row][col] === null) {
                emptySpaceCount++;
            } else if (emptySpaceCount > 0) {
                // Mover la celda hacia abajo para llenar el espacio vacío
                const newRow = row + emptySpaceCount;
                board[newRow][col] = board[row][col];
                cellReferences[newRow][col].className = `cell ${board[row][col]}`;

                // Limpiar la celda original
                board[row][col] = null;
                cellReferences[row][col].className = 'cell';
            }
        }

        // Llenar las celdas superiores que ahora están vacías
        for (let row = 0; emptySpaceCount > 0; row++, emptySpaceCount--) {
            const newColor = COLORS[Math.floor(Math.random() * COLORS.length)];
            board[row][col] = newColor;
            cellReferences[row][col].className = `cell ${newColor}`;
        }
    }

    // Verificar si hay nuevas coincidencias después de la cascada
    newMatches = checkNewMatches();
    if (newMatches.size > 0) {
        newMatches.forEach(coord => {
            const [row, col] = coord.split(',').map(Number);
            const cell = cellReferences[row][col];
            cell.classList.add('matched');
        });

        // Incrementar exponencialmente roundsInCascade
        const n = Math.log2(roundsInCascade) + 1;
        roundsInCascade = Math.pow(2, n);
        totalRemovedThisCascade += newMatches.size;

        // Incremento de puntaje con animación
        const scoreIncrement = totalRemovedThisCascade * roundsInCascade;

        // Aquí podrías añadir una animación de incremento si lo deseas, similar al ejemplo anterior
        incrementScoreAnimated(scoreIncrement, 2000, 20); // 2000ms duración total, 20 pasos

        setTimeout(() => {
            removePulsatingCells(newMatches);
        }, 1000);
    } else {
        // Calcular el puntaje final basado en la cascada completa
        let finalPoints = totalRemovedThisCascade * roundsInCascade;
        score += finalPoints;
        updateScoreDisplay(); // Usar la función mejorada para mostrar el puntaje con parpadeo

        // Resetear los contadores
        cascadeMultiplier = 1;
        roundsInCascade = 1; // Resetear a 1 para la siguiente cascada
        totalRemovedThisCascade = 0;

        isProcessing = false;
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => cell.classList.remove('processing')); // Permitir interacciones
        applyScoreBlink(); // Aplicar parpadeo rápido al puntaje

        // Actualizar el conteo de celdas de muestra
        updateColorSamples();

        // Verificar si el jugador ha ganado
        if (chosenColor && document.querySelectorAll(`.cell.${chosenColor}`).length === 0) {
            alert('¡Felicidades! Has ganado eliminando todas las celdas del color/patrón elegido.');
        }
    }
}

function checkNewMatches() {
    const rows = board.length;
    const cols = board[0].length;
    const newMatches = new Set();

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (board[row][col]) {
                // Mantener la lógica existente para encontrar patrones
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
    const scoreElement = document.getElementById('current-score');
    scoreElement.textContent = score.toString().padStart(16, '0'); // Formatear el puntaje a 16 cifras
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
    updateScoreDisplay();
    createGrid(rows, cols);
    fillGrid();
    updateColorSamples(); // Actualizar la muestra de colores al inicio del juego
}

function incrementScoreAnimated(incrementBy, duration, steps) {
    const targetScore = score + incrementBy;
    const stepSize = Math.round(incrementBy / steps); // Truncar al entero más cercano
    let stepsCompleted = 0;
    const intervalId = setInterval(() => {
        if (stepsCompleted < steps - 1) {
            score += stepSize;
            updateScoreDisplay(); // Actualizar el puntaje visible
            stepsCompleted++;
        } else {
            score = targetScore; // Asegurar que el puntaje final sea exacto
            updateScoreDisplay();
            clearInterval(intervalId);
        }
    }, duration / steps);
}

function applyScoreBlink() {
    const scoreElement = document.getElementById('current-score');
    scoreElement.classList.add('blink-score');
    setTimeout(() => {
        scoreElement.classList.remove('blink-score');
    }, 2000); // Parpadeo durante 2 segundos
}

// Función para manejar la elección de color/patrón
function chooseColor() {
    chosenColor = document.getElementById('color-choice').value;
    alert(`Has elegido eliminar todas las celdas de color/patrón: ${chosenColor}`);
    checkPatterns(); // Verificar patrones inmediatamente después de elegir el color
    updateColorSamples(); // Actualizar la muestra de colores
}

// Función para actualizar la muestra de colores
function updateColorSamples() {
    COLORS.forEach(color => {
        const count = document.querySelectorAll(`.cell.${color}`).length;
        const totalCells = rows * cols;
        const percent = ((count / totalCells) * 100).toFixed(2);
        const cellSample = document.querySelector(`.cell-sample.${color}`);
        cellSample.querySelector('span').textContent = count;
        cellSample.setAttribute('data-percentage', `${percent}%`);
    });
}

// Inicializar con una grilla de 6x6 por defecto
createGrid(rows, cols);
fillGrid();
updateColorSamples(); // Actualizar la muestra de colores al inicio del juego