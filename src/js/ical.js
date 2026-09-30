export function parseCalendarData(xml) {
    const parser = new DOMParser();
    const document = parser.parseFromString(xml, "application/xml");

    const calendarDataElements =
        document.getElementsByTagNameNS(
            "urn:ietf:params:xml:ns:caldav",
            "calendar-data"
        );

    const items = [];

    for (const element of calendarDataElements) {
        const icalText = element.textContent || "";

        const item = parseICalendar(icalText);

        if (item) {
            items.push(item);
        }
    }

    return items;
}


function parseICalendar(text) {
    const lines = unfoldLines(text);

    const item = {};

    let component = null;

    for (const line of lines) {

        if (line === "BEGIN:VTODO") {
            component = "VTODO";
            continue;
        }

        if (line === "END:VTODO") {
            component = null;
            continue;
        }

        if (line === "BEGIN:VEVENT") {
            component = "VEVENT";
            continue;
        }

        if (line === "END:VEVENT") {
            component = null;
            continue;
        }

        if (!component) {
            continue;
        }

        const separator = line.indexOf(":");

        if (separator === -1) {
            continue;
        }

        const propertyPart = line.substring(0, separator);
        const value = line.substring(separator + 1);

        const parts = propertyPart.split(";");

        const name = parts[0].toUpperCase();

        const properties = {};

        for (let i = 1; i < parts.length; i++) {
            const [key, val] = parts[i].split("=");

            if (key && val !== undefined) {
                properties[key.toUpperCase()] = val;
            }
        }

        switch (name) {

            case "UID":
                item.uid = value;
                break;

            case "SUMMARY":
                item.summary = value;
                break;

            case "DESCRIPTION":
                item.description = value;
                break;

            case "STATUS":
                item.status = value;
                break;

            case "PERCENT-COMPLETE":
                item.percentComplete =
                    Number(value);
                break;

            case "DTSTART":
                item.dtstart = value;
                item.dtstartParams = properties;
                break;

            case "DUE":
                item.due = value;
                item.dueParams = properties;
                break;

            case "X-TB-PLANNER-WBS":
                item.wbs = value;
                break;

            case "X-TB-PLANNER-PARENT":
                item.parentId = value;
                break;

            case "X-TB-PLANNER-ORDER":
                item.order = Number(value);
                break;
        }
    }

    if (!item.uid) {
        return null;
    }

    item.type = component || "UNKNOWN";

    return item;
}


function unfoldLines(text) {

    const normalized =
        text.replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

    const physicalLines =
        normalized.split("\n");

    const logicalLines = [];

    for (const line of physicalLines) {

        if (
            (line.startsWith(" ") ||
             line.startsWith("\t")) &&
            logicalLines.length > 0
        ) {
            logicalLines[logicalLines.length - 1] +=
                line.substring(1);
        } else {
            logicalLines.push(line);
        }
    }

    return logicalLines;
}

