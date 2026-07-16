// Sincronización de animaciones mediante eventos reales del navegador.
// Este archivo se carga después de script.js y reemplaza solamente
// las funciones relacionadas con la secuencia visual de las cascadas.

function waitForCssAnimation(element) {
    if (!element) return Promise.resolve();

    const animations = element.getAnimations().filter(animation => {
        const effect = animation.effect;
        return effect && effect.target === element;
    });

    if (animations.length === 0) {
        return Promise.resolve();
    }

    return Promise.all(
        animations.map(animation => animation.finished.catch(() => undefined))
    );
}

function addFallAnimation(cell, delay = 0, initialOffset = 0, isNewCell = false) {
    return new Promise(resolve => {
        let finished = false;

        const cleanup = () => {
            if (finished) return;
            finished = true;

            cell.style.transition = '';
            cell.style.transform = '';
            cell.style.opacity = '';
            cell.classList.remove('falling');
            cell.removeEventListener('transitionend', transitionEndHandler);
            clearTimeout(fallbackTimer);
            resolve();
        };

        const transitionEndHandler = event => {
            if (event.target !== cell || event.propertyName !== 'transform') return;
            cleanup();
        };

        cell.classList.add('falling');
        cell.style.transition = 'none';
        cell.style.transform = `translateY(${initialOffset}px)`;

        if (isNewCell) {
            cell.style.opacity = '0';
        }

        void cell.offsetWidth;

        cell.addEventListener('transitionend', transitionEndHandler);
        cell.style.transition = `transform ${FALL_DURATION}s cubic-bezier(0.42, 0, 1.0, 1.0) ${delay}s, opacity ${FALL_DURATION}s linear ${delay}s`;
        cell.style.transform = 'translateY(0)';

        if (isNewCell) {
            cell.style.opacity = '1';
        }

        // Respaldo para navegadores que omitan transitionend por cancelación,
        // cambio de pestaña o reducción de movimiento.
        const fallbackTimer = setTimeout(
            cleanup,
            (delay + FALL_DURATION) * 1000 + 150
        );
    });
}

async function handleCascade(matches) {
    if (!(matches instanceof Set)) {
        throw new Error('handleCascade requiere un Set de coincidencias.');
    }

    if (matches.size === 0) {
        setProcessingState(false);
        return;
    }

    setProcessingState(true);

    const matchedCells = [];

    matches.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        const cell = cellReferences[row][col];

        if (cell) {
            cell.classList.add('matched');
            matchedCells.push(cell);
        }
    });

    // La cascada continúa cuando termina realmente el parpadeo CSS,
    // no después de una cantidad fija de milisegundos.
    await Promise.all(matchedCells.map(waitForCssAnimation));
    await processMatchedCells(matches);
}

async function processMatchedCells(matches) {
    const boardRows = board.length;
    const boardCols = board[0].length;

    matches.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        const cell = cellReferences[row][col];
        cell.classList.remove('matched');

        const color = board[row][col];
        board[row][col] = null;
        cell.className = 'cell processing';
        cellCounts[color]--;
        totalCellsRemoved++;
        contadorDeCeldasEnRonda++;
    });

    updateCellsRemovedDisplay();

    const { size: cellSize, gap: cellGap } = getCellDimensions();
    const cellTotalSpace = cellSize + cellGap;
    const fallPromises = [];

    for (let col = 0; col < boardCols; col++) {
        let emptySpaceCount = 0;
        let delayIndex = 0;

        for (let row = boardRows - 1; row >= 0; row--) {
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

                oldCellElement.className = 'cell processing';
                targetCellElement.className = `cell ${fallingColor} processing`;

                const distanceToMoveUp = emptySpaceCount * cellTotalSpace;
                fallPromises.push(
                    addFallAnimation(
                        targetCellElement,
                        delayIndex * FALL_STAGGER_DELAY,
                        -distanceToMoveUp,
                        false
                    )
                );
                delayIndex++;
            }
        }

        for (let i = 0; i < emptySpaceCount; i++) {
            const targetRow = (emptySpaceCount - 1) - i;
            const newColor = getNewWeightedColorOptimized(targetRow, col);

            board[targetRow][col] = newColor;
            cellReferences[targetRow][col].className = `cell ${newColor} processing`;

            const distanceToFall = (emptySpaceCount - i) * cellTotalSpace;
            fallPromises.push(
                addFallAnimation(
                    cellReferences[targetRow][col],
                    delayIndex * FALL_STAGGER_DELAY,
                    -distanceToFall,
                    true
                )
            );

            cellCounts[newColor]++;
            delayIndex++;
        }
    }

    // Espera a que la última transición real haya finalizado.
    await Promise.all(fallPromises);

    const newMatches = checkNewMatches();

    if (newMatches.size > 0) {
        await handleCascade(newMatches);
    } else {
        setProcessingState(false);
        manageClock();

        cellsRemovedHistory.push(contadorDeCeldasEnRonda);
        if (cellsRemovedHistory.length > 5) {
            cellsRemovedHistory.shift();
        }

        if (cellsRemovedHistory.length > 1) {
            const averageCellsRemoved = cellsRemovedHistory.reduce((sum, value) => sum + value, 0) / cellsRemovedHistory.length;
            document.getElementById('current-average').textContent = Number(averageCellsRemoved.toFixed(4));
            console.log(`Promedio de celdas removidas: ${averageCellsRemoved.toFixed(2)}`);

            if (contadorDeCeldasEnRonda > averageCellsRemoved) {
                const extraTime = Math.ceil(contadorDeCeldasEnRonda);
                countdown += extraTime;
                console.log(`Tiempo extendido por ${extraTime} segundos. Nuevo tiempo: ${countdown} segundos.`);
            }
        } else if (cellsRemovedHistory.length === 1) {
            document.getElementById('current-average').textContent = Number(cellsRemovedHistory[0].toFixed(4));
        }

        contadorDeCeldasEnRonda = 0;
    }

    updateColorSamples();
    checkForCalavera();
}
