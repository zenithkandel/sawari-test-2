// ============================================================
// Sawari Admin - Undo/Redo History
// ============================================================
const History = (() => {
    const stack = [];
    let pointer = -1;
    const MAX = 50;

    function push(action) {
        // Discard redo history
        stack.splice(pointer + 1);
        stack.push(action);
        if (stack.length > MAX) stack.shift();
        pointer = stack.length - 1;
        emit();
    }

    function undo() {
        if (pointer < 0) return;
        const action = stack[pointer];
        pointer--;
        if (action.undo) action.undo();
        emit();
        return action;
    }

    function redo() {
        if (pointer >= stack.length - 1) return;
        pointer++;
        const action = stack[pointer];
        if (action.redo) action.redo();
        emit();
        return action;
    }

    function canUndo() { return pointer >= 0; }
    function canRedo() { return pointer < stack.length - 1; }

    function emit() {
        Store.emit('history', { canUndo: canUndo(), canRedo: canRedo() });
    }

    return { push, undo, redo, canUndo, canRedo };
})();
