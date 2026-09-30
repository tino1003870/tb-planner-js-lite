const {
    app,
    BrowserWindow,
    ipcMain,
    dialog
} = require("electron");

const path = require("node:path");
const https = require("node:https");

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,

        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(
        path.join(__dirname, "..", "src", "index.html")
    );
}


/*
 * CalDAV HTTP transport
 *
 * Runs in the Electron main process.
 * This avoids browser CORS restrictions.
 */
ipcMain.handle("caldav-request", async (_event, request) => {

    const {
        operation,
        url,
        username,
        password,
        headers = {},
        body = null
    } = request;

    if (!url) {
        throw new Error("CalDAV URL is empty.");
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error(`Invalid CalDAV URL: ${url}`);
    }

    if (parsedUrl.protocol !== "https:") {
        throw new Error(
            `Unsupported protocol: ${parsedUrl.protocol}`
        );
    }

    const requestHeaders = {
        ...headers
    };

    if (username || password) {
        const credentials =
            Buffer.from(
                `${username || ""}:${password || ""}`,
                "utf8"
            ).toString("base64");

        requestHeaders["Authorization"] =
            `Basic ${credentials}`;
    }

    if (body !== null && body !== undefined) {
        requestHeaders["Content-Length"] =
            Buffer.byteLength(body, "utf8");
    }

    return await new Promise((resolve, reject) => {

        const req = https.request(
            parsedUrl,
            {
                method: operation,
                headers: requestHeaders
            },
            (res) => {

                const chunks = [];

                res.on("data", chunk => {
                    chunks.push(chunk);
                });

                res.on("end", () => {

                    const responseBody =
                        Buffer.concat(chunks).toString("utf8");

                    const responseHeaders = [];

                    for (const [name, value] of
                        Object.entries(res.headers)) {

                        if (Array.isArray(value)) {
                            responseHeaders.push(
                                `${name}: ${value.join(", ")}`
                            );
                        } else {
                            responseHeaders.push(
                                `${name}: ${value ?? ""}`
                            );
                        }
                    }

                    const status = res.statusCode || 0;

                    resolve({
                        ok: status >= 200 && status < 300,
                        status,
                        statusText: res.statusMessage || "",
                        headers: responseHeaders.join("\n"),
                        body: responseBody
                    });
                });
            }
        );

        req.on("error", error => {
            reject(error);
        });

        if (body !== null && body !== undefined) {
            req.write(body);
        }

        req.end();
    });
});


/*
 * Druck des aktuellen TB-Planner-Fensters.
 *
 * Der Renderer übergibt KEIN eigenes Drucklayout.
 * Electron druckt exakt den aktuell dargestellten Inhalt.
 */


/*
 * =========================================================
 * JSON Export
 * =========================================================
 */

ipcMain.handle(
    "export-tasks",
    async (event, todos) => {

        if (!Array.isArray(todos)) {
            return {
                success: false,
                failureReason:
                    "Ungültige Taskliste."
            };
        }

        const win =
            BrowserWindow.fromWebContents(
                event.sender
            );

        const result =
            await dialog.showSaveDialog(
                win,
                {
                    title:
                        "TB Planner – Tasks exportieren",

                    defaultPath:
                        "TB-Planner.json",

                    filters: [
                        {
                            name:
                                "JSON-Dateien",
                            extensions:
                                ["json"]
                        }
                    ]
                }
            );

        if (
            result.canceled ||
            !result.filePath
        ) {
            return {
                success: false,
                canceled: true
            };
        }

        try {

            const data = {

                format:
                    "tb-planner-json",

                version:
                    1,

                exportedAt:
                    new Date().toISOString(),

                tasks:
                    todos

            };

            await require("fs")
                .promises
                .writeFile(
                    result.filePath,
                    JSON.stringify(
                        data,
                        null,
                        2
                    ),
                    "utf8"
                );

            return {
                success: true,
                filePath:
                    result.filePath
            };

        } catch (error) {

            return {
                success: false,
                failureReason:
                    error.message
            };

        }

    }
);


/*
 * =========================================================
 * JSON Import
 * =========================================================
 */

ipcMain.handle(
    "import-tasks",
    async event => {

        const win =
            BrowserWindow.fromWebContents(
                event.sender
            );

        const result =
            await dialog.showOpenDialog(
                win,
                {
                    title:
                        "TB Planner – Tasks importieren",

                    properties: [
                        "openFile"
                    ],

                    filters: [
                        {
                            name:
                                "JSON-Dateien",
                            extensions:
                                ["json"]
                        }
                    ]
                }
            );

        if (
            result.canceled ||
            !result.filePaths.length
        ) {
            return {
                success: false,
                canceled: true
            };
        }

        try {

            const text =
                await require("fs")
                    .promises
                    .readFile(
                        result.filePaths[0],
                        "utf8"
                    );

            const data =
                JSON.parse(text);

            if (
                !data ||
                data.format !==
                    "tb-planner-json" ||
                data.version !== 1 ||
                !Array.isArray(data.tasks)
            ) {

                throw new Error(
                    "Ungültiges TB-Planner-JSON-Format."
                );

            }

            return {
                success: true,
                filePath:
                    result.filePaths[0],
                data
            };

        } catch (error) {

            return {
                success: false,
                failureReason:
                    error.message
            };

        }

    }
);


/*
 * =========================================================
 * Druckvorschau
 *
 * Der Planner übergibt die aktuellen VTODO-Daten.
 * Die Vorschau enthält bewusst KEIN Gantt-Chart.
 * =========================================================
 */

ipcMain.handle("print", async event => {

    const todos =
        arguments[0];

});


ipcMain.handle(
    "print-preview",
    async (_event, todos) => {

        if (!Array.isArray(todos)) {
            throw new Error(
                "Keine gültige Taskliste für die Druckvorschau."
            );
        }

        const preview =
            new BrowserWindow({
                width: 1100,
                height: 800,
                title: "TB Planner – Druckvorschau",

                webPreferences: {
                    preload: path.join(
                        __dirname,
                        "preload.js"
                    ),
                    contextIsolation: true,
                    nodeIntegration: false
                }
            });

        const esc = value =>
            String(value ?? "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");

        const formatDate = value => {

            if (!value) {
                return "";
            }

            const text =
                String(value);

            const m =
                text.match(
                    /^(\\d{4})(\\d{2})(\\d{2})/
                );

            if (!m) {
                return esc(text);
            }

            return `${m[3]}.${m[2]}.${m[1]}`;
        };

        const duration = (start, due) => {

            if (!start || !due) {
                return "";
            }

            const a =
                String(start).match(
                    /^(\\d{4})(\\d{2})(\\d{2})/
                );

            const b =
                String(due).match(
                    /^(\\d{4})(\\d{2})(\\d{2})/
                );

            if (!a || !b) {
                return "";
            }

            const d1 =
                Date.UTC(
                    Number(a[1]),
                    Number(a[2]) - 1,
                    Number(a[3])
                );

            const d2 =
                Date.UTC(
                    Number(b[1]),
                    Number(b[2]) - 1,
                    Number(b[3])
                );

            return (
                Math.floor(
                    (d2 - d1) / 86400000
                ) + 1
            ) + " Tage";
        };

        const rows =
            todos.map(todo => {

                const description =
                    todo.description || "";

                const descriptionHtml =
                    esc(description)
                        .replace(/\r?\n/g, "<br>");

                return `
                    <section class="task">

                        <div class="task-header">

                            <div class="wbs">
                                ${esc(todo.wbs || "")}
                            </div>

                            <div class="summary">
                                ${esc(todo.summary || "")}
                            </div>

                            <div class="date">
                                ${formatDate(todo.dtstart)}
                            </div>

                            <div class="date">
                                ${formatDate(todo.due)}
                            </div>

                            <div class="duration">
                                ${duration(
                                    todo.dtstart,
                                    todo.due
                                )}
                            </div>

                            <div class="status">
                                ${esc(
                                    Number.isFinite(
                                        todo.percentComplete
                                    )
                                        ? todo.percentComplete + "%"
                                        : ""
                                )}
                            </div>

                        </div>

                        ${
                            description
                                ? `
                                    <div class="description">
                                        ${descriptionHtml}
                                    </div>
                                  `
                                : ""
                        }

                    </section>
                `;
            }).join("");

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<title>TB Planner – Druckvorschau</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    padding: 24px;
    font-family: Arial, sans-serif;
    font-size: 11pt;
    background: #eeeeee;
    color: #111;
}

.preview-toolbar {
    position: sticky;
    top: 0;
    z-index: 10;

    display: flex;
    gap: 10px;

    padding: 12px;
    margin: -24px -24px 20px -24px;

    background: #eeeeee;
    border-bottom: 1px solid #bbb;
}

.preview-toolbar button {
    padding: 7px 18px;
    font-size: 11pt;
    cursor: pointer;
}

.page {
    width: 297mm;
    min-height: 210mm;

    margin: 0 auto;
    padding: 15mm;

    background: white;

    box-shadow:
        0 2px 10px rgba(0,0,0,0.25);
}

h1 {
    margin: 0 0 12mm 0;
    font-size: 20pt;
}

.column-header,
.task-header {
    display: grid;

    grid-template-columns:
        18mm
        minmax(65mm, 1fr)
        27mm
        27mm
        25mm
        20mm;

    column-gap: 3mm;
}

.column-header {
    padding: 3mm 0;

    font-weight: bold;

    border-top: 1px solid #444;
    border-bottom: 2px solid #444;
}

.task {
    page-break-inside: avoid;

    border-bottom: 1px solid #ccc;

    padding: 3mm 0;
}

.task-header {
    align-items: start;
}

.wbs {
    font-weight: bold;
}

.summary {
    font-weight: 500;
}

.date,
.duration,
.status {
    white-space: nowrap;
}

.description {
    margin:
        2mm
        0
        1mm
        18mm;

    line-height: 1.35;
}

@media print {

    @page {
        size: A4 landscape;
        margin: 10mm;
    }

    body {
        padding: 0;
        background: white;
    }

    .preview-toolbar {
        display: none !important;
    }

    .page {
        width: auto;
        min-height: auto;

        margin: 0;
        padding: 0;

        box-shadow: none;
    }

}

</style>
</head>

<body>

<div class="preview-toolbar">

    <button id="savePdf">
        PDF speichern
    </button>

    <button id="closePreview">
        Schließen
    </button>

</div>

<div class="page">

    <h1>TB Planner</h1>

    <div class="column-header">
        <div>WBS</div>
        <div>Aufgabe</div>
        <div>Start</div>
        <div>Ende</div>
        <div>Dauer</div>
        <div>Status</div>
    </div>

    ${rows}

</div>

<script>

document
    .getElementById("savePdf")
    .addEventListener(
        "click",
        async () => {

            const result =
                await window.electronAPI
                    .printPreviewPdf();

            if (
                result &&
                result.success
            ) {
                document.title =
                    "TB Planner – PDF gespeichert";
            }

        }
    );

document
    .getElementById("closePreview")
    .addEventListener(
        "click",
        () => window.close()
    );

</script>

</body>
</html>`;

        await preview.loadURL(
            "data:text/html;charset=utf-8," +
            encodeURIComponent(html)
        );

        preview.show();

        return true;
    }
);


/*
 * PDF aus der Druckvorschau erzeugen.
 */
ipcMain.handle(
    "print-preview-pdf",
    async event => {

        const preview =
            BrowserWindow.fromWebContents(
                event.sender
            );

        if (!preview) {
            return {
                success: false,
                failureReason:
                    "Druckvorschau nicht gefunden."
            };
        }

        const result =
            await dialog.showSaveDialog(
                preview,
                {
                    title:
                        "TB Planner – PDF speichern",

                    defaultPath:
                        "TB-Planner.pdf",

                    filters: [
                        {
                            name:
                                "PDF-Dateien",
                            extensions:
                                ["pdf"]
                        }
                    ]
                }
            );

        if (
            result.canceled ||
            !result.filePath
        ) {
            return {
                success: false,
                canceled: true,
                failureReason:
                    "Abgebrochen"
            };
        }

        try {

            const pdfData =
                await preview.webContents
                    .printToPDF({
                        printBackground: true,
                        landscape: true,
                        preferCSSPageSize: true
                    });

            await require("fs")
                .promises
                .writeFile(
                    result.filePath,
                    pdfData
                );

            return {
                success: true,
                filePath:
                    result.filePath
            };

        } catch (error) {

            return {
                success: false,
                failureReason:
                    error.message
            };

        }

    }
);



app.whenReady().then(() => {

    createWindow();

    app.on("activate", () => {

        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});


app.on("window-all-closed", () => {

    if (process.platform !== "darwin") {
        app.quit();
    }
});
