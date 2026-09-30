import { executeCalDavRequest } from "./caldav.js";


/*
 * TB Planner Druckfunktion
 *
 * Druckt das aktuell sichtbare Fenster über Electron.
 * Elemente mit der Klasse "hidden" werden nicht gedruckt.
 */
async function printPlanner() {

    if (
        !window.electronAPI ||
        typeof window.electronAPI.printPreview !==
            "function"
    ) {

        setStatus(
            "Druck: Druckvorschau nicht verfügbar."
        );

        return;
    }

    try {

        setStatus(
            "Druckvorschau wird geöffnet ..."
        );

        const result =
            await window.electronAPI
                .printPreview(
                    currentTodos
                );

        if (result === true) {

            setStatus(
                "Druckvorschau geöffnet."
            );

        } else {

            setStatus(
                "Druckvorschau konnte nicht geöffnet werden."
            );

        }

    } catch (error) {

        console.error(
            "PRINT PREVIEW ERROR:",
            error
        );

        setStatus(
            `Druck: ERROR – ${error.message}`
        );

    }

}


/*
 * Druckbutton erzeugen.
 *
 * Er wird in den bestehenden Toolbar-Bereich eingefügt,
 * ohne die vorhandene Planner-/Task-Logik zu verändern.
 */
const printButton =
    document.createElement("button");

printButton.type = "button";
printButton.id = "printButton";
printButton.textContent = "Drucken";

printButton.addEventListener(
    "click",
    printPlanner
);

const plannerToolbar =
    document.querySelector(".planner-toolbar");

if (!plannerToolbar) {

    console.error(
        "FEHLER: .planner-toolbar nicht gefunden."
    );

} else {

    /*
     * Eigenen Bereich für Datei-/Druckfunktionen erzeugen.
     */
    const printSection =
        document.createElement("div");

    printSection.className =
        "toolbar-section print-section";

    const printTitle =
        document.createElement("div");

    printTitle.className =
        "toolbar-section-title";

    printTitle.textContent =
        "Ausgabe";

    const printGroup =
        document.createElement("div");

    printGroup.className =
        "toolbar-group";

    printGroup.appendChild(printButton);

    printSection.appendChild(printTitle);
    printSection.appendChild(printGroup);

    plannerToolbar.appendChild(printSection);

}


const statusElement =
    document.getElementById("status");

const headersElement =
    document.getElementById("headers");

const responseElement =
    document.getElementById("response");

const todosElement =
    document.getElementById("plannerRows");

const debugElement =
    document.getElementById("debug");

let currentTodos = [];

/*
 * =========================================================
 * JSON Export
 * =========================================================
 */

async function exportPlannerTasks() {

    if (
        !window.electronAPI ||
        typeof window.electronAPI.exportTasks !==
            "function"
    ) {

        setStatus(
            "Export: Electron-Funktion nicht verfügbar."
        );

        return;
    }

    try {

        const result =
            await window.electronAPI.exportTasks(
                currentTodos
            );

        if (result?.success) {

            setStatus(
                `Export: ${result.filePath}`
            );

        } else if (result?.canceled) {

            setStatus(
                "Export abgebrochen."
            );

        } else {

            setStatus(
                `Export: ERROR – ${
                    result?.failureReason ||
                    "unbekannter Fehler"
                }`
            );

        }

    } catch (error) {

        console.error(
            "EXPORT ERROR:",
            error
        );

        setStatus(
            `Export: ERROR – ${error.message}`
        );

    }

}


/*
 * =========================================================
 * JSON Import
 * =========================================================
 */

async function importPlannerTasks() {

    if (
        !window.electronAPI ||
        typeof window.electronAPI.importTasks !==
            "function"
    ) {

        setStatus(
            "Import: Electron-Funktion nicht verfügbar."
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * 1. JSON-Datei auswählen und validieren
     * --------------------------------------------------------
     */

    const importResult =
        await window.electronAPI.importTasks();


    if (importResult?.canceled) {

        setStatus(
            "Import abgebrochen."
        );

        return;
    }


    if (!importResult?.success) {

        setStatus(
            `Import: ERROR – ${
                importResult?.failureReason ||
                "Datei konnte nicht gelesen werden."
            }`
        );

        return;
    }


    const imported =
        importResult.data.tasks;


    if (!Array.isArray(imported)) {

        setStatus(
            "Import: Keine Taskliste gefunden."
        );

        return;
    }


    /*
     * JSON-Inhalt prüfen.
     */

    for (const task of imported) {

        if (!task || typeof task !== "object") {

            setStatus(
                "Import: Ungültiger Task in der JSON-Datei."
            );

            return;
        }

        if (!task.uid) {

            setStatus(
                "Import: Task ohne UID gefunden."
            );

            return;
        }

        if (!task.summary) {

            setStatus(
                `Import: Task ${task.uid} hat keinen Titel.`
            );

            return;
        }

    }


    /*
     * --------------------------------------------------------
     * 2. Sicherheitsabfrage
     * --------------------------------------------------------
     */

    const confirmed =
        window.confirm(
            `Import von ${imported.length} Task(s).\n\n` +
            "Alle aktuell vorhandenen Tasks im Kalender " +
            "werden vorher gelöscht.\n\n" +
            "Fortfahren?"
        );


    if (!confirmed) {

        setStatus(
            "Import abgebrochen."
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * 3. Zugangsdaten / Kalender
     * --------------------------------------------------------
     */

    const calendarUrl =
        document
            .getElementById("serverUrl")
            .value
            .trim();

    const username =
        document
            .getElementById("username")
            .value;

    const password =
        document
            .getElementById("password")
            .value;


    if (!calendarUrl) {

        setStatus(
            "Import: Keine CalDAV-Kalender-URL."
        );

        return;
    }


    /*
     * --------------------------------------------------------
     * 4. Importreihenfolge bestimmen
     *
     * Parent immer vor Child.
     *
     * WBS ist dabei die primäre Hierarchieinformation.
     * Bei gleicher WBS-Tiefe entscheidet order.
     * --------------------------------------------------------
     */

    const importTasks =
        [...imported].sort(
            (a, b) => {

                const aw =
                    String(a.wbs || "")
                        .split(".")
                        .filter(Boolean)
                        .map(Number);

                const bw =
                    String(b.wbs || "")
                        .split(".")
                        .filter(Boolean)
                        .map(Number);

                const depth =
                    aw.length - bw.length;

                if (depth !== 0) {
                    return depth;
                }

                const max =
                    Math.max(
                        aw.length,
                        bw.length
                    );

                for (
                    let i = 0;
                    i < max;
                    i++
                ) {

                    const av =
                        aw[i] ?? 0;

                    const bv =
                        bw[i] ?? 0;

                    if (av !== bv) {
                        return av - bv;
                    }

                }

                return (
                    Number(a.order ?? 0) -
                    Number(b.order ?? 0)
                );

            }
        );


    /*
     * --------------------------------------------------------
     * 5. Bestehende Tasks löschen
     * --------------------------------------------------------
     */

    setStatus(
        `Import: lösche ${currentTodos.length} vorhandene Task(s) ...`
    );


    for (const todo of currentTodos) {

        if (!todo.href) {

            setStatus(
                `Import: Task "${todo.summary || todo.uid}" ` +
                "hat keine Ressourcen-URL."
            );

            return;
        }


        try {

            const result =
                await executeCalDavRequest({
                    operation: "DELETE",

                    url:
                        resolveResourceUrl(
                            calendarUrl,
                            todo.href
                        ),

                    username,
                    password
                });


            if (
                result.status < 200 ||
                result.status >= 300
            ) {

                setStatus(
                    `Import: DELETE Fehler bei ` +
                    `"${todo.summary || todo.uid}" – ` +
                    `HTTP ${result.status}`
                );

                return;
            }

        } catch (error) {

            setStatus(
                `Import: DELETE ERROR – ${error.message}`
            );

            return;
        }

    }


    /*
     * --------------------------------------------------------
     * 6. Tasks neu anlegen
     *
     * Parent-Tasks stehen wegen der Sortierung vor
     * ihren Kindern.
     * --------------------------------------------------------
     */

    const createdTodos = [];


    for (
        let index = 0;
        index < importTasks.length;
        index++
    ) {

        const source =
            importTasks[index];


        /*
         * UID aus dem Export unverändert übernehmen.
         */

        const todo = {

            ...source,

            uid:
                source.uid,

            /*
             * Server-spezifische Werte niemals aus dem
             * alten Export übernehmen.
             */
            href: "",

            etag: "",

            summary:
                source.summary || "",

            description:
                source.description || "",

            status:
                source.status ||
                "NEEDS-ACTION",

            percentComplete:
                Number.isFinite(
                    Number(
                        source.percentComplete
                    )
                )
                    ? Number(
                        source.percentComplete
                    )
                    : 0,

            wbs:
                source.wbs || "",

            parent:
                source.parent || "",

            order:
                Number.isFinite(
                    Number(source.order)
                )
                    ? Number(source.order)
                    : index

        };


        /*
         * Neue CalDAV-Ressource.
         *
         * UID bleibt erhalten, href wird neu aufgebaut.
         */

        const resourceUrl =
            `${calendarUrl.replace(/\/+$/, "")}/${todo.uid}.ics`;


        const body =
            buildVTodoIcs(
                todo,
                {
                    summary:
                        todo.summary,

                    description:
                        todo.description,

                    percentComplete:
                        todo.percentComplete
                }
            );


        setStatus(
            `Import: ${index + 1}/${importTasks.length} – ` +
            `"${todo.summary}" ...`
        );


        try {

            const result =
                await executeCalDavRequest({
                    operation: "PUT",

                    url:
                        resourceUrl,

                    username,
                    password,

                    body
                });


            if (
                result.status < 200 ||
                result.status >= 300
            ) {

                setStatus(
                    `Import: PUT Fehler bei ` +
                    `"${todo.summary}" – ` +
                    `HTTP ${result.status}`
                );

                return;
            }


            todo.href =
                resourceUrl;


            createdTodos.push(todo);

        } catch (error) {

            setStatus(
                `Import: PUT ERROR bei ` +
                `"${todo.summary}" – ` +
                error.message
            );

            return;
        }

    }


    /*
     * --------------------------------------------------------
     * 7. Serverzustand neu laden
     * --------------------------------------------------------
     */

    selectedTodo = null;
    creatingTodo = false;
    editingTodo = false;

    hideTodoEditor();
    updateSelectionButtons();


    await loadTodos();


    setStatus(
        `Import: ${createdTodos.length} Task(s) erfolgreich importiert.`
    );

}

/*
 * Datei-Buttons verdrahten.
 */

document
    .getElementById("exportButton")
    ?.addEventListener(
        "click",
        exportPlannerTasks
    );

document
    .getElementById("importButton")
    ?.addEventListener(
        "click",
        importPlannerTasks
    );



let selectedTodo = null;

let creatingTodo = false;

/*
 * true  = bestehender Task wird aktiv bearbeitet
 * false = Task nur ausgewählt / Readonly
 */
let editingTodo = false;

function debugLog(message, data) {
    let text = String(message);

    if (data !== undefined) {
        try {
            text += " " + JSON.stringify(data, null, 2);
        } catch {
            text += " " + String(data);
        }
    }

    console.log("[DEBUG]", text);

    if (debugElement) {
        debugElement.textContent += text + "\n";
    }
}


/*
 * Operation buttons
 */
document
    .querySelectorAll("[data-operation]")
    .forEach(button => {

        button.addEventListener("click", async () => {

            const operation =
                button.dataset.operation;

            /*
             * DELETE is handled separately below because it must
             * operate on the selected VTODO resource URL, not on
             * the calendar URL.
             */
            if (operation === "DELETE") {
                return;
            }

            const serverUrl =
                document
                    .getElementById("serverUrl")
                    .value
                    .trim();

            const username =
                document
                    .getElementById("username")
                    .value;

            const password =
                document
                    .getElementById("password")
                    .value;

            if (!serverUrl) {
                setStatus(
                    "Please enter a CalDAV URL."
                );
                return;
            }

            setStatus(`${operation} ...`);

            headersElement.textContent = "";
            responseElement.textContent = "";

            try {

                const result =
                    await executeCalDavRequest({
                        operation,
                        url: serverUrl,
                        username,
                        password
                    });

                debugLog("REPORT/REQUEST Ergebnis:", {
                    operation,
                    status: result.status,
                    statusText: result.statusText,
                    bodyLength: result.body ? result.body.length : 0,
                    hasTodos: Array.isArray(result.todos),
                    todoCount: Array.isArray(result.todos)
                        ? result.todos.length
                        : null
                });

                debugLog("REPORT/RESPONSE HEADERS:", result.headers);

                if (result.requestDebug) {
                    debugLog("REPORT/REQUEST Details:",
                        result.requestDebug
                    );
                }

                if (operation === "REPORT") {
                    debugLog("REPORT XML Anfang:",
                        result.body
                            ? result.body.substring(0, 500)
                            : ""
                    );

                    debugLog("REPORT todos:",
                        result.todos
                    );
                }

                setStatus(
                    `${operation}: HTTP ${result.status} ${result.statusText}`
                );

                debugLog(
                    "REPORT/REQUEST Ergebnis:",
                    {
                        operation: operation,
                        status: result.status,
                        statusText: result.statusText,
                        bodyLength:
                            result.body
                                ? result.body.length
                                : 0,
                        hasTodos:
                            Array.isArray(result.todos),
                        todoCount:
                            Array.isArray(result.todos)
                                ? result.todos.length
                                : null
                    }
                );

                headersElement.textContent =
                    result.headers;

                responseElement.textContent =
                    result.body;

                if (
                    operation === "REPORT" &&
                    result.todos
                ) {
                    currentTodos = result.todos;
                    displayTodos(currentTodos);
                }

            } catch (error) {

                setStatus(
                    `${operation}: ERROR`
                );

                responseElement.textContent =
                    `${error.name}: ${error.message}`;
            }
        });
    });


/*
 * Helper: append a text cell to a table row.
 */
function addCell(row, text) {
    const cell = document.createElement("td");
    cell.textContent = text ?? "";
    row.appendChild(cell);
}


/*
 * Format an iCalendar date/time value for display.
 *
 * Supports:
 *   YYYYMMDD
 *   YYYYMMDDTHHMMSS
 *   YYYYMMDDTHHMMSSZ
 */
function formatIcsDate(value) {

    if (!value) {
        return "";
    }

    let text = String(value).trim();

    /*
     * Remove iCalendar value parameters if present.
     * Example: VALUE=DATE:20260927
     */
    if (text.includes(":")) {
        text = text.split(":").pop();
    }

    const match =
        text.match(
            /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/
        );

    if (!match) {
        return text;
    }

    const [
        ,
        year,
        month,
        day,
        hour,
        minute,
        second
    ] = match;

    if (!hour) {
        return `${day}.${month}.${year}`;
    }

    return `${day}.${month}.${year} ${hour}:${minute}`;
}


/*
 * Parse an iCalendar date/time value.
 *
 * Supports:
 *   YYYYMMDD
 *   YYYYMMDDTHHMMSS
 *   YYYYMMDDTHHMMSSZ
 *
 * Returns a local JavaScript Date.
 */
function parseIcsDate(value) {

    if (!value) {
        return null;
    }

    let text =
        String(value).trim();

    /*
     * Remove iCalendar value parameters.
     * Example:
     *   VALUE=DATE:20260927
     */
    if (text.includes(":")) {
        text =
            text.split(":").pop();
    }

    const match =
        text.match(
            /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/
        );

    if (!match) {
        return null;
    }

    const year =
        Number(match[1]);

    const month =
        Number(match[2]) - 1;

    const day =
        Number(match[3]);

    const hour =
        match[4]
            ? Number(match[4])
            : 0;

    const minute =
        match[5]
            ? Number(match[5])
            : 0;

    const second =
        match[6]
            ? Number(match[6])
            : 0;

    const date =
        new Date(
            year,
            month,
            day,
            hour,
            minute,
            second
        );

    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;
}



/*
 * Display VTODOs
 */

let timelineZoom = "day";


/*
 * ISO calendar week.
 *
 * Returns the ISO week number (1..53).
 */
function getIsoWeek(date) {

    const d = new Date(date);

    d.setHours(0, 0, 0, 0);

    /*
     * ISO week: Thursday determines the week year.
     */
    d.setDate(
        d.getDate() +
        3 -
        ((d.getDay() + 6) % 7)
    );

    const week1 =
        new Date(
            d.getFullYear(),
            0,
            4
        );

    return (
        1 +
        Math.round(
            (
                d.getTime() -
                week1.getTime()
            ) /
            86400000 /
            7
        )
    );

}


/*
 * =========================================================
 * WBS / Planner-Struktur
 * =========================================================
 *
 * Diese Funktionen arbeiten auf den Original-VTODOs in
 * currentTodos. displayTodos() verwendet für die Anzeige
 * dagegen Kopien.
 */

function plannerWbsParts(value) {

    if (!value) {
        return [];
    }

    return String(value)
        .split(".")
        .map(part => {
            const n = Number(part);

            return Number.isFinite(n)
                ? n
                : Number.MAX_SAFE_INTEGER;
        });

}


function plannerWbsCompare(a, b) {

    const aa =
        plannerWbsParts(a.todo.wbs);

    const bb =
        plannerWbsParts(b.todo.wbs);

    const length =
        Math.max(
            aa.length,
            bb.length
        );

    for (let i = 0; i < length; i++) {

        const av =
            aa[i] ??
            Number.MAX_SAFE_INTEGER;

        const bv =
            bb[i] ??
            Number.MAX_SAFE_INTEGER;

        if (av !== bv) {
            return av - bv;
        }

    }

    const ao =
        Number.isFinite(a.todo.order)
            ? a.todo.order
            : Number.MAX_SAFE_INTEGER;

    const bo =
        Number.isFinite(b.todo.order)
            ? b.todo.order
            : Number.MAX_SAFE_INTEGER;

    return ao - bo;

}


function buildPlannerOperationTree() {

    const byUid =
        new Map();

    for (const todo of currentTodos) {

        byUid.set(
            todo.uid,
            {
                todo,
                parentNode: null,
                children: []
            }
        );

    }

    const roots = [];

    for (const node of byUid.values()) {

        const parentUid =
            node.todo.parent || "";

        if (
            parentUid &&
            byUid.has(parentUid)
        ) {

            const parent =
                byUid.get(parentUid);

            node.parentNode =
                parent;

            parent.children.push(
                node
            );

        } else {

            roots.push(node);

        }

    }

    const sortNodes = nodes => {

        nodes.sort(
            plannerWbsCompare
        );

        for (const node of nodes) {
            sortNodes(node.children);
        }

    };

    sortNodes(roots);

    return {
        roots,
        byUid
    };

}


function normalizePlannerWbs(nodes, prefix = "", parentUid = "") {

    nodes.forEach(
        (node, index) => {

            const number =
                index + 1;

            node.todo.parent =
                parentUid;

            node.todo.order =
                number;

            node.todo.wbs =
                prefix
                    ? `${prefix}.${number}`
                    : `${number}`;

            normalizePlannerWbs(
                node.children,
                node.todo.wbs,
                node.todo.uid
            );

        }
    );

}


function getNewTaskPlacement(referenceTodo) {

    /*
     * WBS is the authoritative structure.
     *
     * Examples:
     *
     *   selected 3       -> new task 4
     *   selected 3.1     -> new task 3.2
     *   selected 3.2     -> new task 3.3
     *   selected 2.4.1   -> new task 2.4.2
     *
     * We deliberately do not rely on parent/order here because
     * these fields may be missing or stale in a freshly loaded
     * CalDAV VTODO.
     */

    const referenceWbs =
        String(referenceTodo?.wbs || "").trim();

    /*
     * No usable WBS:
     * create a new root task after the highest existing root.
     */
    if (!referenceWbs) {

        let nextRoot =
            1;

        for (const todo of currentTodos) {

            const wbs =
                String(todo.wbs || "").trim();

            if (!wbs || wbs.includes(".")) {
                continue;
            }

            const n =
                Number(wbs);

            if (Number.isFinite(n)) {
                nextRoot =
                    Math.max(
                        nextRoot,
                        n + 1
                    );
            }

        }

        return {
            parent: "",
            order: nextRoot,
            wbs: String(nextRoot)
        };

    }

    /*
     * Parent WBS is everything before the last dot.
     *
     * 3.1     -> parent WBS 3
     * 2.4.1   -> parent WBS 2.4
     * 3       -> root task
     */
    const lastDot =
        referenceWbs.lastIndexOf(".");

    const parentWbs =
        lastDot >= 0
            ? referenceWbs.slice(
                0,
                lastDot
            )
            : "";

    /*
     * Find the actual parent VTODO from its WBS.
     */
    let parentUid = "";

    if (parentWbs) {

        const parent =
            currentTodos.find(
                todo =>
                    String(todo.wbs || "").trim() ===
                    parentWbs
            );

        if (parent) {
            parentUid =
                parent.uid || "";
        }

    }

    /*
     * For a selected child, siblings have exactly the same
     * WBS prefix.
     *
     * For a selected root task, siblings are all root tasks.
     */
    const siblings =
        currentTodos.filter(
            todo => {

                const wbs =
                    String(todo.wbs || "").trim();

                if (!wbs) {
                    return false;
                }

                if (parentWbs) {

                    return (
                        wbs.startsWith(
                            parentWbs + "."
                        ) &&
                        wbs.split(".").length ===
                        parentWbs.split(".").length + 1
                    );

                }

                return !wbs.includes(".");

            }
        );

    let nextNumber =
        1;

    for (const todo of siblings) {

        const wbs =
            String(todo.wbs || "").trim();

        const parts =
            wbs.split(".");

        const number =
            Number(parts[parts.length - 1]);

        if (Number.isFinite(number)) {

            nextNumber =
                Math.max(
                    nextNumber,
                    number + 1
                );

        }

    }

    const newWbs =
        parentWbs
            ? `${parentWbs}.${nextNumber}`
            : `${nextNumber}`;

    return {
        parent: parentUid,
        order: nextNumber,
        wbs: newWbs
    };

}


async function savePlannerStructure(before) {

    if (!before) {
        before =
            new Map(
                currentTodos.map(
                    todo => [
                        todo.uid,
                        {
                            wbs: todo.wbs || "",
                            parent: todo.parent || "",
                            order: Number.isFinite(todo.order)
                                ? todo.order
                                : undefined
                        }
                    ]
                )
            );
    }

    const changed =
        currentTodos.filter(
            todo => {

                const old =
                    before.get(todo.uid);

                if (!old) {
                    return true;
                }

                return (
                    old.wbs !==
                    (todo.wbs || "") ||
                    old.parent !==
                    (todo.parent || "") ||
                    old.order !==
                    (
                        Number.isFinite(todo.order)
                            ? todo.order
                            : undefined
                    )
                );

            }
        );

    if (changed.length === 0) {
        return true;
    }

    setStatus(
        `PUT WBS-Struktur (${changed.length} Task(s)) ...`
    );

    for (const todo of changed) {

        const ok =
            await putTodo(todo);

        if (!ok) {

            setStatus(
                `PUT WBS-Struktur: Fehler bei "${todo.summary || todo.uid}"`
            );

            await loadTodos();

            return false;
        }

    }

    return true;

}


async function moveSelectedTodoStructure(operation) {

    if (!selectedTodo) {
        return;
    }

    if (creatingTodo) {
        return;
    }

    const selectedUid =
        selectedTodo.uid;

    const tree =
        buildPlannerOperationTree();

    const node =
        tree.byUid.get(
            selectedUid
        );

    if (!node) {
        setStatus(
            "WBS: Task nicht gefunden."
        );
        return;
    }

    const siblings =
        node.parentNode
            ? node.parentNode.children
            : tree.roots;

    const index =
        siblings.indexOf(node);

    if (index < 0) {
        return;
    }

    /*
     * Zustand VOR der Strukturänderung sichern.
     * Dieser Snapshot wird später für die PUT-Erkennung
     * verwendet.
     */
    const before =
        new Map(
            currentTodos.map(
                todo => [
                    todo.uid,
                    {
                        wbs: todo.wbs || "",
                        parent: todo.parent || "",
                        order: Number.isFinite(todo.order)
                            ? todo.order
                            : undefined
                    }
                ]
            )
        );


    /*
     * --------------------------------------------------------
     * Einrücken
     * --------------------------------------------------------
     *
     * Der vorherige Geschwister-Task wird zum neuen Parent.
     */
    if (operation === "indent") {

        if (index === 0) {

            setStatus(
                "Einrücken: Kein vorheriger Geschwister-Task."
            );

            return;
        }

        const newParent =
            siblings[index - 1];

        siblings.splice(
            index,
            1
        );

        newParent.children.push(
            node
        );

        node.parentNode =
            newParent;

    }


    /*
     * --------------------------------------------------------
     * Ausrücken
     * --------------------------------------------------------
     */
    else if (operation === "outdent") {

        if (!node.parentNode) {

            setStatus(
                "Ausrücken: Task ist bereits auf oberster Ebene."
            );

            return;
        }

        const oldParent =
            node.parentNode;

        const grandParent =
            oldParent.parentNode;

        const oldIndex =
            oldParent.children.indexOf(
                node
            );

        if (oldIndex >= 0) {

            oldParent.children.splice(
                oldIndex,
                1
            );

        }

        const targetSiblings =
            grandParent
                ? grandParent.children
                : tree.roots;

        const parentIndex =
            targetSiblings.indexOf(
                oldParent
            );

        targetSiblings.splice(
            parentIndex + 1,
            0,
            node
        );

        node.parentNode =
            grandParent || null;

    }


    /*
     * --------------------------------------------------------
     * Nach oben
     * --------------------------------------------------------
     */
    else if (operation === "up") {

        if (index === 0) {

            setStatus(
                "Verschieben: Task ist bereits oben."
            );

            return;
        }

        siblings[index] =
            siblings[index - 1];

        siblings[index - 1] =
            node;

    }


    /*
     * --------------------------------------------------------
     * Nach unten
     * --------------------------------------------------------
     */
    else if (operation === "down") {

        if (
            index ===
            siblings.length - 1
        ) {

            setStatus(
                "Verschieben: Task ist bereits unten."
            );

            return;
        }

        siblings[index] =
            siblings[index + 1];

        siblings[index + 1] =
            node;

    }


    else {
        return;
    }


    /*
     * WBS, Parent und Order für den kompletten Baum
     * neu nummerieren.
     */
    normalizePlannerWbs(
        tree.roots
    );


    displayTodos(
        currentTodos
    );


    const ok =
        await savePlannerStructure(
            before
        );

    if (!ok) {
        return;
    }


    /*
     * REPORT holt die vom Server gespeicherten VTODOs
     * wieder ein.
     */
    await loadTodos();


    selectedTodo =
        currentTodos.find(
            todo =>
                todo.uid === selectedUid
        ) || null;

    updateTodoEditor();
    updateSelectionButtons();
    displayTodos(currentTodos);

    setStatus(
        `WBS: ${operation} erfolgreich.`
    );

}





function displayTodos(todos) {


    debugLog(
        "displayTodos() aufgerufen:",
        {
            isArray: Array.isArray(todos),
            count: Array.isArray(todos)
                ? todos.length
                : null
        }
    );

    if (!todosElement) {
        return;
    }

    todosElement.innerHTML = "";

    if (!Array.isArray(todos) || todos.length === 0) {

        todosElement.textContent =
            "Keine VTODOs gefunden.";

        selectedTodo = null;

        hideTodoEditor();
        updateSelectionButtons();

        return;
    }


    /*
     * Build WBS hierarchy.
     */
    const byUid = new Map();

    for (const todo of todos) {

        byUid.set(
            todo.uid,
            {
                ...todo,
                children: []
            }
        );

    }


    const roots = [];

    for (const todo of byUid.values()) {

        if (
            todo.parent &&
            byUid.has(todo.parent)
        ) {

            byUid
                .get(todo.parent)
                .children
                .push(todo);

        } else {

            roots.push(todo);

        }

    }


    /*
     * WBS sorting.
     */
    const wbsCompare = (a, b) => {

        const parseWbs = value => {

            if (!value) {
                return [];
            }

            return String(value)
                .split(".")
                .map(part => {

                    const n = Number(part);

                    return Number.isFinite(n)
                        ? n
                        : Number.MAX_SAFE_INTEGER;

                });

        };

        const aa = parseWbs(a.wbs);
        const bb = parseWbs(b.wbs);

        const length =
            Math.max(
                aa.length,
                bb.length
            );

        for (
            let i = 0;
            i < length;
            i++
        ) {

            const av =
                aa[i] ??
                Number.MAX_SAFE_INTEGER;

            const bv =
                bb[i] ??
                Number.MAX_SAFE_INTEGER;

            if (av !== bv) {
                return av - bv;
            }

        }

        return (
            (Number.isFinite(a.order)
                ? a.order
                : 999999) -
            (Number.isFinite(b.order)
                ? b.order
                : 999999)
        );

    };


    const sortTree = nodes => {

        nodes.sort(wbsCompare);

        for (const node of nodes) {
            sortTree(node.children);
        }

    };

    sortTree(roots);


    /*
     * =========================================================
     * Calculate summary-task dates.
     *
     * A task with children is a summary task.
     * Its displayed Gantt range is determined recursively
     * from the earliest start and latest due date of all
     * descendants.
     *
     * The original VTODO dates are NOT modified.
     * We only store calculated display dates on the tree nodes.
     * =========================================================
     */

    const calculateSummaryDates = node => {

        const ownStart =
            parseIcsDate(node.dtstart);

        const ownDue =
            parseIcsDate(node.due);

        /*
         * Leaf task:
         * use its own dates unchanged.
         */
        if (
            !node.children ||
            node.children.length === 0
        ) {

            node.displayStart =
                ownStart;

            node.displayDue =
                ownDue;

            return {
                start: ownStart,
                due: ownDue
            };

        }


        /*
         * Summary task:
         * collect the calculated ranges of all children.
         */
        const starts = [];
        const dues = [];

        for (const child of node.children) {

            const range =
                calculateSummaryDates(child);

            if (range.start) {
                starts.push(range.start);
            }

            if (range.due) {
                dues.push(range.due);
            }

        }


        /*
         * Use the earliest child start and latest child due.
         */
        let displayStart = null;
        let displayDue = null;

        if (starts.length) {

            displayStart =
                new Date(
                    Math.min(
                        ...starts.map(
                            date => date.getTime()
                        )
                    )
                );

        }

        if (dues.length) {

            displayDue =
                new Date(
                    Math.max(
                        ...dues.map(
                            date => date.getTime()
                        )
                    )
                );

        }


        /*
         * If the children have no usable date information,
         * fall back to the summary task's own dates.
         */
        if (!displayStart) {
            displayStart = ownStart;
        }

        if (!displayDue) {
            displayDue = ownDue;
        }


        node.displayStart =
            displayStart;

        node.displayDue =
            displayDue;


        return {
            start: displayStart,
            due: displayDue
        };

    };


    for (const root of roots) {
        calculateSummaryDates(root);
    }


    /*
     * Count.
     */
    const info =
        document.createElement("div");

    info.className =
        "todo-count";

    info.textContent =
        `${todos.length} Aufgaben`;

    todosElement.appendChild(info);


    /*
     * Determine the visible timeline.
     *
     * We use the earliest start and latest due date.
     * If dates are missing, use today.
     */
    const dates = [];

    for (const todo of todos) {

        const start =
            parseIcsDate(todo.dtstart);

        const due =
            parseIcsDate(todo.due);

        if (start) {
            dates.push(start);
        }

        if (due) {
            dates.push(due);
        }

    }


    let timelineStart;
    let timelineEnd;

    if (dates.length) {

        timelineStart =
            new Date(
                Math.min(
                    ...dates.map(d => d.getTime())
                )
            );

        timelineEnd =
            new Date(
                Math.max(
                    ...dates.map(d => d.getTime())
                )
            );

    } else {

        timelineStart =
            new Date();

        timelineEnd =
            new Date();

    }


    /*
     * Add one day of margin at both ends.
     */
    timelineStart.setHours(0, 0, 0, 0);
    timelineEnd.setHours(0, 0, 0, 0);

    timelineStart.setDate(
        timelineStart.getDate() - 1
    );

    timelineEnd.setDate(
        timelineEnd.getDate() + 1
    );


    /*
     * Build timeline units according to the selected zoom.
     *
     * Day:
     *     one column = one calendar day
     *
     * Week:
     *     one column = one calendar week
     *
     * Month:
     *     one column = one calendar month
     *
     * KW:
     *     one column = one calendar week
     *
     * The visual width remains exactly 48 px per column.
     */

    const timelineDays = [];

    if (timelineZoom === "month") {

        /*
         * Monthly timeline.
         *
         * One column represents one calendar month.
         * The timeline is aligned to the first day
         * of the month.
         */
        const firstMonth =
            new Date(timelineStart);

        firstMonth.setDate(1);
        firstMonth.setHours(
            0, 0, 0, 0
        );

        for (
            let d = new Date(firstMonth);
            d <= timelineEnd;
            d.setMonth(d.getMonth() + 1)
        ) {

            timelineDays.push(
                new Date(d)
            );

        }

    } else if (
        timelineZoom === "week" ||
        timelineZoom === "kw"
    ) {

        /*
         * Weekly timeline.
         *
         * For KW we explicitly align every column
         * to an ISO calendar week starting Monday.
         */
        const firstWeek =
            new Date(timelineStart);

        const dayOfWeek =
            firstWeek.getDay();

        const mondayOffset =
            dayOfWeek === 0
                ? -6
                : 1 - dayOfWeek;

        firstWeek.setDate(
            firstWeek.getDate() + mondayOffset
        );

        firstWeek.setHours(
            0, 0, 0, 0
        );

        for (
            let d = new Date(firstWeek);
            d <= timelineEnd;
            d.setDate(d.getDate() + 7)
        ) {

            timelineDays.push(
                new Date(d)
            );

        }

    } else {

        for (
            let d = new Date(timelineStart);
            d <= timelineEnd;
            d.setDate(d.getDate() + 1)
        ) {

            timelineDays.push(
                new Date(d)
            );

        }

    }


    /*
     * Update timeline header.
     */
    const timelineHeader =
        document.getElementById(
            "timelineHeader"
        );

    if (timelineHeader) {

        timelineHeader.innerHTML = "";


        const days =
            document.createElement("div");

        days.className =
            "timeline-days";

        for (const day of timelineDays) {

            const cell =
                document.createElement("div");

            cell.className =
                "timeline-day";

            if (timelineZoom === "month") {

                /*
                 * Month view.
                 * Each column represents one calendar month.
                 */
                const monthNames = [
                    "JAN", "FEB", "MAR", "APR",
                    "MAY", "JUN", "JUL", "AUG",
                    "SEP", "OCT", "NOV", "DEC"
                ];

                cell.textContent =
                    monthNames[day.getMonth()];

            } else if (timelineZoom === "kw") {

                /*
                 * Calendar week.
                 * Monday is the first day of the
                 * represented week.
                 */
                const tmp =
                    new Date(day);

                const dayNumber =
                    tmp.getDay() || 7;

                tmp.setDate(
                    tmp.getDate() + 4 - dayNumber
                );

                const yearStart =
                    new Date(
                        tmp.getFullYear(),
                        0,
                        1
                    );

                const weekNumber =
                    Math.ceil(
                        (
                            (
                                (
                                    tmp -
                                    yearStart
                                ) / 86400000
                            ) + 1
                        ) / 7
                    );

                cell.textContent =
                    `KW ${String(weekNumber).padStart(2, "0")}`;

            } else if (timelineZoom === "week") {

                /*
                 * Week view:
                 * one column represents one calendar week.
                 * The timeline is aligned to Monday, so the
                 * header shows the Monday of that week.
                 */
                cell.textContent =
                    day.toLocaleDateString(
                        "de-DE",
                        {
                            day: "2-digit",
                            month: "2-digit"
                        }
                    );

            } else {

                if (
                    day.getDay() === 0 ||
                    day.getDay() === 6
                ) {

                    cell.classList.add(
                        "weekend"
                    );

                }

                cell.textContent =
                    day.toLocaleDateString(
                        "de-DE",
                        {
                            day: "2-digit",
                            month: "2-digit"
                        }
                    );

            }

            days.appendChild(cell);

        }

        timelineHeader.appendChild(days);

    }


    /*
     * Timeline width is based on the number of
     * timeline units (days, weeks or months).
     */
    const timelineWidth =
        timelineDays.length;

    const timelinePixelWidth =
        timelineWidth * 48;

    document.documentElement.style.setProperty(
        "--timeline-width",
        `${timelinePixelWidth}px`
    );

    console.log(
        "[TB-PLANNER DEBUG] TIMELINE-WERTE",
        {
            start: timelineStart instanceof Date
                ? timelineStart.toISOString()
                : timelineStart,
            end: timelineEnd instanceof Date
                ? timelineEnd.toISOString()
                : timelineEnd,
            days: timelineDays.length,

            selected: selectedTodo
                ? {
                    uid: selectedTodo.uid,
                    summary: selectedTodo.summary,
                    dtstart: selectedTodo.dtstart,
                    due: selectedTodo.due
                }
                : null
        }
    );


    /*
     * Convert a date to a timeline position.
     */
    const datePosition = date => {

        if (!date) {
            return null;
        }

        const midnight =
            new Date(date);

        midnight.setHours(
            0,
            0,
            0,
            0
        );

        if (timelineZoom === "month") {

            /*
             * Convert the date to the first day
             * of its calendar month.
             */
            const monthOf =
                value => {

                    const result =
                        new Date(value);

                    result.setDate(1);

                    result.setHours(
                        0, 0, 0, 0
                    );

                    return result;
                };

            const dateMonth =
                monthOf(midnight);

            const timelineMonth =
                monthOf(timelineStart);

            return (
                (
                    dateMonth.getFullYear() -
                    timelineMonth.getFullYear()
                ) * 12 +
                (
                    dateMonth.getMonth() -
                    timelineMonth.getMonth()
                )
            );

        }

        if (
            timelineZoom === "week" ||
            timelineZoom === "kw"
        ) {

            /*
             * Convert both dates to their respective
             * Monday.
             *
             * This makes a Gantt bar occupy the complete
             * ISO calendar-week column in KW mode.
             */
            const mondayOf =
                value => {

                    const result =
                        new Date(value);

                    const day =
                        result.getDay();

                    result.setDate(
                        result.getDate() -
                        (
                            day === 0
                                ? 6
                                : day - 1
                        )
                    );

                    result.setHours(
                        0, 0, 0, 0
                    );

                    return result;
                };

            const dateMonday =
                mondayOf(midnight);

            const timelineMonday =
                mondayOf(timelineStart);

            return Math.round(
                (
                    dateMonday.getTime() -
                    timelineMonday.getTime()
                ) /
                (86400000 * 7)
            );

        }

        const diff =
            Math.round(
                (
                    midnight.getTime() -
                    timelineStart.getTime()
                ) /
                86400000
            );

        return diff;

    };


    /*
     * Create planner rows recursively.
     */
    const appendNode =
        (todo, level) => {

        const row =
            document.createElement("div");

        row.className =
            "planner-row";

        if (
            selectedTodo &&
            selectedTodo.uid === todo.uid
        ) {

            row.classList.add(
                "selected"
            );

        }


        /*
         * Select row.
         */
        row.addEventListener(
            "click",
            event => {

                /*
                 * Do not treat clicks on action buttons
                 * as row selection.
                 */
                if (
                    event.target.closest(
                        "button"
                    )
                ) {
                    return;
                }

                selectTodo(todo);

            }
        );


        /*
         * WBS column.
         */
        const wbs =
            document.createElement("div");

        wbs.className =
            "planner-wbs";

        wbs.textContent =
            todo.wbs || "";

        row.appendChild(wbs);


        /*
         * Task column.
         */
        const task =
            document.createElement("div");

        task.className =
            "planner-task";

        task.style.paddingLeft =
            `${8 + level * 20}px`;


        const title =
            document.createElement("div");

        title.className =
            "planner-task-title";

        title.textContent =
            todo.summary ||
            "(ohne Titel)";

        task.appendChild(title);


        const meta =
            document.createElement("div");

        meta.className =
            "planner-task-meta";

        const metaParts = [];

        if (todo.status) {
            metaParts.push(
                todo.status
            );
        }

        if (
            Number.isFinite(
                todo.percentComplete
            )
        ) {

            metaParts.push(
                `${todo.percentComplete} %`
            );

        }

        task.appendChild(meta);

        meta.textContent =
            metaParts.join(" · ");

        row.appendChild(task);


        /*
         * Timeline.
         */
        const timeline =
            document.createElement("div");

        timeline.className =
            "planner-timeline";

        /*
         * Background timeline grid.
         */
        for (const day of timelineDays) {

            const cell =
                document.createElement("div");

            cell.className =
                "timeline-grid-cell";

            if (
                timelineZoom !== "week" && timelineZoom !== "kw" &&
                (
                    day.getDay() === 0 ||
                    day.getDay() === 6
                )
            ) {

                cell.classList.add(
                    "weekend"
                );

            }

            timeline.appendChild(cell);

        }


        /*
         * Gantt bar.
         */
        console.log(
            "[TB-PLANNER DEBUG] GANTT-DATEN",
            {
                uid: todo.uid,
                summary: todo.summary,
                dtstart: todo.dtstart,
                due: todo.due,
                parsedStart: parseIcsDate(todo.dtstart),
                parsedDue: parseIcsDate(todo.due),
                displayStart: todo.displayStart,
                displayDue: todo.displayDue,
                timelineStart,
                timelineDays: timelineDays.length,
                timelineWidth
            }
        );

        /*
         * For summary tasks use the recursively calculated
         * range. Leaf tasks use their original VTODO dates.
         */
        const start =
            todo.displayStart ??
            parseIcsDate(todo.dtstart);

        const due =
            todo.displayDue ??
            parseIcsDate(todo.due);

        if (start || due) {

            const barStart =
                start || due;

            const barEnd =
                due || start;

            let first =
                datePosition(barStart);

            let last =
                datePosition(barEnd);

            if (first === null) {
                first = 0;
            }

            if (last === null) {
                last = first;
            }

            if (last < first) {
                [first, last] =
                    [last, first];
            }

            const widthDays =
                Math.max(
                    1,
                    last - first + 1
                );

            console.log(
                "[TB-PLANNER DEBUG] GANTT-POSITION",
                {
                    uid: todo.uid,
                    summary: todo.summary,
                    dtstart: todo.dtstart,
                    due: todo.due,
                    start: start,
                    dueDate: due,
                    timelineStart: timelineStart,
                    timelineDays: timelineDays.length,
                    first: first,
                    last: last,
                    widthDays: widthDays,
                    timelineWidth: timelineWidth
                }
            );


            const bar =
                document.createElement("div");

            bar.className =
                "planner-bar";

            bar.style.left =
                `${(first / timelineWidth) * 100}%`;

            bar.style.width =
                `${(widthDays / timelineWidth) * 100}%`;

            bar.textContent =
                todo.summary ||
                "";

            timeline.appendChild(bar);

        }


        row.appendChild(timeline);




        todosElement.appendChild(row);


        /*
         * Children.
         */
        for (const child of todo.children) {

            appendNode(
                child,
                level + 1
            );

        }

    };


    for (const root of roots) {

        appendNode(
            root,
            0
        );

    }


    updateTodoEditor();
    updateSelectionButtons();
}

function setStatus(text) {
    statusElement.textContent = text;
}


/*
 * =========================================================
 * CalDAV REPORT / Refresh
 * =========================================================
 */

async function loadTodos() {

    const calendarUrl =
        document
            .getElementById("serverUrl")
            .value
            .trim();

    const username =
        document
            .getElementById("username")
            .value;

    const password =
        document
            .getElementById("password")
            .value;

    if (!calendarUrl) {
        setStatus("REPORT: No CalDAV calendar URL.");
        return;
    }

    setStatus("REPORT ...");

    try {

        const result =
            await executeCalDavRequest({
                operation: "REPORT",
                url: calendarUrl,
                username,
                password
            });

        setStatus(
            `REPORT: HTTP ${result.status} ${result.statusText}`
        );

        headersElement.textContent =
            result.headers || "";

        responseElement.textContent =
            result.body || "";

        if (Array.isArray(result.todos)) {

            currentTodos =
                result.todos;

            displayTodos(
                currentTodos
            );

        }

    } catch (error) {

        setStatus("REPORT: ERROR");

        responseElement.textContent =
            `${error.name}: ${error.message}`;

        console.error(
            "REPORT ERROR:",
            error
        );
    }
}


/*
 * Refresh button.
 */
document
    .getElementById("refreshButton")
    ?.addEventListener(
        "click",
        () => loadTodos()
    );


/*
 * =========================================================
 * VTODO selection / editor
 * =========================================================
 */

const todoEditor =
    document.getElementById("todoEditor");

const todoEditorTask =
    document.getElementById("todoEditorTask");

const todoTitleInput =
    document.getElementById("todoTitleInput");

const todoDescriptionInput =
    document.getElementById(
        "todoDescriptionInput"
    );

const todoProgressInput =
    document.getElementById(
        "todoProgressInput"
    );

const todoProgressValue =
    document.getElementById(
        "todoProgressValue"
    );

const todoStartInput =
    document.getElementById(
        "todoStartInput"
    );

const todoDueValue =
    document.getElementById(
        "todoDueValue"
    );

const todoDurationInput =
    document.getElementById(
        "todoDurationInput"
    );


const renameTaskButton =
    document.getElementById(
        "renameTaskButton"
    );

const deleteTaskButton =
    document.getElementById(
        "deleteTaskButton"
    );


function selectTodo(todo) {

    /*
     * displayTodos() arbeitet für die Darstellung mit Kopien
     * der VTODOs. Für Änderungen müssen wir aber das Original
     * aus currentTodos verwenden.
     */
    selectedTodo =
        currentTodos.find(
            currentTodo =>
                currentTodo.uid === todo.uid
        ) || todo;

    /*
     * Ein einfacher Klick auf einen Task öffnet nur
     * die Readonly-Darstellung.
     */
    if (!creatingTodo) {
        editingTodo = false;
    }

    updateTodoEditor();

    updateSelectionButtons();

    displayTodos(currentTodos);
}


function updateSelectionButtons() {

    const enabled =
        !!selectedTodo &&
        !creatingTodo;

    if (renameTaskButton) {
        renameTaskButton.disabled =
            !enabled;
    }

    if (deleteTaskButton) {
        deleteTaskButton.disabled =
            !enabled;
    }

    /*
     * These buttons are selection-dependent too.
     */
    for (const id of [
        "indentButton",
        "outdentButton",
        "moveUpButton",
        "moveDownButton",
        "previousWeekButton",
        "previousDayButton",
        "nextDayButton",
        "nextWeekButton",
        "durationMinusButton",
        "durationPlusButton"
    ]) {

        const button =
            document.getElementById(id);

        if (button) {
            button.disabled = !enabled;
        }

    }
}



function updateTodoEditorModeIndicator(editable) {

    if (!todoEditor) {
        return;
    }

    /*
     * Der Editor-Header enthält todoEditorTask.
     * Wir setzen dort einen kleinen, eindeutig sichtbaren
     * Statushinweis direkt neben den Tasknamen.
     */
    if (todoEditorTask) {

        let badge =
            document.getElementById(
                "todoEditorModeBadge"
            );

        if (!badge) {

            badge =
                document.createElement("span");

            badge.id =
                "todoEditorModeBadge";

            badge.style.display =
                "inline-block";

            badge.style.marginLeft =
                "14px";

            badge.style.padding =
                "2px 8px";

            badge.style.borderRadius =
                "3px";

            badge.style.fontSize =
                "12px";

            badge.style.fontWeight =
                "bold";

            todoEditorTask.parentElement?.appendChild(
                badge
            );

        }

        if (editable) {

            badge.textContent =
                "BEARBEITEN";

            badge.style.background =
                "#d9ead3";

            badge.style.color =
                "#274e13";

        } else {

            badge.textContent =
                "READ-ONLY";

            badge.style.background =
                "#e0e0e0";

            badge.style.color =
                "#555";

        }

    }

    /*
     * Die statische Überschrift im Editor wird ebenfalls
     * angepasst. Wir suchen nicht nach einem bestimmten
     * HTML-Element, sondern nach dem tatsächlichen Text.
     */
    const header =
        todoEditorTask?.parentElement;

    if (header) {

        const walker =
            document.createTreeWalker(
                header,
                NodeFilter.SHOW_TEXT
            );

        const textNodes = [];

        let node;

        while (
            node = walker.nextNode()
        ) {
            textNodes.push(node);
        }

        for (const textNode of textNodes) {

            const text =
                textNode.nodeValue.trim();

            if (
                text === "VTODO bearbeiten" ||
                text === "VTODO anzeigen"
            ) {

                textNode.nodeValue =
                    editable
                        ? "VTODO bearbeiten "
                        : "VTODO anzeigen ";

                break;
            }

        }

    }

}


function updateTodoEditor() {

    if (!selectedTodo) {
        hideTodoEditor();
        return;
    }

    if (!todoEditor) {
        return;
    }

    const editable =
        creatingTodo || editingTodo;

    todoEditor.classList.remove(
        "hidden"
    );

    /*
     * Sichtbare Kennzeichnung des Modus.
     */
    todoEditor.classList.toggle(
        "readonly-mode",
        !editable
    );

    todoEditor.classList.toggle(
        "edit-mode",
        editable
    );


    if (todoEditorTask) {

        todoEditorTask.textContent =
            selectedTodo.summary ||
            selectedTodo.uid ||
            "";

    }


    updateTodoEditorModeIndicator(
        editable
    );


    if (todoTitleInput) {

        todoTitleInput.value =
            selectedTodo.summary || "";

        todoTitleInput.disabled =
            false;

        todoTitleInput.readOnly =
            !editable;

    }


    if (todoDescriptionInput) {

        todoDescriptionInput.value =
            selectedTodo.description || "";

        todoDescriptionInput.disabled =
            false;

        todoDescriptionInput.readOnly =
            !editable;

    }


    const progress =
        Number.isFinite(
            selectedTodo.percentComplete
        )
            ? selectedTodo.percentComplete
            : 0;


    if (todoProgressInput) {

        todoProgressInput.value =
            progress;

        /*
         * Range-Inputs besitzen kein readOnly.
         * Deshalb im Readonly-Modus deaktivieren.
         */
        todoProgressInput.disabled =
            !editable;

    }

    if (todoProgressValue) {

        todoProgressValue.textContent =
            `${progress} %`;

    }


    if (todoStartInput) {

        todoStartInput.value =
            formatDateInputValue(
                selectedTodo.dtstart
            );

        todoStartInput.disabled =
            !editable;

    }


    if (todoDueValue) {

        todoDueValue.textContent =
            formatIcsDate(
                selectedTodo.due
            ) || "-";

    }


    if (todoDurationInput) {

        const durationText =
            calculateTodoDuration(
                selectedTodo.dtstart,
                selectedTodo.due
            );

        const durationMatch =
            String(durationText).match(
                /^(\d+)/
            );

        todoDurationInput.value =
            durationMatch
                ? durationMatch[1]
                : "1";

        todoDurationInput.disabled =
            !editable;

    }


    /*
     * Speichern und Abbrechen sind nur im
     * Bearbeitungsmodus aktiv.
     */
    const saveButton =
        document.getElementById(
            "todoSaveButton"
        );

    const cancelButton =
        document.getElementById(
            "todoCancelButton"
        );

    if (saveButton) {
        saveButton.disabled =
            !editable;
    }

    /*
     * Abbrechen bedeutet:
     * "Editor/Anzeige schließen".
     *
     * Deshalb ist der Button auch im READ-ONLY-Modus
     * aktiv.
     */
    if (cancelButton) {
        cancelButton.disabled =
            false;
    }

}


function hideTodoEditor() {

    editingTodo = false;

    if (todoEditor) {

        todoEditor.classList.add(
            "hidden"
        );

        todoEditor.classList.remove(
            "readonly-mode",
            "edit-mode"
        );

    }

    const badge =
        document.getElementById(
            "todoEditorModeBadge"
        );

    if (badge) {
        badge.remove();
    }

}


function formatDateInputValue(value) {

    if (!value) {
        return "";
    }

    const text =
        String(value).trim();

    const match =
        text.match(
            /^(\d{4})(\d{2})(\d{2})/
        );

    if (!match) {
        return "";
    }

    return (
        `${match[1]}-${match[2]}-${match[3]}`
    );
}


function dateInputToIcs(value) {

    if (!value) {
        return "";
    }

    return String(value)
        .replaceAll("-", "");
}


function calculateDueFromStartDuration(
    startIcs,
    duration
) {

    if (!startIcs) {
        return "";
    }

    const startDate =
        parseIcsDate(startIcs);

    const days =
        Number(duration);

    if (
        !startDate ||
        !Number.isInteger(days) ||
        days < 1
    ) {
        return "";
    }

    const dueDate =
        new Date(startDate);

    dueDate.setDate(
        dueDate.getDate() +
        days -
        1
    );

    const yyyy =
        String(dueDate.getFullYear());

    const mm =
        String(dueDate.getMonth() + 1)
            .padStart(2, "0");

    const dd =
        String(dueDate.getDate())
            .padStart(2, "0");

    return `${yyyy}${mm}${dd}`;
}


function calculateTodoDuration(
    start,
    due
) {

    if (!start || !due) {
        return "-";
    }

    const startDate =
        parseIcsDate(start);

    const dueDate =
        parseIcsDate(due);

    if (
        !startDate ||
        !dueDate
    ) {
        return "-";
    }

    const diff =
        Math.round(
            (
                dueDate.getTime() -
                startDate.getTime()
            ) /
            86400000
        );

    /*
     * TB Planner treats identical start/due
     * as one calendar day.
     */
    return `${Math.max(1, diff + 1)} Tag(e)`;
}


/*
 * Start/Dauer beim Erzeugen eines neuen Tasks.
 *
 * Das Fälligkeitsdatum wird sofort neu berechnet.
 */

function updateNewTaskDates() {

    if (!creatingTodo || !selectedTodo) {
        return;
    }

    const startIcs =
        dateInputToIcs(
            todoStartInput?.value || ""
        );

    const duration =
        Number(
            todoDurationInput?.value || 0
        );

    if (!startIcs) {
        if (todoDueValue) {
            todoDueValue.textContent = "-";
        }
        return;
    }

    if (
        !Number.isInteger(duration) ||
        duration < 1
    ) {
        if (todoDueValue) {
            todoDueValue.textContent = "-";
        }
        return;
    }

    const dueIcs =
        calculateDueFromStartDuration(
            startIcs,
            duration
        );

    selectedTodo.dtstart =
        startIcs;

    selectedTodo.due =
        dueIcs;

    selectedTodo.dtstartParameters =
        "VALUE=DATE";

    selectedTodo.dueParameters =
        "VALUE=DATE";

    if (todoDueValue) {

        todoDueValue.textContent =
            formatIcsDate(
                dueIcs
            ) || "-";

    }
}


todoStartInput?.addEventListener(
    "input",
    updateNewTaskDates
);


todoDurationInput?.addEventListener(
    "input",
    updateNewTaskDates
);


/*
 * Progress slider.
 */
todoProgressInput?.addEventListener(
    "input",
    () => {

        if (todoProgressValue) {

            todoProgressValue.textContent =
                `${todoProgressInput.value} %`;

        }

    }
);


/*
 * Save editor.
 */
document
    .getElementById("todoSaveButton")
    ?.addEventListener(
        "click",
        () => saveSelectedTodo()
    );


/*
 * Cancel editor.
 *
 * Reload the values from the selected VTODO.
 */
document
    .getElementById("todoCancelButton")
    ?.addEventListener(
        "click",
        () => {

            if (creatingTodo) {

                creatingTodo = false;
                editingTodo = false;
                selectedTodo = null;

                hideTodoEditor();
                updateSelectionButtons();

                displayTodos(
                    currentTodos
                );

                setStatus(
                    "Neuer Task verworfen."
                );

                return;
            }

            /*
             * Bestehenden Task bearbeiten:
             * Änderungen verwerfen und Editor schließen.
             * Der Task bleibt ausgewählt.
             */
            editingTodo = false;

            hideTodoEditor();

            updateSelectionButtons();

            displayTodos(
                currentTodos
            );

            setStatus(
                "Bearbeitung abgebrochen."
            );
        }
    );


/*
 * Top "Titel ändern" button.
 *
 * It now focuses the actual editor field.
 */
renameTaskButton?.addEventListener(
    "click",
    () => {

        if (!selectedTodo) {
            return;
        }

        /*
         * Jetzt ausdrücklich in den Bearbeitungsmodus
         * wechseln.
         */
        editingTodo = true;

        updateTodoEditor();

        todoTitleInput?.focus();

        todoTitleInput?.select();

    }
);


/*
 * Top "Task löschen" button.
 */
deleteTaskButton?.addEventListener(
    "click",
    () => deleteSelectedTodo()
);


/*
 * Editor DELETE button.
 */
document
    .getElementById("todoDeleteButton")
    ?.addEventListener(
        "click",
        () => deleteSelectedTodo()
    );


async function saveSelectedTodo() {

    if (!selectedTodo) {
        return;
    }


    const calendarUrl =
        document
            .getElementById("serverUrl")
            .value
            .trim();

    const username =
        document
            .getElementById("username")
            .value;

    const password =
        document
            .getElementById("password")
            .value;


    if (!calendarUrl) {

        setStatus(
            "PUT: Keine CalDAV-Kalender-URL."
        );

        return;
    }


    const summary =
        todoTitleInput?.value.trim() || "";

    if (!summary) {

        setStatus(
            "PUT: Titel darf nicht leer sein."
        );

        todoTitleInput?.focus();

        return;
    }


    const description =
        todoDescriptionInput?.value || "";


    const percent =
        Number(
            todoProgressInput?.value || 0
        );


    /*
     * --------------------------------------------------------
     * Neuer Task
     * --------------------------------------------------------
     */

    if (creatingTodo) {

        const uid =
            selectedTodo.uid ||
            crypto.randomUUID();

        selectedTodo.uid =
            uid;

        selectedTodo.summary =
            summary;

        selectedTodo.description =
            description;

        selectedTodo.percentComplete =
            Number.isFinite(percent)
                ? percent
                : 0;

        selectedTodo.status =
            "NEEDS-ACTION";


        /*
         * Start + Dauer -> Fälligkeitsdatum.
         */

        const startInputValue =
            todoStartInput?.value || "";

        const duration =
            Number(
                todoDurationInput?.value || 0
            );

        const startIcs =
            dateInputToIcs(
                startInputValue
            );

        if (
            !Number.isInteger(duration) ||
            duration < 1
        ) {

            setStatus(
                "PUT: Dauer muss mindestens 1 Tag sein."
            );

            todoDurationInput?.focus();

            return;

        }

        const dueIcs =
            calculateDueFromStartDuration(
                startIcs,
                duration
            );

        if (!dueIcs) {

            setStatus(
                "PUT: Start/Dauer konnten nicht berechnet werden."
            );

            return;

        }

        selectedTodo.dtstart =
            startIcs;

        selectedTodo.due =
            dueIcs;

        selectedTodo.dtstartParameters =
            "VALUE=DATE";

        selectedTodo.dueParameters =
            "VALUE=DATE";


        /*
         * CalDAV-Ressource für einen neuen VTODO.
         *
         * Die Kalender-URL bleibt unverändert.
         */
        const resourceUrl =
            `${calendarUrl.replace(/\/+$/, "")}/${uid}.ics`;


        const body =
            buildVTodoIcs(
                selectedTodo,
                {
                    summary,
                    description,
                    percentComplete:
                        selectedTodo.percentComplete
                }
            );


        setStatus("PUT neuer Task ...");

        headersElement.textContent = "";
        responseElement.textContent = "";


        try {

            const result =
                await executeCalDavRequest({
                    operation: "PUT",
                    url: resourceUrl,
                    username,
                    password,
                    body
                });


            headersElement.textContent =
                result.headers || "";

            responseElement.textContent =
                result.body || "";


            if (
                result.status >= 200 &&
                result.status < 300
            ) {

                setStatus(
                    `PUT: HTTP ${result.status} ${result.statusText}`
                );

                /*
                 * Ab jetzt ist es ein normaler bestehender Task.
                 */
                creatingTodo = false;
                editingTodo = false;

                /*
                 * REPORT lädt den Task neu vom Server.
                 */
                const createdUid =
                    uid;

                await loadTodos();

                /*
                 * Der neue Task wurde erfolgreich gespeichert.
                 * Danach den Editor schließen und die normale
                 * Planungsansicht anzeigen.
                 */
                selectedTodo = null;

                hideTodoEditor();

                updateSelectionButtons();

                displayTodos(
                    currentTodos
                );

                window.alert(
                    `Task "${summary}" wurde erfolgreich gespeichert.`
                );

            } else {

                setStatus(
                    `PUT: HTTP ${result.status} ${result.statusText}`
                );

            }


        } catch (error) {

            setStatus(
                "PUT neuer Task: ERROR"
            );

            responseElement.textContent =
                `${error.name}: ${error.message}`;

        }

        return;
    }


    /*
     * --------------------------------------------------------
     * Bestehenden Task speichern
     * --------------------------------------------------------
     */

    if (!selectedTodo.href) {

        setStatus(
            "PUT: VTODO has no resource URL."
        );

        return;
    }


    const body =
        buildVTodoIcs(
            selectedTodo,
            {
                summary,
                description,
                percentComplete:
                    Number.isFinite(percent)
                        ? percent
                        : 0
            }
        );


    setStatus("PUT ...");


    try {

        const result =
            await executeCalDavRequest({
                operation: "PUT",
                url: resolveResourceUrl(
                    calendarUrl,
                    selectedTodo.href
                ),
                username,
                password,
                body
            });


        headersElement.textContent =
            result.headers;

        responseElement.textContent =
            result.body;


        if (
            result.status >= 200 &&
            result.status < 300
        ) {

            setStatus(
                `PUT: HTTP ${result.status} ${result.statusText}`
            );

            await loadTodos();

            editingTodo = false;

            /*
             * PUT erfolgreich:
             * Bearbeitungsbereich schließen und Auswahl
             * zurücksetzen.
             */
            selectedTodo = null;

            hideTodoEditor();

            updateSelectionButtons();

            displayTodos(
                currentTodos
            );

            window.alert(
                `Task "${summary}" wurde erfolgreich gespeichert.`
            );

        } else {

            setStatus(
                `PUT: HTTP ${result.status} ${result.statusText}`
            );

        }

    } catch (error) {

        setStatus("PUT: ERROR");

        responseElement.textContent =
            `${error.name}: ${error.message}`;

    }

}

function resolveResourceUrl(
    calendarUrl,
    href
) {

    if (!href) {
        return "";
    }

    if (
        href.startsWith("http://") ||
        href.startsWith("https://")
    ) {
        return href;
    }

    return new URL(
        href,
        calendarUrl
    ).toString();

}


function escapeIcsText(value) {

    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");

}



/*
 * =========================================================
 * Planner date helpers
 * =========================================================
 */

function shiftIcsDate(value, days) {

    if (!value) {
        return value;
    }

    const text = String(value);

    const match =
        text.match(
            /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/
        );

    if (!match) {
        return value;
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);

    const date =
        new Date(
            year,
            month,
            day
        );

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    date.setDate(
        date.getDate() + days
    );

    const yyyy =
        String(date.getFullYear());

    const mm =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const dd =
        String(date.getDate())
            .padStart(2, "0");

    /*
     * Keep the original time part.
     */
    if (match[4]) {

        return (
            `${yyyy}${mm}${dd}` +
            match[4]
        );

    }

    return `${yyyy}${mm}${dd}`;
}


function changeTodoDates(todo, days) {

    if (!todo) {
        return;
    }

    if (todo.dtstart) {

        todo.dtstart =
            shiftIcsDate(
                todo.dtstart,
                days
            );

    }

    if (todo.due) {

        todo.due =
            shiftIcsDate(
                todo.due,
                days
            );

    }

}


/*
 * Change duration while keeping DTSTART fixed.
 */
function changeTodoDuration(todo, days) {

    if (!todo || !todo.due) {
        return;
    }

    todo.due =
        shiftIcsDate(
            todo.due,
            days
        );

}


/*
 * PUT the currently selected VTODO.
 *
 * This uses the same synchronization mechanism as the
 * editor and therefore preserves the existing CalDAV logic.
 */
async function putTodo(todo) {

    if (!todo || !todo.href) {

        setStatus(
            "PUT: VTODO has no resource URL."
        );

        return false;
    }

    const calendarUrl =
        document
            .getElementById("serverUrl")
            .value
            .trim();

    const username =
        document
            .getElementById("username")
            .value;

    const password =
        document
            .getElementById("password")
            .value;

    const body =
        buildVTodoIcs(
            todo,
            {
                summary:
                    todo.summary || "",

                description:
                    todo.description || "",

                percentComplete:
                    Number.isFinite(
                        todo.percentComplete
                    )
                        ? todo.percentComplete
                        : 0
            }
        );

    try {

        const result =
            await executeCalDavRequest({
                operation: "PUT",
                url: resolveResourceUrl(
                    calendarUrl,
                    todo.href
                ),
                username,
                password,
                body
            });

        headersElement.textContent =
            result.headers || "";

        responseElement.textContent =
            result.body || "";

        if (
            result.status >= 200 &&
            result.status < 300
        ) {

            return true;
        }

        setStatus(
            `PUT: HTTP ${result.status} ${result.statusText}`
        );

        return false;

    } catch (error) {

        setStatus("PUT: ERROR");

        responseElement.textContent =
            `${error.name}: ${error.message}`;

        return false;
    }
}


async function shiftSelectedTodo(days) {

    console.log(
        "[TB-PLANNER DEBUG] shiftSelectedTodo() START",
        {
            days,
            selectedTodo: selectedTodo
                ? {
                    uid: selectedTodo.uid,
                    summary: selectedTodo.summary,
                    dtstart: selectedTodo.dtstart,
                    due: selectedTodo.due,
                    href: selectedTodo.href
                }
                : null
        }
    );

    if (!selectedTodo) {

        console.warn(
            "[TB-PLANNER DEBUG] shiftSelectedTodo(): KEINE AUSWAHL"
        );

        return;
    }

    const before = {
        dtstart: selectedTodo.dtstart,
        due: selectedTodo.due
    };

    const currentTodo =
        currentTodos.find(
            todo => todo.uid === selectedTodo.uid
        );

    console.log(
        "[TB-PLANNER DEBUG] shiftSelectedTodo(): OBJEKTVERGLEICH",
        {
            sameObject: currentTodo === selectedTodo,
            selected: currentTodo
                ? {
                    uid: currentTodo.uid,
                    dtstart: currentTodo.dtstart,
                    due: currentTodo.due
                }
                : null,
            selectedTodo: {
                uid: selectedTodo.uid,
                dtstart: selectedTodo.dtstart,
                due: selectedTodo.due
            }
        }
    );

    changeTodoDates(
        selectedTodo,
        days
    );

    console.log(
        "[TB-PLANNER DEBUG] shiftSelectedTodo(): NACH Änderung currentTodos",
        {
            currentTodo: currentTodo
                ? {
                    uid: currentTodo.uid,
                    dtstart: currentTodo.dtstart,
                    due: currentTodo.due
                }
                : null,
            selectedTodo: {
                uid: selectedTodo.uid,
                dtstart: selectedTodo.dtstart,
                due: selectedTodo.due
            }
        }
    );

    console.log(
        "[TB-PLANNER DEBUG] shiftSelectedTodo(): DATEN GEÄNDERT",
        {
            days,
            before,
            after: {
                dtstart: selectedTodo.dtstart,
                due: selectedTodo.due
            }
        }
    );

    updateTodoEditor();
    console.log(
        "[TB-PLANNER DEBUG] shiftSelectedTodo(): Anzeige vor displayTodos()",
        {
            selectedTodo: {
                uid: selectedTodo?.uid,
                summary: selectedTodo?.summary,
                dtstart: selectedTodo?.dtstart,
                due: selectedTodo?.due
            },

            currentTodos: currentTodos.map(
                todo => ({
                    uid: todo.uid,
                    summary: todo.summary,
                    dtstart: todo.dtstart,
                    due: todo.due,
                    sameObject:
                        todo === selectedTodo
                })
            )
        }
    );

    displayTodos(currentTodos);

    setStatus("PUT ...");

    const ok =
        await putTodo(selectedTodo);

    console.log(
        "[TB-PLANNER DEBUG] shiftSelectedTodo(): PUT RESULT",
        {
            ok,
            dtstart: selectedTodo.dtstart,
            due: selectedTodo.due
        }
    );

    if (ok) {

        setStatus("PUT: OK");

    }
}


async function changeSelectedDuration(days) {

    console.log(
        "[TB-PLANNER DEBUG] changeSelectedDuration() START",
        {
            days,
            selectedTodo: selectedTodo
                ? {
                    uid: selectedTodo.uid,
                    summary: selectedTodo.summary,
                    dtstart: selectedTodo.dtstart,
                    due: selectedTodo.due,
                    href: selectedTodo.href
                }
                : null
        }
    );

    if (!selectedTodo) {

        console.warn(
            "[TB-PLANNER DEBUG] changeSelectedDuration(): KEINE AUSWAHL"
        );

        return;
    }

    const before = {
        dtstart: selectedTodo.dtstart,
        due: selectedTodo.due
    };

    changeTodoDuration(
        selectedTodo,
        days
    );

    console.log(
        "[TB-PLANNER DEBUG] changeSelectedDuration(): DATEN GEÄNDERT",
        {
            days,
            before,
            after: {
                dtstart: selectedTodo.dtstart,
                due: selectedTodo.due
            }
        }
    );

    updateTodoEditor();
    displayTodos(currentTodos);

    setStatus("PUT ...");

    const ok =
        await putTodo(selectedTodo);

    console.log(
        "[TB-PLANNER DEBUG] changeSelectedDuration(): PUT RESULT",
        {
            ok,
            dtstart: selectedTodo.dtstart,
            due: selectedTodo.due
        }
    );

    if (ok) {

        setStatus("PUT: OK");

    }
}


function buildVTodoIcs(
    todo,
    changes
) {

    const summary =
        escapeIcsText(
            changes.summary
        );

    const description =
        escapeIcsText(
            changes.description
        );


    const percent =
        Number.isFinite(
            changes.percentComplete
        )
            ? changes.percentComplete
            : 0;


    const lines = [
        "BEGIN:VCALENDAR",
        "PRODID:-//TB Planner//EN",
        "VERSION:2.0",
        "BEGIN:VTODO",
        `UID:${todo.uid}`,
        `SUMMARY:${summary}`
    ];


    if (description) {

        lines.push(
            `DESCRIPTION:${description}`
        );

    }


    if (todo.status) {

        lines.push(
            `STATUS:${todo.status}`
        );

    } else {

        lines.push(
            "STATUS:NEEDS-ACTION"
        );

    }


    lines.push(
        `PERCENT-COMPLETE:${percent}`
    );


    if (todo.dtstart) {

        lines.push(
            `DTSTART${todo.dtstartParameters ? ";" + todo.dtstartParameters : ""}:${todo.dtstart}`
        );

    }


    if (todo.due) {

        lines.push(
            `DUE${todo.dueParameters ? ";" + todo.dueParameters : ""}:${todo.due}`
        );

    }


    if (todo.wbs) {

        lines.push(
            `X-TB-PLANNER-WBS:${escapeIcsText(todo.wbs)}`
        );

    }


    if (todo.parent) {

        lines.push(
            `X-TB-PLANNER-PARENT:${escapeIcsText(todo.parent)}`
        );

    }


    if (Number.isFinite(todo.order)) {

        lines.push(
            `X-TB-PLANNER-ORDER:${todo.order}`
        );

    }


    lines.push(
        "END:VTODO",
        "END:VCALENDAR"
    );


    return (
        lines.join("\r\n") +
        "\r\n"
    );

}


async function deleteSelectedTodo() {

    if (!selectedTodo) {
        return;
    }

    if (!selectedTodo.href) {

        setStatus(
            "DELETE: VTODO has no resource URL."
        );

        return;

    }


    const confirmed =
        window.confirm(
            `Task "${selectedTodo.summary || selectedTodo.uid}" wirklich löschen?`
        );

    if (!confirmed) {
        return;
    }


    const calendarUrl =
        document
            .getElementById("serverUrl")
            .value
            .trim();

    const username =
        document
            .getElementById("username")
            .value;

    const password =
        document
            .getElementById("password")
            .value;


    setStatus("DELETE ...");


    try {

        const result =
            await executeCalDavRequest({
                operation: "DELETE",
                url: resolveResourceUrl(
                    calendarUrl,
                    selectedTodo.href
                ),
                username,
                password
            });


        headersElement.textContent =
            result.headers;

        responseElement.textContent =
            result.body;


        if (
            result.status >= 200 &&
            result.status < 300
        ) {

            setStatus(
                `DELETE: HTTP ${result.status} ${result.statusText}`
            );

            selectedTodo = null;

            hideTodoEditor();

            updateSelectionButtons();

            await loadTodos();

        } else {

            setStatus(
                `DELETE: HTTP ${result.status} ${result.statusText}`
            );

        }

    } catch (error) {

        setStatus("DELETE: ERROR");

        responseElement.textContent =
            `${error.name}: ${error.message}`;

    }

}


/*
 * Initial selection state.
 */
updateSelectionButtons();


/*
 * =========================================================
 * Planner toolbar DEBUG
 * =========================================================
 */

console.log(
    "[TB-PLANNER DEBUG] Toolbar-Debug wird initialisiert."
);


function toolbarDebug(name, handler) {

    const button =
        document.getElementById(name);

    if (!button) {

        console.error(
            `[TB-PLANNER DEBUG] BUTTON NICHT GEFUNDEN: ${name}`
        );

        return;
    }

    console.log(
        `[TB-PLANNER DEBUG] Button gefunden: ${name}`,
        button
    );

    button.addEventListener(
        "click",
        async event => {

            console.log(
                `[TB-PLANNER DEBUG] CLICK: ${name}`,
                {
                    disabled: button.disabled,
                    selectedTodo: selectedTodo
                        ? {
                            uid: selectedTodo.uid,
                            summary: selectedTodo.summary,
                            dtstart: selectedTodo.dtstart,
                            due: selectedTodo.due,
                            href: selectedTodo.href
                        }
                        : null
                }
            );

            try {

                await handler();

                console.log(
                    `[TB-PLANNER DEBUG] HANDLER OK: ${name}`
                );

            } catch (error) {

                console.error(
                    `[TB-PLANNER DEBUG] HANDLER ERROR: ${name}`,
                    error
                );

            }

        }
    );
}


toolbarDebug(
    "previousDayButton",
    async () => {

        console.log(
            "[TB-PLANNER DEBUG] previousDayButton -> shift -1"
        );

        await shiftSelectedTodo(-1);

    }
);


toolbarDebug(
    "nextDayButton",
    async () => {

        console.log(
            "[TB-PLANNER DEBUG] nextDayButton -> shift +1"
        );

        await shiftSelectedTodo(1);

    }
);


toolbarDebug(
    "previousWeekButton",
    async () => {

        console.log(
            "[TB-PLANNER DEBUG] previousWeekButton -> shift -7"
        );

        await shiftSelectedTodo(-7);

    }
);


toolbarDebug(
    "nextWeekButton",
    async () => {

        console.log(
            "[TB-PLANNER DEBUG] nextWeekButton -> shift +7"
        );

        await shiftSelectedTodo(7);

    }
);


toolbarDebug(
    "durationMinusButton",
    async () => {

        console.log(
            "[TB-PLANNER DEBUG] durationMinusButton -> duration -1"
        );

        await changeSelectedDuration(-1);

    }
);


toolbarDebug(
    "durationPlusButton",
    async () => {

        console.log(
            "[TB-PLANNER DEBUG] durationPlusButton -> duration +1"
        );

        await changeSelectedDuration(1);

    }
);


/*
 * =========================================================
 * Neuer Task
 * =========================================================
 *
 * Der vorhandene VTODO-Editor wird auch für neue Tasks
 * verwendet. Erst "Speichern" erzeugt die CalDAV-Ressource.
 */

document
    .getElementById("newTaskButton")
    ?.addEventListener(
        "click",
        () => {

            /*
             * Falls bereits ein neuer Task bearbeitet wird,
             * nicht noch einen zweiten erzeugen.
             */
            if (creatingTodo) {
                return;
            }


            /*
             * Den bisher ausgewählten Task merken.
             *
             * Ein neuer Task wird als Geschwister des
             * ausgewählten Tasks angelegt. Ohne Auswahl
             * entsteht ein neuer Root-Task.
             */
            const referenceTodo =
                selectedTodo &&
                !creatingTodo
                    ? selectedTodo
                    : null;


            const placement =
                getNewTaskPlacement(
                    referenceTodo
                );


            const uid =
                crypto.randomUUID();


            selectedTodo = {

                uid,

                href: "",

                summary: "",

                description: "",

                status: "NEEDS-ACTION",

                percentComplete: 0,

                dtstart: null,

                due: null,

                wbs: placement.wbs,

                parent: placement.parent,

                order: placement.order

            };


            creatingTodo = true;
            editingTodo = true;


            /*
             * Editor öffnen und leeren Task anzeigen.
             */
            updateTodoEditor();


            /*
             * Beim Anlegen eines neuen Tasks müssen die
             * Editfelder ausdrücklich aktiv sein.
             *
             * Der normale Auswahlzustand kann Buttons
             * deaktivieren; die eigentlichen Editfelder
             * dürfen davon aber nicht betroffen sein.
             */
            if (todoTitleInput) {

                todoTitleInput.disabled = false;
                todoTitleInput.readOnly = false;
                todoTitleInput.value = "";

            }


            if (todoDescriptionInput) {

                todoDescriptionInput.disabled = false;
                todoDescriptionInput.readOnly = false;
                todoDescriptionInput.value = "";

            }


            if (todoProgressInput) {

                todoProgressInput.disabled = false;
                todoProgressInput.value = 0;

            }


            if (todoProgressValue) {

                todoProgressValue.textContent =
                    "0 %";

            }


            /*
             * Start + Dauer beim Erzeugen eines neuen Tasks.
             *
             * Default:
             *   Start  = heute
             *   Dauer  = 1 Tag
             *
             * Das Fälligkeitsdatum wird daraus berechnet.
             */

            const today =
                new Date();

            const todayIcs =
                `${today.getFullYear()}${String(
                    today.getMonth() + 1
                ).padStart(2, "0")}${String(
                    today.getDate()
                ).padStart(2, "0")}`;

            selectedTodo.dtstart =
                todayIcs;

            selectedTodo.due =
                calculateDueFromStartDuration(
                    todayIcs,
                    1
                );

            selectedTodo.dtstartParameters =
                "VALUE=DATE";

            selectedTodo.dueParameters =
                "VALUE=DATE";


            if (todoStartInput) {

                todoStartInput.disabled =
                    false;

                todoStartInput.value =
                    formatDateInputValue(
                        todayIcs
                    );

            }


            if (todoDurationInput) {

                todoDurationInput.disabled =
                    false;

                todoDurationInput.value =
                    "1";

            }


            if (todoDueValue) {

                todoDueValue.textContent =
                    formatIcsDate(
                        selectedTodo.due
                    );

            }


            /*
             * Save/Cancel müssen ebenfalls bedienbar sein.
             */
            const saveButton =
                document.getElementById(
                    "todoSaveButton"
                );

            const cancelButton =
                document.getElementById(
                    "todoCancelButton"
                );

            if (saveButton) {
                saveButton.disabled = false;
            }

            if (cancelButton) {
                cancelButton.disabled = false;
            }


            /*
             * Erst jetzt den Cursor setzen.
             */
            requestAnimationFrame(() => {

                if (todoTitleInput) {

                    todoTitleInput.focus();

                    todoTitleInput.select();

                }

            });


            updateSelectionButtons();





            setStatus(
                "Neuer Task – Daten eingeben und speichern."
            );

        }
    );


/*
 * =========================================================
 * WBS / Reihenfolge
 * =========================================================
 */

toolbarDebug(
    "indentButton",
    async () => {

        await moveSelectedTodoStructure(
            "indent"
        );

    }
);


toolbarDebug(
    "outdentButton",
    async () => {

        await moveSelectedTodoStructure(
            "outdent"
        );

    }
);


toolbarDebug(
    "moveUpButton",
    async () => {

        await moveSelectedTodoStructure(
            "up"
        );

    }
);


toolbarDebug(
    "moveDownButton",
    async () => {

        await moveSelectedTodoStructure(
            "down"
        );

    }
);


/*
 * =========================================================
 * Timeline Zoom
 * =========================================================
 */

toolbarDebug(
    "zoomDayButton",
    async () => {

        timelineZoom = "day";

        console.log(
            "[TB-PLANNER DEBUG] Zoom -> day"
        );

        displayTodos(currentTodos);

    }
);


toolbarDebug(
    "zoomWeekButton",
    async () => {

        timelineZoom = "week";

        console.log(
            "[TB-PLANNER DEBUG] Zoom -> week"
        );

        displayTodos(currentTodos);

    }
);


toolbarDebug(
    "zoomMonthButton",
    async () => {

        timelineZoom = "month";

        console.log(
            "[TB-PLANNER DEBUG] Zoom -> month"
        );

        displayTodos(
            currentTodos
        );

    }
);


toolbarDebug(
    "zoomYearButton",
    async () => {

        timelineZoom = "kw";

        console.log(
            "[TB-PLANNER DEBUG] Zoom -> kw"
        );

        displayTodos(
            currentTodos
        );

    }
);


console.log(
    "[TB-PLANNER DEBUG] Toolbar-Debug initialisiert."
);


/* FIX: funktionierender Abbrechen-Button */

/* FIX: funktionierender Abbrechen-Button */

const todoCancelButtonFix =
    document.getElementById("todoCancelButton");

if (todoCancelButtonFix) {

    todoCancelButtonFix.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            /*
             * Aktuelle Bearbeitung beenden.
             * Die Auswahl bleibt erhalten, damit der Task
             * weiterhin markiert ist und erneut über
             * "Titel ändern" bearbeitet werden kann.
             */
            todoEditor.classList.add("hidden");

            setStatus(
                "Bearbeitung abgebrochen."
            );

        }
    );

}

