const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    ping: () => "pong",

    print: () =>
        ipcRenderer.invoke("print"),

    printPreview: todos =>
        ipcRenderer.invoke(
            "print-preview",
            todos
        ),

    printPreviewPdf: () =>
        ipcRenderer.invoke(
            "print-preview-pdf"
        ),

    exportTasks: tasks =>
        ipcRenderer.invoke(
            "export-tasks",
            tasks
        ),

    importTasks: () =>
        ipcRenderer.invoke(
            "import-tasks"
        ),

        caldavRequest: (request) =>
        ipcRenderer.invoke("caldav-request", request)
});
