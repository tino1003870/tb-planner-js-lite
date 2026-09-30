import { executeCalDavRequest } from "./caldav.js";

const statusElement =
    document.getElementById("status");

const headersElement =
    document.getElementById("headers");

const responseElement =
    document.getElementById("response");

const todosElement =
    document.getElementById("todos");

const debugElement =
    document.getElementById("debug");

let currentTodos = [];

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
 * Display VTODOs
 */
function displayTodos(todos) {

    debugLog(
        "displayTodos() aufgerufen:",
        {
            isArray: Array.isArray(todos),
            count:
                Array.isArray(todos)
                    ? todos.length
                    : null
        }
    );

    if (!todosElement) {
        return;
    }

    todosElement.innerHTML = "";

    if (todos.length === 0) {
        todosElement.textContent =
            "No VTODOs found.";
        return;
    }

    const info =
        document.createElement("div");

    info.className = "todo-count";
    info.textContent =
        `${todos.length} VTODO(s)`;

    todosElement.appendChild(info);

    const table =
        document.createElement("table");

    table.className = "todo-table";

    const thead =
        document.createElement("thead");

    const headerRow =
        document.createElement("tr");

    const columns = [
        "WBS",
        "Summary",
        "Start",
        "Due",
        "Status",
        "%",
        "Parent",
        "Order",
        "Action"
    ];

    for (const column of columns) {

        const th =
            document.createElement("th");

        th.textContent = column;

        headerRow.appendChild(th);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody =
        document.createElement("tbody");

    const sortedTodos =
        [...todos].sort((a, b) => {

            const orderA =
                Number.isFinite(a.order)
                    ? a.order
                    : Number.MAX_SAFE_INTEGER;

            const orderB =
                Number.isFinite(b.order)
                    ? b.order
                    : Number.MAX_SAFE_INTEGER;

            return orderA - orderB;
        });

    for (const todo of sortedTodos) {

        const row =
            document.createElement("tr");

        addCell(row, todo.wbs || "");
        addCell(row, todo.summary || "");
        addCell(row, formatIcsDate(todo.dtstart));
        addCell(row, formatIcsDate(todo.due));
        addCell(row, todo.status || "");

        addCell(
            row,
            Number.isFinite(todo.percentComplete)
                ? String(todo.percentComplete)
                : ""
        );

        addCell(row, todo.parent || "");

        addCell(
            row,
            Number.isFinite(todo.order)
                ? String(todo.order)
                : ""
        );

        /*
         * GET button
         */
        const actionCell =
            document.createElement("td");

        const getButton =
            document.createElement("button");

        getButton.textContent = "GET";
        getButton.className = "todo-get-button";

        getButton.addEventListener(
            "click",
            () => getTodo(todo)
        );

        actionCell.appendChild(getButton);
        row.appendChild(actionCell);

        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    todosElement.appendChild(table);
}


/*
 * GET one VTODO using its href from REPORT.
 */
async function getTodo(todo) {

    if (!todo.href) {
        setStatus(
            "GET: VTODO has no href."
        );
        return;
    }

    const username =
        document
            .getElementById("username")
            .value;

    const password =
        document
            .getElementById("password")
            .value;

    /*
     * href returned by CalDAV is normally
     * relative to the server.
     */
    const serverUrl =
        document
            .getElementById("serverUrl")
            .value
            .trim();

    let resourceUrl;

    try {

        resourceUrl =
            new URL(todo.href, serverUrl).href;

    } catch (error) {

        setStatus(
            `GET: Invalid href - ${error.message}`
        );

        return;
    }

    setStatus(
        `GET ${todo.summary || todo.uid} ...`
    );

    headersElement.textContent = "";
    responseElement.textContent = "";

    try {

        const result =
            await executeCalDavRequest({
                operation: "GET",
                url: resourceUrl,
                username,
                password
            });

        setStatus(
            `GET: HTTP ${result.status} ${result.statusText}`
        );

        headersElement.textContent =
            result.headers;

        responseElement.textContent =
            result.body;

        /*
         * Remember the server URL and ETag
         * for the next PUT step.
         */
        todo.resourceUrl = resourceUrl;

        todo.serverEtag =
            extractHeader(
                result.headers,
                "etag"
            );

        resourceUrlElement.value =
            resourceUrl;

        etagElement.value =
            todo.serverEtag;

        putBodyElement.value =
            result.body;

    } catch (error) {

        setStatus("GET: ERROR");

        responseElement.textContent =
            `${error.name}: ${error.message}`;
    }
}


/*
 * Extract one response header.
 */
function extractHeader(headers, name) {

    const lines =
        headers.split("\n");

    const wanted =
        name.toLowerCase();

    for (const line of lines) {

        const separator =
            line.indexOf(":");

        if (separator < 0) {
            continue;
        }

        const headerName =
            line
                .substring(0, separator)
                .trim()
                .toLowerCase();

        if (headerName === wanted) {
            return line
                .substring(separator + 1)
                .trim();
        }
    }

    return "";
}


function addCell(row, value) {

    const cell =
        document.createElement("td");

    cell.textContent = value;

    row.appendChild(cell);
}


function formatIcsDate(value) {

    if (!value) {
        return "";
    }

    if (/^\d{8}$/.test(value)) {

        return (
            value.substring(6, 8) +
            "." +
            value.substring(4, 6) +
            "." +
            value.substring(0, 4)
        );
    }

    return value;
}


/*
 * PUT the currently edited VTODO back to CalDAV.
 */
const putButton =
    document.getElementById("putButton");

const putBodyElement =
    document.getElementById("putBody");

const etagElement =
    document.getElementById("etag");

const resourceUrlElement =
    document.getElementById("resourceUrl");


putButton?.addEventListener("click", async () => {

    const resourceUrl =
        resourceUrlElement.value.trim();

    const etag =
        etagElement.value.trim();

    const body =
        putBodyElement.value;

    const username =
        document
            .getElementById("username")
            .value;

    const password =
        document
            .getElementById("password")
            .value;

    if (!resourceUrl) {
        setStatus(
            "PUT: No resource selected."
        );
        return;
    }

    if (!body) {
        setStatus(
            "PUT: No iCalendar data."
        );
        return;
    }

    setStatus("PUT ...");

    try {

        const result =
            await executeCalDavRequest({
                operation: "PUT",
                url: resourceUrl,
                username,
                password,
                body,
                etag
            });

        setStatus(
            `PUT: HTTP ${result.status} ${result.statusText}`
        );

        headersElement.textContent =
            result.headers;

        responseElement.textContent =
            result.body;

        /*
         * Remember the new server ETag after a successful PUT.
         */
        if (result.status >= 200 && result.status < 300) {
            const newEtag =
                extractHeader(result.headers, "etag");

            if (newEtag) {
                etagElement.value = newEtag;
            }
        }

    } catch (error) {

        setStatus("PUT: ERROR");

        responseElement.textContent =
            `${error.name}: ${error.message}`;
    }
});


/*
 * DELETE the currently selected VTODO resource.
 *
 * The resource URL comes from the PUT editor.
 * No If-Match / ETag is sent.
 */
const deleteButton =
    document.querySelector(
        '[data-operation="DELETE"]'
    );

deleteButton?.addEventListener(
    "click",
    async () => {

        const resourceUrl =
            resourceUrlElement.value.trim();

        const username =
            document
                .getElementById("username")
                .value;

        const password =
            document
                .getElementById("password")
                .value;

        if (!resourceUrl) {
            setStatus(
                "DELETE: No resource selected."
            );
            return;
        }

        const confirmed =
            window.confirm(
                `Delete this CalDAV resource?\n\n${resourceUrl}`
            );

        if (!confirmed) {
            setStatus("DELETE: Cancelled.");
            return;
        }

        setStatus("DELETE ...");

        headersElement.textContent = "";
        responseElement.textContent = "";

        try {

            const result =
                await executeCalDavRequest({
                    operation: "DELETE",
                    url: resourceUrl,
                    username,
                    password
                });

            setStatus(
                `DELETE: HTTP ${result.status} ${result.statusText}`
            );

            headersElement.textContent =
                result.headers;

            responseElement.textContent =
                result.body;

            /*
             * A successful DELETE normally returns 204.
             * Clear the editor because the resource no longer exists.
             */
            if (
                result.status >= 200 &&
                result.status < 300
            ) {
                etagElement.value = "";
                resourceUrlElement.value = "";
                putBodyElement.value = "";
            }

        } catch (error) {

            setStatus("DELETE: ERROR");

            responseElement.textContent =
                `${error.name}: ${error.message}`;
        }
    }
);


/*
 * Load all VTODOs from the configured CalDAV calendar.
 *
 * The visible serverUrl is always the calendar collection URL.
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
            result.headers;

        responseElement.textContent =
            result.body;

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
    }
}


/*
 * Create a new VTODO.
 *
 * The visible serverUrl is the CalDAV calendar collection.
 * A new UID is generated locally and used as the .ics resource name.
 */
const newTaskButton =
    document.getElementById("newTaskButton");

newTaskButton?.addEventListener(
    "click",
    async () => {

        console.log("NEW TASK: CLICK");

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
                "NEW TASK: No CalDAV calendar URL."
            );
            return;
        }

        /*
         * Read the task summary from the visible input field.
         * Electron does not support window.prompt().
         */
        const summaryElement =
            document.getElementById("newTaskSummary");

        const summary =
            summaryElement
                ? summaryElement.value.trim()
                : "";

        if (!summary) {
            setStatus(
                "NEW TASK: Please enter a Summary."
            );

            summaryElement?.focus();
            return;
        }

        const uid =
            crypto.randomUUID();

        /*
         * The CalDAV resource URL is derived internally.
         * The user-entered calendar URL itself is never changed.
         */
        const resourceUrl =
            `${calendarUrl.replace(/\/+$/, "")}/${uid}.ics`;

        /*
         * Minimal valid VTODO.
         */
        const body =
`BEGIN:VCALENDAR\r
PRODID:-//TB Planner//EN\r
VERSION:2.0\r
BEGIN:VTODO\r
UID:${uid}\r
SUMMARY:${summary}\r
STATUS:NEEDS-ACTION\r
PERCENT-COMPLETE:0\r
END:VTODO\r
END:VCALENDAR\r
`;

        setStatus("NEW TASK ...");

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

            setStatus(
                `NEW TASK: HTTP ${result.status} ${result.statusText}`
            );

            headersElement.textContent =
                result.headers;

            responseElement.textContent =
                result.body;

            if (
                result.status >= 200 &&
                result.status < 300
            ) {

                /*
                 * Store the newly created resource in the editor.
                 * This allows immediate GET/PUT/DELETE testing.
                 */
                resourceUrlElement.value =
                    resourceUrl;

                putBodyElement.value =
                    body;

                etagElement.value =
                    extractHeader(
                        result.headers,
                        "etag"
                    ) || "";

                /*
                 * Reload the VTODO list from the server.
                 */
                await loadTodos();

            }

        } catch (error) {

            setStatus(
                "NEW TASK: ERROR"
            );

            responseElement.textContent =
                `${error.name}: ${error.message}`;
        }
    }
);



function setStatus(text) {
    statusElement.textContent = text;
}
