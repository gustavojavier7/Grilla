const COLORS = ['gris-ondas', 'verde', 'cyan', 'puntos-blancos', 'rayado', 'magenta'];
let gameContainer = document.getElementById('game-container');
let board = [];
let clockIntervalId = null;
let cellReferences = [];
let firstSelected = null;
let isProcessing = false; // Indica si el efecto cascada o blinkedo está en proceso
let score = 0;
let cascadeMultiplier = 1;
let roundsInCascade = 1; // Inicializado en 1
let totalRemovedThisCascade = 0;
let rows = 6; // Valor por defecto
let cols = 6; // Valor por defecto
let cellCounts = {};
let totalCellsRemoved = 0;
COLORS.forEach(color => {
    cellCounts[color] = 0;
});

function updateClock() {
    // Solo actualizamos el tiempo, no manejamos la animación aquí
    const now = new Date();
    let hours = now.getHours().toString().padStart(2, '0');
    let minutes = now.getMinutes().toString().padStart(2, '0');
    let seconds = now.getSeconds().toString().padStart(2, '0');
    
    document.getElementById('horas').textContent = hours;
    document.getElementById('minutos').textContent = minutes;
    document.getElementById('segundos').textContent = seconds;
}

function updateSecondaryClock() {
    const now = new Date();
    let hours = now.getHours().toString().padStart(2, '0');
    let minutes = now.getMinutes().toString().padStart(2, '0');
    let seconds = now.getSeconds().toString().padStart(2, '0');

    document.getElementById('secondary-horas').textContent = hours;
    document.getElementById('secondary-minutos').textContent = minutes;
    document.getElementById('secondary-segundos').textContent = seconds;
}

// Iniciar la actualización del reloj secundario
setInterval(updateSecondaryClock, 1000);
updateSecondaryClock(); // Llamada inicial para mostrar la hora inmediatamente

// Función para manejar el parpadeo de los separadores del reloj secundario
function manageSecondarySeparators() {
    const separators = document.querySelectorAll('.secondary-separador');
    separators.forEach(separator => {
        separator.classList.add('active');
    });
}

// Llamada inicial para manejar el parpadeo de los separadores del reloj secundario
manageSecondarySeparators();
function manageClock() {
    const separators = document.querySelectorAll('.separador');
    
    if (isProcessing) {
        // Detener parpadeo
        separators.forEach(separator => {
            separator.classList.remove('active');
            separator.style.backgroundColor = 'black'; // Queda estático
        });

        // Detener la actualización del reloj
        if (clockIntervalId) {
            clearInterval(clockIntervalId);
            clockIntervalId = null;
        }
        // El reloj queda mostrando la última hora actualizada.

    } else {
        // Activar parpadeo
        separators.forEach(separator => {
            separator.classList.add('active');
        });

        // Iniciar la actualización del reloj solo si no existe ya un intervalo
        if (!clockIntervalId) {
            updateClock(); // Llamada inmediata para que aparezca la hora actual al instante
            clockIntervalId = setInterval(updateClock, 1000); // Actualización cada 1s
        }
    }
}

function checkSelections() {
    const difficulty = document.getElementById('difficulty').value;
    const fillGridBtn = document.getElementById('fill-grid-btn');
    const resetGameBtn = document.getElementById('reset-game-btn');

    if (difficulty) {
        fillGridBtn.disabled = false;
        resetGameBtn.disabled = false;
    } else {
        fillGridBtn.disabled = true;
        resetGameBtn.disabled = true;
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
    if (isProcessing) return;
    resetScore();
    totalCellsRemoved = 0;  // Resetear el contador
    updateCellsRemovedDisplay();  // Actualizar la vista

    // Retrieve the selected difficulty level
    const difficulty = document.getElementById('difficulty').value;
    if (difficulty) {
        rows = cols = parseInt(difficulty, 10);
    }

    // Create the grid based on the difficulty level
    createGrid(rows, cols);

    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        const row = cell.dataset.row;
        const col = cell.dataset.col;
        board[row][col] = randomColor;
        cell.className = `cell ${randomColor}`;
        cellCounts[randomColor]++; // Incrementar el contador del color
    });
    checkPatterns();
}

function handleCellClick(cell) {
    if (isProcessing) return; // Ignorar clics mientras el efecto cascada o blinkedo está activo

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
    manageClock(); // Llamada para pausar el reloj
    const cells = document.querySelectorAll('.cell');

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
    }
}

function removePulsatingCells(matches) {
    const rows = board.length;
    const cols = board[0].length;

    // Primero, quitar la clase 'matched' para reiniciar la animación
    matches.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        const cell = cellReferences[row][col];
        cell.classList.remove('matched'); // Quitar la clase para reiniciar la animación
    });

    // Luego, aplicar la animación de blinkedo nuevamente
    matches.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        const cell = cellReferences[row][col];
        cell.classList.add('matched'); // Añadir la clase para iniciar el blinkedo
    });

            // Iniciar el destello sincronizado durante 1 segundo
        setTimeout(() => {
            // Vaciar las celdas marcadas
            matches.forEach(coord => {
                const [row, col] = coord.split(',').map(Number);
                const color = board[row][col];
                board[row][col] = null; // Vaciar la celda
                cellReferences[row][col].className = 'cell'; // Limpiar la clase de la celda
                cellCounts[color]--; // Decrementar el contador del color
                totalCellsRemoved++; // Incrementar el contador de celdas eliminadas
            });
            updateCellsRemovedDisplay(); // Actualizar el contador visible

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
                        cellReferences[newRow][col].className = `cell ${board[newRow][col]}`;

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
                    cellCounts[newColor]++; // Incrementar el contador del nuevo color
                }
            }

            // Verificar si hay nuevas coincidencias después de la caída
            newMatches = checkNewMatches();
            if (newMatches.size > 0) {
                // Aquí, aplicar el mismo procedimiento para nuevas coincidencias
                newMatches.forEach(coord => {
                    const [row, col] = coord.split(',').map(Number);
                    const cell = cellReferences[row][col];
                    cell.classList.remove('matched'); // Quitar la clase para reiniciar la animación
                    cell.classList.add('matched'); // Añadir la clase para iniciar el blinkedo
                });

                // Incrementar exponencialmente roundsInCascade
                const n = Math.log2(roundsInCascade) + 1;
                roundsInCascade = Math.pow(2, n);
                totalRemovedThisCascade += newMatches.size;

                // Incremento de puntaje con animación
                const scoreIncrement = totalRemovedThisCascade * roundsInCascade;
                incrementScoreAnimated(scoreIncrement, 2000, 20);

                setTimeout(() => {
                    removePulsatingCells(newMatches);
                }, 1000); // 1 segundo de espera antes de la siguiente ronda de cascada
            } else {
                isProcessing = false; // Habilitar interacciones
                manageClock(); // Reanudar el reloj y actualizar los separadores
                let finalPoints = totalRemovedThisCascade * roundsInCascade;
                score += finalPoints;
                updateScoreDisplay();

                // Resetear contadores
                cascadeMultiplier = 1;
                roundsInCascade = 1;
                totalRemovedThisCascade = 0;

                                isProcessing = false; // Habilitar interacciones
                manageClock(); // Llamada para reanudar el reloj
                const cells = document.querySelectorAll('.cell');
                cells.forEach(cell => cell.classList.remove('processing'));

                // Aplicar blinkedo si el puntaje cambió
                applyScoreBlink();
            }
        }, 1000); // 1 segundo de blinkedo antes de eliminar las celdas
        updateColorSamples();
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
    // Convertimos el puntaje a una cadena y lo rellenamos con ceros a la izquierda hasta 16 dígitos
    let scoreString = score.toString().padStart(16, '0');
    
    // Dividimos la cadena en grupos de 4 y los unimos con guiones
    let formattedScore = scoreString.match(/.{1,4}/g).join('-');
    
    const scoreElement = document.getElementById('current-score');
    scoreElement.textContent = formattedScore; // Actualizamos el contenido del elemento con el puntaje formateado
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
    totalCellsRemoved = 0;  // Resetear el contador
    updateCellsRemovedDisplay();
    
    // Reiniciar los contadores de celdas
    cellCounts = {};
    COLORS.forEach(color => {
        cellCounts[color] = 0;
    });

    updateScoreDisplay();
    createGrid(rows, cols);
    fillGrid();
    updateColorSamples();

    // Ocultar el overlay de GAME OVER
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
window.resetGame = resetGame;
console.log('resetGame definida:', window.resetGame !== undefined);

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
    if (!isProcessing) {
        const scoreElement = document.getElementById('current-score');
        scoreElement.classList.add('blink-score');
        setTimeout(() => {
            scoreElement.classList.remove('blink-score');
        }, 2000); // Duración del blinkedo
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
            console.log('Color que alcanzó el umbral:', color);
            console.log('Umbral alcanzado:', threshold);
            showGameOver(color, threshold);
        } else {
            cellSample.classList.remove('blink-threshold');
        }
    });
}
function getGameOverThreshold(rows, cols) {
    const baseThreshold = 50;
    const baseGridSize = 15 * 15;

    // No se establece condición para 6x6 y 10x10
    if ((rows === 6 && cols === 6) || (rows === 10 && cols === 10)) {
        return null; // Retornamos null para indicar que no hay condición de fin de juego
    }

    const currentGridSize = rows * cols;
    return Math.floor((baseThreshold / baseGridSize) * currentGridSize);
}

function showGameOver(color, threshold) {
    // Mostrar el overlay de GAME OVER
    const overlay = document.getElementById('game-over-overlay');
    const colorElement = document.getElementById('game-over-color');
    const thresholdElement = document.getElementById('game-over-threshold');

    colorElement.textContent = color;
    thresholdElement.textContent = threshold;
    overlay.style.display = 'flex'; // Se muestra el overlay;
    
    // Pausar el juego o hacer que no sea interactivo
    isProcessing = true;
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.classList.add('processing'));
}

function updateCellsRemovedDisplay() {
    const cellsRemovedElement = document.getElementById('cells-removed');
    cellsRemovedElement.textContent = totalCellsRemoved;

    // Aplicar el efecto de blinkedo
    cellsRemovedElement.classList.add('blink-cells-removed');
    setTimeout(() => {
        cellsRemovedElement.classList.remove('blink-cells-removed');
    }, 1000); // Duración del blinkedo (1 segundo)
}

// Inicializar con una grilla de 6x6 por defecto
createGrid(rows, cols);
updateColorSamples(); // Actualizar la muestra de colores al inicio del juego
// Iniciar el reloj
manageClock(); // Se usa manageClock para iniciar el reloj en lugar de setInterval directamente
