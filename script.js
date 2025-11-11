// Versión 4.8 - Algoritmo de generación mejorado (implementación parcial)
const COLORS = ['jelly-rojo', 'gota-naranja', 'limon-amarillo', 'gota-verde', 'gota-azul', 'calavera'];
const CONFIG = {
    FILAS: 10,
    COLUMNAS: 10,
    VALORES_PERMITIDOS: COLORS,
    VALOR_PELIGROSO: 'calavera',
    VALORES_SEGUROS_FILA_0: COLORS.filter(color => color !== 'calavera'),
    PROTECCION_ANTI_LOOP: 15
};

const DIFICULTADES = {
    FACIL: { FILAS: 10, COLUMNAS: 10 },
    MEDIO: { FILAS: 15, COLUMNAS: 15 },
    DIFICIL: { FILAS: 20, COLUMNAS: 20 }
};

const DIFICULTAD_LABELS = {
    FACIL: 'Fácil',
    MEDIO: 'Medio',
    DIFICIL: 'Difícil'
};
const FALL_DURATION = 0.2; // duration in seconds for a single fall animation
const FALL_STAGGER_DELAY = 0; // delay between consecutive cell falls in a column
let gameContainer = document.getElementById('game-container');
// El tablero utiliza la convención estándar de matrices: fila 0 es la parte superior
// y la fila (FILAS - 1) es la base visible para el jugador.
let board = [];
let cellReferences = [];
let firstSelected = null;
let isProcessing = false;
let contadorDeCeldasEnRonda = 0;
let rows = 10;
let cols = 10;
let activeConfig = { ...CONFIG };
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
let allowCalaveraGameOver = false; // Controla si la calavera en la última fila provoca GAME OVER
let skullRiskHistory = [];
const updateInterval = 1000; // 1s
const SEPARATOR_COLORS = {
    ON: 'black',    // Visible: texto negro
    OFF: 'transparent'  // Invisible: texto transparente
};


COLORS.forEach(color => {
    cellCounts[color] = 0;
});

// ===== NUEVAS FUNCIONES DE GENERACIÓN MEJORADA =====
function obtenerConfig(dificultad = 'MEDIO') {
    const override = DIFICULTADES[dificultad] || {};
    const filas = override.FILAS ?? CONFIG.FILAS;
    const columnas = override.COLUMNAS ?? CONFIG.COLUMNAS;

    return {
        ...CONFIG,
        ...override,
        FILAS: filas,
        COLUMNAS: columnas
    };
}

function generarValorSeguro(config) {
    const seguros = config.VALORES_SEGUROS_FILA_0;
    return seguros[Math.floor(Math.random() * seguros.length)];
}

function generarValorAleatorio(rango) {
    return rango[Math.floor(Math.random() * rango.length)];
}

function generarLlenadoParametrizado(config) {
    const grilla = [];
    const bottomRowIndex = config.FILAS - 1;

    grilla[bottomRowIndex] = [];
    for (let col = 0; col < config.COLUMNAS; col++) {
        grilla[bottomRowIndex][col] = generarValorSeguro(config);
    }

    for (let fila = 0; fila < bottomRowIndex; fila++) {
        grilla[fila] = [];
        for (let col = 0; col < config.COLUMNAS; col++) {
            grilla[fila][col] = generarValorAleatorio(config.VALORES_PERMITIDOS);
        }
    }

    return grilla;
}

function findMatches(grid, options = {}) {
    if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0])) {
        return new Set();
    }

    const rows = grid.length;
    const cols = grid[0].length;
    const matches = new Set();
    const skipValues = new Set(options.skipValues || []);

    // NO añadir automáticamente el valor peligroso a skipValues
    // Permitir que se detecten patrones de calaveras si se solicita explícitamente

    const shouldSkip = value => value == null || skipValues.has(value);
    const directions = [
        { dr: 0, dc: 1 },   // Horizontal →
        { dr: 1, dc: 0 },   // Vertical ↓
        { dr: 1, dc: 1 },   // Diagonal descendente derecha ↘
        { dr: 1, dc: -1 },  // Diagonal descendente izquierda ↙
        { dr: -1, dc: 1 },  // Diagonal ascendente derecha ↗
        { dr: -1, dc: -1 }  // Diagonal ascendente izquierda ↖
    ];

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const color = grid[row][col];
            if (shouldSkip(color)) continue;

            for (const { dr, dc } of directions) {
                const prevRow = row - dr;
                const prevCol = col - dc;

                if (
                    prevRow >= 0 && prevRow < rows &&
                    prevCol >= 0 && prevCol < cols &&
                    grid[prevRow][prevCol] === color
                ) {
                    // Ya fue procesado en esta dirección
                    continue;
                }

                const sequence = [];
                let r = row;
                let c = col;

                while (
                    r >= 0 && r < rows &&
                    c >= 0 && c < cols &&
                    grid[r][c] === color
                ) {
                    sequence.push(`${r},${c}`);
                    r += dr;
                    c += dc;
                }

                if (sequence.length >= 3) {
                    sequence.forEach(cell => matches.add(cell));
                }
            }
        }
    }

    return matches;
}

function detectarPatrones(grilla, config) {
    return findMatches(grilla, { skipValues: [] });
}

function validarConfigBasica(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('Configuración inválida: se esperaba un objeto.');
    }

    const { FILAS, COLUMNAS, VALORES_PERMITIDOS, VALORES_SEGUROS_FILA_0 } = config;

    if (!Number.isInteger(FILAS) || FILAS <= 0) {
        throw new Error('Configuración inválida: FILAS debe ser un entero positivo.');
    }

    if (!Number.isInteger(COLUMNAS) || COLUMNAS <= 0) {
        throw new Error('Configuración inválida: COLUMNAS debe ser un entero positivo.');
    }

    if (!Array.isArray(VALORES_PERMITIDOS) || VALORES_PERMITIDOS.length === 0) {
        throw new Error('Configuración inválida: VALORES_PERMITIDOS debe contener al menos un valor.');
    }

    if (!Array.isArray(VALORES_SEGUROS_FILA_0) || VALORES_SEGUROS_FILA_0.length === 0) {
        throw new Error('Configuración inválida: VALORES_SEGUROS_FILA_0 debe contener al menos un valor.');
    }
}

function validarGrillaRectangular(grilla, config) {
    if (!Array.isArray(grilla) || grilla.length === 0) {
        throw new Error('Grilla inválida: se esperaba una matriz con contenido.');
    }

    if (config && Number.isInteger(config.FILAS) && grilla.length !== config.FILAS) {
        throw new Error(`Grilla inválida: se esperaban ${config.FILAS} filas y se recibieron ${grilla.length}.`);
    }

    const columnasEsperadas = config?.COLUMNAS ?? grilla[0].length;

    grilla.forEach((fila, indice) => {
        if (!Array.isArray(fila) || fila.length !== columnasEsperadas) {
            throw new Error(`Grilla inválida: la fila ${indice} no coincide con las columnas esperadas.`);
        }
    });
}

function transformarCalaverasEnPatrones(grilla, config) {
    validarConfigBasica(config);
    validarGrillaRectangular(grilla, config);

    const nuevaGrilla = grilla.map(fila => [...fila]);
    const matches = findMatches(nuevaGrilla, { skipValues: [] });

    if (matches.size === 0) {
        return nuevaGrilla;
    }

    const patrones = agruparPatronesConectados(matches, nuevaGrilla);

    patrones.forEach(patron => {
        if (esPatronDeCalaveras(patron, nuevaGrilla)) {
            transformarUnaCalavera(patron, nuevaGrilla, config);
        }
    });

    return nuevaGrilla;
}

function agruparPatronesConectados(matches, grilla) {
    const visitado = new Set();
    const patrones = [];

    matches.forEach(coord => {
        if (visitado.has(coord)) return;

        const [fila, col] = coord.split(',').map(Number);
        const color = grilla[fila][col];
        const patron = new Set();
        const stack = [[fila, col]];

        while (stack.length > 0) {
            const [r, c] = stack.pop();
            const key = `${r},${c}`;

            if (visitado.has(key)) continue;
            if (grilla[r][c] !== color) continue;

            visitado.add(key);
            patron.add(key);

            const direcciones = [[0, 1], [1, 0], [0, -1], [-1, 0]];
            direcciones.forEach(([dr, dc]) => {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < grilla.length && nc >= 0 && nc < grilla[0].length) {
                    const nkey = `${nr},${nc}`;
                    if (matches.has(nkey) && !visitado.has(nkey)) {
                        stack.push([nr, nc]);
                    }
                }
            });
        }

        if (patron.size >= 3) {
            patrones.push(patron);
        }
    });

    return patrones;
}

function esPatronDeCalaveras(patron, grilla) {
    const primeraCoord = Array.from(patron)[0];
    const [fila, col] = primeraCoord.split(',').map(Number);
    return grilla[fila][col] === 'calavera';
}

function transformarUnaCalavera(patron, grilla, config) {
    const calaverasEnPatron = Array.from(patron).filter(coord => {
        const [fila, col] = coord.split(',').map(Number);
        return grilla[fila][col] === 'calavera';
    });

    if (calaverasEnPatron.length === 0) return;

    const calaveraElegida = calaverasEnPatron[Math.floor(Math.random() * calaverasEnPatron.length)];
    const [fila, col] = calaveraElegida.split(',').map(Number);

    const coloresSeguros = config.VALORES_SEGUROS_FILA_0;
    const nuevoColor = coloresSeguros[Math.floor(Math.random() * coloresSeguros.length)];

    grilla[fila][col] = nuevoColor;
    console.log(`Transformada calavera en (${fila},${col}) a ${nuevoColor}`);
}

function eliminarMatches(grilla, matches) {
    const nuevaGrilla = grilla.map(fila => [...fila]);
    matches.forEach(match => {
        const [fila, col] = match.split(',').map(Number);
        if (nuevaGrilla[fila]) {
            nuevaGrilla[fila][col] = null;
        }
    });
    return nuevaGrilla;
}

function aplicarGravedadCompactacion(grilla, config) {
    const filas = grilla.length;
    const columnas = grilla[0].length;
    const nuevaGrilla = Array.from({ length: filas }, () => Array(columnas).fill(null));

    for (let col = 0; col < columnas; col++) {
        const existentes = [];
        for (let fila = filas - 1; fila >= 0; fila--) {
            const valor = grilla[fila][col];
            if (valor !== null && valor !== undefined) {
                existentes.push(valor);
            }
        }

        let filaObjetivo = filas - 1;
        for (const valorOriginal of existentes) {
            let valor = valorOriginal;
            if (filaObjetivo === filas - 1 && valor === config.VALOR_PELIGROSO) {
                valor = generarValorSeguro(config);
            }
            nuevaGrilla[filaObjetivo][col] = valor;
            filaObjetivo--;
        }

        while (filaObjetivo >= 0) {
            let nuevoValor = generarValorAleatorio(config.VALORES_PERMITIDOS);
            if (filaObjetivo === filas - 1 && nuevoValor === config.VALOR_PELIGROSO) {
                nuevoValor = generarValorSeguro(config);
            }
            nuevaGrilla[filaObjetivo][col] = nuevoValor;
            filaObjetivo--;
        }
    }

    return nuevaGrilla;
}

async function estabilizarTableroParametrizado(grilla, config) {
    validarConfigBasica(config);
    validarGrillaRectangular(grilla, config);

    while (true) {
        grilla = transformarCalaverasEnPatrones(grilla, config);
        validarGrillaRectangular(grilla, config);

        const matches = detectarPatrones(grilla, config);
        if (matches.size === 0) {
            return grilla;
        }

        grilla = eliminarMatches(grilla, matches);
        grilla = aplicarGravedadCompactacion(grilla, config);
        validarGrillaRectangular(grilla, config);
    }
}

function validarEstadoInicialParametrizado(grilla, config) {
    const bottomRow = grilla[config.FILAS - 1];
    const cerosEnBase = bottomRow.filter(valor => valor === config.VALOR_PELIGROSO).length;
    if (cerosEnBase > 0) {
        console.error(`ERROR: ${cerosEnBase} valores peligrosos en fila base`);
        return false;
    }
    return true;
}

function validarPuntoFijoParametrizado(grilla, config) {
    const matches = detectarPatrones(grilla, config);
    return matches.size === 0;
}

function inicializarContadores() {
    cellCounts = {};
    COLORS.forEach(color => {
        cellCounts[color] = 0;
    });
}

function recalcularContadoresDesdeBoard() {
    inicializarContadores();
    if (!Array.isArray(board) || board.length === 0) {
        return;
    }

    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            const color = board[row][col];
            if (color && cellCounts.hasOwnProperty(color)) {
                cellCounts[color]++;
            }
        }
    }
}

function actualizarVisualDesdeTablero() {
    if (!Array.isArray(cellReferences) || cellReferences.length === 0) {
        return;
    }

    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            const cell = cellReferences[row] && cellReferences[row][col];
            if (!cell) continue;

            const color = board[row][col];
            cell.className = color ? `cell ${color}` : 'cell';
        }
    }
}

async function generarTableroEstableUniversal(dificultad = 'MEDIO', intentos = 0) {
    const config = obtenerConfig(dificultad);
    validarConfigBasica(config);

    let grilla = generarLlenadoParametrizado(config);
    grilla = await estabilizarTableroParametrizado(grilla, config);

    if (!validarEstadoInicialParametrizado(grilla, config)) {
        if (intentos >= config.PROTECCION_ANTI_LOOP) {
            throw new Error('Violación de seguridad: valores peligrosos en base');
        }
        return generarTableroEstableUniversal(dificultad, intentos + 1);
    }

    if (!validarPuntoFijoParametrizado(grilla, config)) {
        console.warn('Punto fijo no alcanzado, regenerando...');
        if (intentos >= config.PROTECCION_ANTI_LOOP) {
            throw new Error('No se pudo generar un tablero estable tras múltiples intentos');
        }
        return generarTableroEstableUniversal(dificultad, intentos + 1);
    }

    inicializarContadores();

    return grilla;
}

function copyBoard(board) {
    return board.map(row => [...row]);
}

// NUEVA FUNCIÓN PARA OBTENER EL TAMAÑO REAL DE LA CELDA
function getCellDimensions() {
    // Intenta obtener las dimensiones de la primera celda creada (0, 0)
    if (cellReferences && cellReferences[0] && cellReferences[0][0]) {
        const rect = cellReferences[0][0].getBoundingClientRect();
        return {
            size: rect.width,
            gap: 2 // El gap (brecha) es un valor fijo en el CSS
        };
    }
    // Fallback si la celda no se ha renderizado
    return { size: 40, gap: 2 };
}

function checkSelections() {
    const difficulty = document.getElementById('difficulty').value;
    console.log("Dificultad seleccionada:", difficulty);
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



function handleCellClick(cell) {
    if (isProcessing) return;

    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const cellColor = board[row][col];

    if (cellColor === 'calavera') {
        showGameOver('Game Over. La Muerte te ha alcanzado.');
        return;
    }

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
    allowCalaveraGameOver = true; // A partir de aquí, la calavera en la última fila puede provocar GAME OVER
}

async function checkPatterns() {
    if (isProcessing) return;
    isProcessing = true;
    manageClock();
    const cells = document.querySelectorAll('.cell');
    const matches = findMatches(board, { skipValues: [] });

    if (matches.size > 0) {
        await handleCascade(matches);
    } else {
        isProcessing = false;
        cells.forEach(cell => cell.classList.remove('processing'));
    }
}

async function handleCascade(matches) {
    if (!(matches instanceof Set)) {
        throw new Error('handleCascade requiere un Set de coincidencias.');
    }

    if (matches.size === 0) {
        isProcessing = false;
        return;
    }

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

    const { size: cellSize, gap: cellGap } = getCellDimensions();
    const cellTotalSpace = cellSize + cellGap;

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

                const distanceToMoveUp = emptySpaceCount * cellTotalSpace;
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
            
            const distanceToFall = (emptySpaceCount - i) * cellTotalSpace;
            addFallAnimation(cellReferences[targetRow][col], delayIndex * FALL_STAGGER_DELAY, -distanceToFall, true);
            
            if (delayIndex * FALL_STAGGER_DELAY > maxDelay) maxDelay = delayIndex * FALL_STAGGER_DELAY;
            cellCounts[newColor]++;
            delayIndex++;
        }
    }

    await wait((maxDelay + FALL_DURATION) * 1000);

    const riesgo = calcularRRC_SimpleAbierto(board, activeConfig);
    actualizarIndicadorRiesgoSimpleAbierto(riesgo);

    newMatches = checkNewMatches();

    if (newMatches.size > 0) {
        await handleCascade(newMatches);
    } else {
        isProcessing = false;
        manageClock();

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

        contadorDeCeldasEnRonda = 0;
        isProcessing = false;
        manageClock();
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.remove('processing');
        });

        const riesgoFinal = calcularRRC_SimpleAbierto(board, activeConfig);
        skullRiskHistory.push(Math.round(riesgoFinal * 100));
        if (skullRiskHistory.length > 5) {
            skullRiskHistory.shift();
        }
    }
    updateColorSamples();
    checkForCalavera();
}

function checkNewMatches() {
    return findMatches(board, { skipValues: [] });
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

    // Restablece los contadores
    countdown = 60;
    countdownStarted = false;
    totalCellsRemoved = 0;
    cellsRemovedHistory = [];
    contadorDeCeldasEnRonda = 0;
    updateCellsRemovedDisplay();

    // Restablece los contadores de colores
    inicializarContadores();
    updateColorSamples();

    document.getElementById('current-average').textContent = '000.000';
    document.getElementById('skull-risk').textContent = '0% (Abierto)';

    // Recrea la cuadrícula y la llena con colores aleatorios
    createGrid(rows, cols);
    fillGrid(true);

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
        if (!cellSample) {
            console.warn(`No se encontró la muestra de color para: ${color}`);
            return;
        }

        const span = cellSample.querySelector('span');
        if (!span) {
            console.warn(`No se encontró el elemento <span> dentro de la muestra de color: ${color}`);
            return;
        }
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

function rellenarCeldasVacias() {
    let celdasRellenadas = 0;

    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
            if (board[row][col] === null) {
                const nuevoColor = getNewWeightedColorOptimized(row, col);
                board[row][col] = nuevoColor;
                const cell = cellReferences[row] && cellReferences[row][col];
                if (cell) {
                    cell.className = `cell ${nuevoColor}`;
                }
                cellCounts[nuevoColor] = (cellCounts[nuevoColor] || 0) + 1;
                celdasRellenadas++;
            } else {
                const cell = cellReferences[row] && cellReferences[row][col];
                if (cell) {
                    const colorActual = board[row][col];
                    cell.className = colorActual ? `cell ${colorActual}` : 'cell';
                }
            }
        }
    }

    return celdasRellenadas;
}

async function fillGrid(forceRegeneration = false) {
    if (isProcessing || !document.getElementById('difficulty').value) return;

    isProcessing = true;

    const dificultad = document.getElementById('difficulty').value || 'MEDIO';
    const config = obtenerConfig(dificultad);
    validarConfigBasica(config);
    rows = config.FILAS;
    cols = config.COLUMNAS;
    activeConfig = config;

    const boardTieneDimensiones =
        Array.isArray(board) &&
        board.length === rows &&
        rows > 0 &&
        Array.isArray(board[0]) &&
        board[0].length === cols;

    const hayCeldasVacias = boardTieneDimensiones && board.some(fila => fila.some(celda => celda === null));

    let seGeneroNuevoTablero = false;
    let celdasRellenadas = 0;

    if (forceRegeneration || !boardTieneDimensiones) {
        document.getElementById('skull-risk').textContent = '0% (Abierto)';
        board = await generarTableroEstableUniversal(dificultad);
        actualizarVisualDesdeTablero();
        seGeneroNuevoTablero = true;
        allowCalaveraGameOver = true;
        countdownStarted = true;
        lastUpdateTime = performance.now();
    } else if (hayCeldasVacias) {
        celdasRellenadas = rellenarCeldasVacias();
        if (celdasRellenadas > 0) {
            allowCalaveraGameOver = true;
        }
    } else {
        actualizarVisualDesdeTablero();
    }

    recalcularContadoresDesdeBoard();
    updateSkullRiskDisplay();
    updateColorSamples();

    if (seGeneroNuevoTablero) {
        console.log('Tablero estable generado exitosamente');
    } else if (celdasRellenadas === 0 && !hayCeldasVacias) {
        console.log('No hay celdas vacías para rellenar.');
    }

    isProcessing = false;
}

function getGameOverThreshold(rows, cols) {
    // La funcionalidad de umbral se ha desactivado por completo
    return null;
}

function checkForCalavera() {
    if (!allowCalaveraGameOver) return;
    const bottomRow = board[board.length - 1];
    if (bottomRow.some(color => color === 'calavera')) {
        showGameOver('Game Over. La Muerte te ha alcanzado.');
    }
}

function showGameOver(reason) {
    const overlay = document.getElementById('game-over-overlay');
    const message = document.getElementById('game-over-message');
    const gameOverReason = document.getElementById('game-over-reason');
    const gameOverThreshold = document.getElementById('game-over-threshold');

    if (reason === 'Tiempo agotado') {
        gameOverReason.textContent = '¡Se acabó el tiempo!';
        gameOverThreshold.style.display = 'none';
    } else if (reason) {
        gameOverReason.textContent = reason;
        gameOverThreshold.style.display = 'none';
    }

    overlay.style.display = 'flex';
    isProcessing = true; // Asegúrate de que esto está en true para evitar nuevas interacciones
    document.querySelectorAll('.cell').forEach(cell => cell.classList.add('processing'));
}

function contarCalaverasPorColumna(tablero, config) {
    const calaverasPorCol = new Array(config.COLUMNAS).fill(0);
    const peligrosos = [];

    for (let r = 0; r < config.FILAS; r++) {
        for (let c = 0; c < config.COLUMNAS; c++) {
            if (tablero[r][c] === config.VALOR_PELIGROSO) {
                calaverasPorCol[c]++;
                peligrosos.push({ r, c });
            }
        }
    }

    const numColumnasConCalaveras = calaverasPorCol.filter(count => count > 0).length;
    return { calaverasPorCol, numColumnasConCalaveras, peligrosos };
}

function obtenerSwapsLegales(tablero, config) {
    const swaps = [];
    const valorPeligroso = config.VALOR_PELIGROSO;

    for (let r = 0; r < config.FILAS; r++) {
        for (let c = 0; c < config.COLUMNAS; c++) {
            if (tablero[r][c] === null || tablero[r][c] === valorPeligroso) continue;

            if (c < config.COLUMNAS - 1 && tablero[r][c + 1] !== valorPeligroso && tablero[r][c + 1] !== null) {
                swaps.push({ r1: r, c1: c, r2: r, c2: c + 1 });
            }
            if (r < config.FILAS - 1 && tablero[r + 1][c] !== valorPeligroso && tablero[r + 1][c] !== null) {
                swaps.push({ r1: r, c1: c, r2: r + 1, c2: c });
            }
        }
    }
    return swaps;
}

function updateSkullRiskDisplay() {
    const risk = calcularRRC_Nuevo(board, activeConfig);
    const riskElement = document.getElementById('skull-risk');
    const porcentaje = Math.round(risk);
    riskElement.textContent = `${porcentaje}% (Nuevo)`;

    // UI escalada: clases para umbrales
    riskElement.classList.remove('bajo', 'medio', 'alto', 'critico', 'explosivo');
    if (risk < 50) {
        riskElement.classList.add('bajo');
        riskElement.style.color = '#4CAF50'; // Verde
    } else if (risk < 100) {
        riskElement.classList.add('medio');
        riskElement.style.color = '#FF9800'; // Naranja
    } else if (risk < 200) {
        riskElement.classList.add('alto');
        riskElement.style.color = '#F44336'; // Rojo
    } else if (risk < 500) {
        riskElement.classList.add('critico');
        riskElement.style.color = '#9C27B0'; // Púrpura
        riskElement.classList.add('blink-risk');
    } else {
        riskElement.classList.add('explosivo');
        riskElement.style.color = '#FF0000'; // Rojo intenso
        riskElement.classList.add('blink-risk');
    }
}

// Componente 1: Asimetría (simplificada con skewness manual)
function calcularAsimetria(tablero, config) {
    const totalCeldas = config.FILAS * config.COLUMNAS;
    const conteos = {};
    COLORS.forEach(color => conteos[color] = 0);
    for (let r = 0; r < config.FILAS; r++) {
        for (let c = 0; c < config.COLUMNAS; c++) {
            const color = tablero[r][c];
            if (conteos[color] !== undefined) conteos[color]++;
        }
    }
    const frecuencias = Object.values(conteos).map(count => count / totalCeldas);
    const esperado = 1 / COLORS.length;
    const diffs = frecuencias.map(f => f - esperado);
    const media3 = diffs.reduce((sum, d) => sum + Math.pow(d, 3), 0) / frecuencias.length;
    const var2 = diffs.reduce((sum, d) => sum + Math.pow(d, 2), 0) / frecuencias.length;
    const skewness = media3 / Math.pow(var2, 1.5) || 0;
    return Math.abs(skewness) * 10; // Penalización escalada
}

// Componente 2: Cercanía vertical
function calcularCercania(tablero, config) {
    const calPorFila = new Array(config.FILAS).fill(0);
    for (let r = 0; r < config.FILAS; r++) {
        for (let c = 0; c < config.COLUMNAS; c++) {
            if (tablero[r][c] === config.VALOR_PELIGROSO) calPorFila[r]++;
        }
    }
    let raw = 0;
    let totalCal = 0;
    for (let f = 0; f < config.FILAS - 1; f++) { // Excluye base
        raw += calPorFila[f] * ((config.FILAS - 1) - f);
        totalCal += calPorFila[f];
    }
    const norm = totalCal > 0 ? raw / (totalCal * (config.FILAS - 1)) : 0;
    return norm * 100; // Escala a porcentaje-like
}

// Componente 3: Proximidad en línea recta
function calcularLineaRecta(tablero, config) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
    let total = 0;
    for (let r = 0; r < config.FILAS; r++) {
        for (let c = 0; c < config.COLUMNAS; c++) {
            if (tablero[r][c] !== config.VALOR_PELIGROSO) continue;
            for (let [dr, dc] of dirs) {
                let count = 0;
                for (let d = 1; d <= 3; d++) {
                    const nr = r + d * dr, nc = c + d * dc;
                    if (nr >= 0 && nr < config.FILAS && nc >= 0 && nc < config.COLUMNAS &&
                        tablero[nr][nc] === config.VALOR_PELIGROSO) count++;
                }
                total += count;
            }
        }
    }
    return total * 5; // Escala para amplificar agrupaciones
}

// Fórmula total abierta: suma de componentes
function calcularRRC_Nuevo(tablero, config) {
    const pa = calcularAsimetria(tablero, config);
    const pc = calcularCercania(tablero, config);
    const pl = calcularLineaRecta(tablero, config);
    const rrc = pa + pc + pl; // Abierta: sin límite
    console.log(`RRC Nuevo Abierto: ${Math.round(rrc)} | Asim: ${pa.toFixed(1)} | Cerc: ${pc.toFixed(1)} | Linea: ${pl}`);
    return rrc;
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
    const difficultyOptions = Object.entries(DIFICULTADES)
        .map(([key, value]) => {
            const label = DIFICULTAD_LABELS[key] || key;
            return `<option value="${key}">${label} (${value.FILAS}x${value.COLUMNAS})</option>`;
        })
        .join('');

    difficultySelect.innerHTML = '<option value="">--Seleccionar--</option>' + difficultyOptions;
    difficultySelect.addEventListener('change', () => {
        const difficulty = difficultySelect.value;
        console.log("Dificultad seleccionada:", difficulty);
        document.getElementById('reset-game-btn').disabled = !difficulty;

        if (difficulty) {
            const config = obtenerConfig(difficulty);
            rows = config.FILAS;
            cols = config.COLUMNAS;
            resetGame();
        }
    });

    resetGame();
    requestAnimationFrame(contadorRegresivo);
});
